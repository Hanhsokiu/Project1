import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { AuditService } from "../../common/audit/audit.service";
import { FileStorageService } from "../../common/storage/file-storage.service";
import {
  SubmissionValidator,
  digest,
} from "../submissions/submission.validator";
import {
  FinalReportRepository,
  ReportRecord,
  ReportTransaction,
} from "./final-report.repository";
import { FinalReportValidator } from "./final-report.validator";
import {
  FINAL_REPORT_KEY,
  FinalReportAction,
  reportError,
} from "./final-report.dto";
import {
  FINAL_REPORT_ORPHAN_GRACE_MS,
  finalReportPolicy,
} from "./final-report-policy";

@Injectable()
export class FinalReportService {
  private readonly logger = new Logger(FinalReportService.name);
  private cleaning = false;
  private cursor = "";
  constructor(
    private readonly repo: FinalReportRepository,
    private readonly validator: FinalReportValidator,
    private readonly pdf: SubmissionValidator,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  policy() {
    return finalReportPolicy(this.config.get("FINAL_REPORT_MAX_FILE_BYTES"));
  }

  private async access(
    userId: string,
    proposalId: string,
    action: FinalReportAction,
    tx: ReportTransaction,
  ) {
    const user = this.validator.principal(
      await this.repo.principal(userId, tx),
      userId,
      action,
    );
    const p = await this.repo.proposal(proposalId, tx);
    const roster =
      p && p.studentId === user.student!.id
        ? await this.repo.roster(p.termId, p.studentId, tx)
        : null;
    return this.validator.ownership(user, p, roster);
  }

  private view(proposalId: string, userId: string, row: ReportRecord | null) {
    const base = { proposalId, revision: row?.revision ?? 0 };
    if (!row?.fileAssetId)
      return {
        ...base,
        state: row?.filePath
          ? "LEGACY_REQUIRES_RECONCILIATION"
          : "NOT_SUBMITTED",
        submittedAt: row?.submittedAt?.toISOString() ?? null,
        file: null,
      };
    const asset = this.validator.asset(row.fileAsset, userId);
    if (!row.submittedAt)
      reportError(
        409,
        "FINAL_REPORT_FILE_NOT_READY",
        "Thiếu thời điểm nộp PDF chính thức.",
      );
    return {
      ...base,
      state: "SUBMITTED",
      submittedAt: row.submittedAt.toISOString(),
      file: {
        originalName: asset.originalName,
        sizeBytes: asset.sizeBytes,
        mimeType: asset.mimeType,
        checksum: asset.checksum,
      },
    };
  }

  context(userId: string, proposalId: string) {
    return this.repo.transaction(async (tx) => {
      const p = await this.access(userId, proposalId, "read", tx),
        at = await this.repo.now(tx);
      const report = this.view(
        proposalId,
        userId,
        await this.repo.report(proposalId, tx),
      );
      let canSubmit = false;
      const readiness: string[] = [];
      try {
        await this.access(userId, proposalId, "create", tx);
        this.validator.open(p, at);
        canSubmit = true;
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        readiness.push(
          (error.getResponse() as { error: { code: string } }).error.code,
        );
      }
      const w = p.term.finalReportSubmissionWindow;
      return {
        proposalId,
        termId: p.termId,
        code: "FINAL_REPORT_SUBMISSION",
        canSubmit,
        readiness,
        serverNow: at.toISOString(),
        expectedRevision: report.revision,
        window: w
          ? {
              opensAt: w.opensAt.toISOString(),
              closesAt: w.closesAt.toISOString(),
              locked: w.isLocked,
              revision: w.revision,
            }
          : null,
        maxFileBytes: this.policy().maxFileBytes,
        allowedExtensions: ["pdf"],
        temporarySizeLimit: true,
        report,
      };
    });
  }

  detail(userId: string, proposalId: string) {
    return this.repo.transaction(async (tx) => {
      await this.access(userId, proposalId, "read", tx);
      return this.view(
        proposalId,
        userId,
        await this.repo.report(proposalId, tx),
      );
    });
  }

  preflight(userId: string, proposalId: string) {
    return this.repo.transaction(async (tx) => {
      const p = await this.access(userId, proposalId, "create", tx);
      this.validator.open(p, await this.repo.now(tx));
      return this.policy();
    });
  }

  async put(
    userId: string,
    proposalId: string,
    expectedRevision: number,
    file: Express.Multer.File,
  ) {
    await this.preflight(userId, proposalId);
    if (!file) reportError(400, "FILE_REQUIRED", "Cần đúng một file PDF.");
    const manifest = this.pdf.file("REPORT", file, this.policy());
    const key = `final-reports/${randomUUID()}`;
    let result: {
      report: ReturnType<FinalReportService["view"]>;
      oldKey: string | null;
    };
    try {
      result = await this.repo.transaction(async (tx) => {
        const initial = await this.access(userId, proposalId, "create", tx);
        await this.repo.lock(initial.termId, proposalId, tx);
        let p = await this.access(userId, proposalId, "create", tx);
        this.validator.open(p, await this.repo.now(tx));
        const current = await this.repo.report(proposalId, tx);
        this.validator.revision(expectedRevision, current?.revision ?? 0);
        const before = this.view(proposalId, userId, current);
        await this.repo.lockKey(key, tx);
        await this.storage.savePrivateFinalReport(key, file.buffer);
        // Recheck ownership/account/permission and window after filesystem work.
        p = await this.access(userId, proposalId, "create", tx);
        this.validator.open(p, await this.repo.now(tx));
        const latest = await this.repo.report(proposalId, tx);
        this.validator.revision(expectedRevision, latest?.revision ?? 0);
        const asset = await this.repo.addAsset(
          {
            ...manifest,
            id: randomUUID(),
            storageKey: key,
            state: "READY",
            createdByUserId: userId,
          },
          tx,
        );
        await this.repo.swap(
          proposalId,
          p.termId,
          current?.id ?? randomUUID(),
          asset.id,
          expectedRevision,
          !!current,
          tx,
        );
        const saved = await this.repo.report(proposalId, tx);
        if (!saved?.fileAssetId || saved.fileAssetId !== asset.id)
          reportError(
            409,
            "FINAL_REPORT_WRITE_CONFLICT",
            "Không xác nhận được bản PDF hiện hành.",
          );
        const report = this.view(proposalId, userId, saved);
        await this.audit.log(
          {
            userId,
            resource: "final-report",
            resourceId: proposalId,
            action:
              current?.fileAssetId || current?.filePath
                ? "REPLACE_FINAL_REPORT"
                : "SUBMIT_FINAL_REPORT",
            oldValue: before,
            newValue: report,
          },
          tx,
        );
        return { report, oldKey: current?.fileAsset?.storageKey ?? null };
      });
    } catch (error) {
      // A failed commit acknowledgement may be ambiguous. Never blindly unlink:
      // cleanup must reacquire the key lock and verify there are no DB references.
      await this.cleanupKey(key).catch(() =>
        this.logger.warn("PDF cleanup deferred for reconciliation."),
      );
      throw error;
    }
    if (result.oldKey && FINAL_REPORT_KEY.test(result.oldKey)) {
      await this.cleanupKey(result.oldKey).catch(() =>
        this.logger.warn(
          "Old PDF cleanup deferred; current report is committed.",
        ),
      );
    }
    return result.report;
  }

  download(userId: string, proposalId: string) {
    return this.repo.transaction(async (tx) => {
      const initial = await this.access(userId, proposalId, "download", tx);
      await this.repo.lock(initial.termId, proposalId, tx);
      await this.access(userId, proposalId, "download", tx);
      const row = await this.repo.report(proposalId, tx);
      if (!row?.fileAssetId || !row.submittedAt)
        reportError(
          404,
          "FINAL_REPORT_FILE_NOT_FOUND",
          "Chưa có PDF để tải hoặc file legacy cần đối soát.",
        );
      const asset = this.validator.asset(row.fileAsset, userId);
      this.pdf.filename(asset.originalName);
      await this.repo.lockKey(asset.storageKey, tx);
      let bytes: Buffer;
      try {
        bytes = await this.storage.readPrivateFinalReport(
          asset.storageKey,
          asset.sizeBytes,
        );
      } catch {
        reportError(
          409,
          "FINAL_REPORT_FILE_UNAVAILABLE",
          "Không đọc được PDF. Cần đối soát file lưu trữ.",
        );
      }
      if (bytes.length !== asset.sizeBytes || digest(bytes) !== asset.checksum)
        reportError(
          409,
          "FINAL_REPORT_FILE_CORRUPTED",
          "File PDF không khớp checksum đã lưu.",
        );
      return { bytes, name: asset.originalName };
    });
  }

  async cleanupKey(key: string) {
    if (!FINAL_REPORT_KEY.test(key)) return;
    return this.repo.transaction(async (tx) => {
      await this.repo.lockKey(key, tx);
      const asset = await this.repo.assetForCleanup(key, tx);
      if (
        asset &&
        (asset.kind !== "REPORT" ||
          asset.finalReport ||
          asset.guidanceUpload ||
          asset.pr2bDossierPdfContent ||
          Object.values(asset._count).some((count) => count > 0))
      )
        return;
      // Delete metadata first inside the transaction: FK checks/row locks must
      // succeed before unlinking bytes, including references created concurrently.
      // A filesystem failure rolls the metadata deletion back for a later retry.
      if (asset) await this.repo.deleteAsset(asset.id, tx);
      await this.storage.deletePrivateFinalReport(key);
    });
  }

  @Interval(60000)
  async cleanup() {
    if (this.cleaning) return;
    this.cleaning = true;
    try {
      const page = await this.storage.listPrivateFinalReports(this.cursor);
      this.cursor = page.cursor;
      for (const entry of page.entries) {
        if (
          entry.modifiedAt.getTime() >
          Date.now() - FINAL_REPORT_ORPHAN_GRACE_MS
        )
          continue;
        await this.cleanupKey(entry.key).catch(() =>
          this.logger.warn("Orphan PDF cleanup deferred."),
        );
      }
      const pending = await this.repo.transaction((tx) =>
        this.repo.cleanupCandidates(
          new Date(Date.now() - FINAL_REPORT_ORPHAN_GRACE_MS),
          tx,
        ),
      );
      for (const asset of pending) {
        await this.cleanupKey(asset.storageKey).catch(() =>
          this.logger.warn("PDF metadata cleanup deferred."),
        );
      }
    } catch {
      this.logger.warn("Private PDF reconciliation deferred.");
    } finally {
      this.cleaning = false;
    }
  }
}
