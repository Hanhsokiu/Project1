import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Prisma } from "@prisma/client";
import { AuditService } from "../../common/audit/audit.service";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import { FINAL_REPORT_KEY } from "../final-reports/final-report.dto";
import { DefenseConfirmationContextService } from "./defense-confirmation-context.service";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import { DefenseConfirmationCommandValidator } from "./defense-confirmation-command.validator";
import {
  DefenseConfirmationCommandRepository,
  DefenseConfirmationWriteSession,
} from "./defense-confirmation-command.repository";
import { confirmationError } from "./defense-confirmation.dto";
import type { DefenseConfirmationContext } from "./defense-confirmation.types";
import type { ReportRecord } from "../final-reports/final-report.repository";

@Injectable()
export class DefenseConfirmationCommandService {
  constructor(
    @Inject(DefenseConfirmationCommandRepository)
    private readonly repo: DefenseConfirmationCommandRepository,
    @Inject(DefenseConfirmationCommandValidator)
    private readonly command: DefenseConfirmationCommandValidator,
    @Inject(DefenseConfirmationContextService)
    private readonly contexts: DefenseConfirmationContextService,
    @Inject(DefenseConfirmationValidator)
    private readonly validator: DefenseConfirmationValidator,
    @Inject(Uc18FinalizationReader)
    private readonly uc18: Uc18FinalizationReader,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Recheck mutable authority/metadata after file IO, without reading/parsing a
   * second PDF. The parent/proposal/key locks keep its server-verified bytes
   * immutable for cooperating PDF/cleanup writers until this transaction ends.
   */
  private async recheck(
    userId: string,
    proposalId: string,
    termId: string,
    verified: DefenseConfirmationContext,
    sourceReport: ReportRecord | null,
    s: DefenseConfirmationWriteSession,
    tx: Prisma.TransactionClient,
  ) {
    const actor = this.command.principal(await s.principal(userId), userId);
    const proposal = await s.proposal(proposalId);
    if (
      !proposal ||
      proposal.termId !== termId ||
      proposal.topic.termId !== termId
    )
      confirmationError(409, "UC17_CONTEXT_CHANGED", "Hồ sơ/đợt vừa thay đổi.");
    const term = await s.term(termId),
      registration = await s.advisor(termId, proposal.studentId);
    const roster = registration?.advisorAssignment
      ? await s.roster(termId, registration.advisorAssignment.advisorId)
      : null;
    const window = await s.window(termId),
      row = await s.currentDecision(proposalId),
      report = await s.report(proposalId);
    const uc18 = await this.uc18.read(termId, tx),
      at = await s.now();
    const advisor = this.validator.official(
      proposal,
      term,
      registration,
      roster,
      at,
    );
    this.validator.advisorAccess(actor, advisor);
    if (!term)
      confirmationError(
        409,
        "UC17_CONTEXT_CHANGED",
        "Không xác minh được đợt.",
      );
    let pdf = this.validator.pdfMetadata(
      report,
      proposalId,
      proposal.student.userId,
      at,
    );
    const sourceMetadata = this.validator.pdfMetadata(
      sourceReport,
      proposalId,
      proposal.student.userId,
      at,
    );
    if (
      verified.pdf.state === "READY" &&
      (report?.fileAssetId !== sourceReport?.fileAssetId ||
        report?.fileAsset?.storageKey !== sourceReport?.fileAsset?.storageKey)
    )
      confirmationError(
        409,
        "PDF_CONTEXT_CHANGED",
        "File PDF vừa thay đổi sau lần xác minh.",
      );
    if (
      verified.pdf.state === "READY" &&
      pdf.state === "UNVERIFIED" &&
      isDeepStrictEqual(pdf.snapshot, verified.pdf.snapshot)
    )
      pdf = { ...pdf, state: "READY" };
    else if (
      verified.pdf.state === "INVALID" &&
      pdf.state === "UNVERIFIED" &&
      sourceMetadata.state === "UNVERIFIED" &&
      report?.fileAssetId === sourceReport?.fileAssetId &&
      report?.fileAsset?.storageKey === sourceReport?.fileAsset?.storageKey &&
      isDeepStrictEqual(pdf.snapshot, sourceMetadata.snapshot)
    )
      // Same metadata, but the bytes could not be verified. REJECTED may still
      // record a reason with null PDF evidence; CONFIRMED remains blocked.
      pdf = {
        ...pdf,
        state: "INVALID",
        snapshot: null,
        issues: verified.pdf.issues,
      };
    else if (pdf.state === "UNVERIFIED")
      confirmationError(
        409,
        "PDF_CONTEXT_CHANGED",
        "PDF vừa thay đổi sau lần xác minh; cần tải lại context.",
      );
    const context: DefenseConfirmationContext = {
      ...verified,
      asOf: at.toISOString(),
      advisor,
      pdf,
      uc18,
      proposal: {
        id: proposal.id,
        status: proposal.status,
        studentId: proposal.studentId,
      },
      term: {
        id: term.id,
        status: term.status,
        locked: term.isLocked,
        startsAt: term.startDate.toISOString(),
        endsAt: term.endDate.toISOString(),
      },
      student: {
        id: proposal.student.id,
        code: proposal.student.studentCode,
        name: proposal.student.fullName,
        active: proposal.student.isActive,
      },
      window: this.validator.window(term, window, at),
      decision: this.validator.decision(row, at),
    };
    return { context, at };
  }

  async put(userId: string, proposalId: string, value: unknown) {
    const input = this.command.input(value);
    return this.repo.write(async (s, tx) => {
      this.command.principal(await s.principal(userId), userId);
      const locator = await s.proposalTerm(proposalId);
      if (!locator)
        confirmationError(
          404,
          "UC17_NOT_FOUND",
          "Không tìm thấy hồ sơ trong phạm vi.",
        );
      await s.lock(locator.termId, [], proposalId);
      this.command.principal(await s.principal(userId), userId);
      const sourceReport = await s.report(proposalId);
      if (
        sourceReport?.fileAsset &&
        FINAL_REPORT_KEY.test(sourceReport.fileAsset.storageKey)
      )
        await s.lockPdfKey(sourceReport.fileAsset.storageKey);
      const verified = await this.contexts.readInTransaction(
        userId,
        proposalId,
        s,
        tx,
      );
      if (verified.term.id !== locator.termId)
        confirmationError(409, "UC17_CONTEXT_CHANGED", "Hồ sơ vừa chuyển đợt.");
      const { context, at } = await this.recheck(
        userId,
        proposalId,
        locator.termId,
        verified,
        sourceReport,
        s,
        tx,
      );
      const decision = this.command.validate(context, input);
      if (decision.unchanged)
        return {
          code: "DEFENSE_CONFIRMATION",
          proposalId,
          changed: false,
          decision: context.decision,
          warnings: context.progress.warnings,
        };
      const revision = input.expectedRevision + 1;
      if (context.advisor.state !== "OFFICIAL")
        confirmationError(
          409,
          "OFFICIAL_ADVISOR_NOT_READY",
          "Chưa có GVHD chính thức.",
        );
      const data = {
        advisorId: context.advisor.advisorId,
        status: input.status,
        note: decision.note,
        revision,
        confirmedAt: input.status === "CONFIRMED" ? at : null,
        decidedAt: at,
        decidedByUserId: userId,
        updatedAt: at,
        decisionContext: decision.snapshot,
      };
      let id = context.decision.id;
      if (id) {
        const result = await s.updateDecision(
          id,
          proposalId,
          input.expectedRevision,
          data,
        );
        if (result.count !== 1)
          confirmationError(
            409,
            "REVISION_CONFLICT",
            "Quyết định vừa thay đổi.",
          );
      } else {
        id = randomUUID();
        await s.createDecision({ id, proposalId, ...data, createdAt: at });
      }
      await s.appendHistory({
        id: randomUUID(),
        confirmationId: id,
        revision,
        status: input.status,
        note: decision.note,
        changeReason: input.changeReason ?? null,
        decidedAt: at,
        actorId: userId,
        advisorId: data.advisorId,
        decisionContext: decision.snapshot,
        createdAt: at,
      });
      const saved = await s.currentDecision(proposalId);
      const after = this.validator.decision(saved, at);
      if (
        after.state !== "RECORDED" ||
        after.id !== id ||
        after.revision !== revision
      )
        confirmationError(
          409,
          "UC17_WRITE_CONFLICT",
          "Không xác minh được quyết định đã lưu.",
        );
      await this.audit.log(
        {
          userId,
          action:
            context.decision.state === "ABSENT" ||
            context.decision.state === "PENDING"
              ? "RECORD_DEFENSE_CONFIRMATION"
              : "CHANGE_DEFENSE_CONFIRMATION",
          resource: "defense-confirmation",
          resourceId: proposalId,
          oldValue: context.decision,
          newValue: { ...after, changeReason: input.changeReason ?? null },
        },
        tx,
      );
      // Existing in-app notification store; same transaction, only actual changes.
      // Delivery is not sent through the assignment-specific email worker.
      await s.notifyFaculty(proposalId, locator.termId, revision, input.status);
      return {
        code: "DEFENSE_CONFIRMATION",
        proposalId,
        changed: true,
        decision: after,
        warnings: context.progress.warnings,
      };
    });
  }
}
