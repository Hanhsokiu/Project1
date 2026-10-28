import { Inject, Injectable } from "@nestjs/common";
import { isDeepStrictEqual } from "node:util";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { confirmationError } from "./defense-confirmation.dto";
import { DefenseConfirmationReadValidator } from "./defense-confirmation-read.validator";
import {
  DefenseConfirmationReportRepository,
  DefenseConfirmationReportSession,
} from "./defense-confirmation-report.repository";
import { DefenseConfirmationReportValidator } from "./defense-confirmation-report.validator";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";

@Injectable()
export class DefenseConfirmationReportService {
  constructor(
    @Inject(DefenseConfirmationReportRepository)
    private readonly repo: DefenseConfirmationReportRepository,
    @Inject(DefenseConfirmationReadValidator)
    private readonly readers: DefenseConfirmationReadValidator,
    @Inject(DefenseConfirmationValidator)
    private readonly context: DefenseConfirmationValidator,
    @Inject(DefenseConfirmationReportValidator)
    private readonly validator: DefenseConfirmationReportValidator,
    @Inject(FileStorageService)
    private readonly storage: FileStorageService,
  ) {}

  private async access(
    s: DefenseConfirmationReportSession,
    userId: string,
    proposalId: string,
  ) {
    const actor = this.readers.principal(await s.principal(userId), userId);
    this.readers.requireAdvisorReader(actor);
    const proposal = await s.proposal(proposalId);
    if (!proposal)
      confirmationError(
        404,
        "UC17_NOT_FOUND",
        "Không tìm thấy hồ sơ trong phạm vi.",
      );
    const term = await s.term(proposal.topic.termId),
      registration = await s.advisor(proposal.topic.termId, proposal.studentId),
      assignment = registration?.advisorAssignment,
      roster = assignment
        ? await s.roster(proposal.topic.termId, assignment.advisorId)
        : null,
      at = await s.now();
    this.context.advisorAccess(
      actor,
      this.context.official(proposal, term, registration, roster, at),
    );
    return { proposal, at };
  }

  async download(userId: string, proposalId: string, input: unknown) {
    const expected = this.validator.input(input);
    return this.repo.read(async (s) => {
      // Authorize before acquiring locks; reload authoritative facts afterwards.
      const initial = await this.access(s, userId, proposalId),
        termId = initial.proposal.termId;
      await s.lockReport(termId, proposalId);
      const current = await this.access(s, userId, proposalId);
      if (current.proposal.termId !== termId) this.validator.changed();
      const report = await s.report(proposalId),
        pdf = this.context.pdfMetadata(
          report,
          proposalId,
          current.proposal.student.userId,
          current.at,
        ),
        snapshot = this.validator.metadata(pdf);
      this.validator.expected(expected, snapshot);
      // Metadata validation above establishes this server-owned READY asset.
      const asset = report!.fileAsset!;
      await s.lockPdfKey(asset.storageKey);
      let bytes: Buffer;
      try {
        bytes = await this.storage.readPrivateFinalReport(
          asset.storageKey,
          asset.sizeBytes,
        );
      } catch {
        // Do not expose filesystem errors, private paths or storage keys.
        confirmationError(
          409,
          "UC17_PDF_FILE_UNAVAILABLE",
          "Không đọc được PDF hiện hành; cần kiểm tra lại file.",
        );
      }
      if (this.context.pdfBytes(pdf, bytes).state !== "READY")
        confirmationError(
          409,
          "UC17_PDF_CONTENT_INVALID",
          "Không xác minh được nội dung/checksum PDF hiện hành.",
        );

      // Never send a verified buffer after an ownership/assignment/asset change.
      // Locks serialize cooperating uploads and cleanup; rechecks also catch
      // account revocation or a changed official assignment during file I/O.
      const latest = await this.access(s, userId, proposalId);
      if (latest.proposal.termId !== termId) this.validator.changed();
      const latestReport = await s.report(proposalId),
        latestSnapshot = this.validator.metadata(
          this.context.pdfMetadata(
            latestReport,
            proposalId,
            latest.proposal.student.userId,
            latest.at,
          ),
        );
      this.validator.expected(expected, latestSnapshot);
      if (
        !isDeepStrictEqual(snapshot, latestSnapshot) ||
        latestReport?.fileAssetId !== report!.fileAssetId ||
        latestReport?.fileAsset?.storageKey !== asset.storageKey
      )
        this.validator.changed();
      // No download marker, audit, decision or eligibility mutation. The caller
      // receives bytes only after the transaction/rechecks have succeeded.
      return { bytes, name: snapshot.originalName };
    });
  }
}
