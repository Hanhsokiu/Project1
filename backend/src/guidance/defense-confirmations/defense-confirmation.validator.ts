import { HttpException, Inject, Injectable } from "@nestjs/common";
import type {
  DefenseConfirmation,
  DefenseConfirmationWindow,
} from "@prisma/client";
import { z } from "zod";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import type {
  ProposalReviewSession,
  ReviewPrincipal,
  ReviewProposal,
} from "../../topic/proposal-reviews/proposal-review.repository";
import { FinalReportValidator } from "../final-reports/final-report.validator";
import type { ReportRecord } from "../final-reports/final-report.repository";
import { finalReportPolicy } from "../final-reports/final-report-policy";
import {
  SubmissionValidator,
  digest,
} from "../submissions/submission.validator";
import type { Uc18Finalization } from "../../common/contracts/uc18-finalization.port";
import type {
  ContextIssue,
  DecisionContext,
  DefenseConfirmationContext,
  ExpectedDecisionContext,
  OfficialAdvisorContext,
  PdfContext,
  WindowContext,
} from "./defense-confirmation.types";

type Term = NonNullable<Awaited<ReturnType<ProposalReviewSession["term"]>>>;
type Registration = Awaited<ReturnType<ProposalReviewSession["advisor"]>>;
const integer = z.number().int().min(0).max(2147483647);
const text = z.string().trim().min(1);
const checksum = z.string().regex(/^[0-9a-f]{64}$/);
const instant = z.string().datetime({ offset: true });
// Strip extra keys rather than returning arbitrary legacy JSON/storage paths.
export const decisionSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  assignment: z.object({ assignmentId: text, revision: integer }),
  pdf: z
    .object({
      finalReportId: text,
      revision: integer,
      checksum,
      originalName: text,
      sizeBytes: z.number().int().positive().max(2147483647),
      submittedAt: instant,
    })
    .nullable(),
});
const expectedContextSchema = z.object({
  revision: integer,
  assignment: z.object({ assignmentId: text, revision: integer }),
  pdf: z
    .object({ finalReportId: text, revision: integer, checksum })
    .nullable(),
});
export const UC17_PDF_READ_MAX_BYTES = 100 * 1024 * 1024;
const issue = (code: string, message: string): ContextIssue => ({
  code,
  message,
});
const validDate = (value: Date | null | undefined): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime());
const iso = (value: Date | null | undefined) =>
  validDate(value) ? value.toISOString() : null;
const validRevision = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= 2147483647;

/** Stateless rules: all database facts, file bytes and the clock are arguments. */
@Injectable()
export class DefenseConfirmationValidator {
  constructor(
    @Inject(ProposalReviewValidator)
    private readonly review: ProposalReviewValidator,
    @Inject(FinalReportValidator)
    private readonly reports: FinalReportValidator,
    @Inject(SubmissionValidator)
    private readonly files: SubmissionValidator,
  ) {}

  principal(user: ReviewPrincipal | null, userId: string) {
    const actor = this.review.principal(user);
    if (
      actor.id !== userId ||
      actor.mustChangePassword ||
      !actor.lecturer?.isActive ||
      !actor.userRoles.some(
        (r) =>
          r.role.name === "LECTURER" &&
          r.role.rolePermissions.some(
            (p) =>
              p.permission.resource === "guidance" &&
              p.permission.action === "read",
          ),
      )
    )
      this.fail(
        403,
        "UC17_FORBIDDEN",
        "Cần tài khoản GVHD hoạt động có quyền đọc hướng dẫn.",
      );
    return actor;
  }

  official(
    proposal: ReviewProposal,
    term: Term | null,
    registration: Registration,
    roster: { termId: string; lecturerId: string } | null,
    at: Date,
  ): OfficialAdvisorContext {
    try {
      this.review.ownership(proposal);
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      return {
        state: "NOT_READY",
        issues: [
          issue(
            "OWNERSHIP_NOT_READY",
            "Thiếu ownership hồ sơ/TermStudent hợp lệ.",
          ),
        ],
      };
    }
    const a = registration?.advisorAssignment,
      plan = a?.assignmentPlan,
      meta = plan?.pr2bAssignmentPlanWorkflowPlanId,
      latest = a?.pr2bAssignmentChangeAssignmentId[0];
    // Same official-source checks as ProposalReviewValidator.advisor, with an
    // explicit clock and preloaded facts so the policy is deterministic.
    if (
      !term ||
      proposal.termId !== proposal.topic.termId ||
      term.id !== proposal.termId ||
      registration?.termId !== term.id ||
      registration.studentId !== proposal.studentId ||
      !a ||
      !plan ||
      plan.status !== "FINALIZED" ||
      plan.termId !== term.id ||
      term.pr2bTermWorkflowTermId?.officialAssignmentPlanId !== plan.id ||
      !validDate(meta?.finalizedAt) ||
      meta.finalizedAt > at ||
      !meta.finalizedByUserId ||
      !a.advisor.isActive ||
      !a.advisor.userId ||
      !roster ||
      roster.termId !== term.id ||
      roster.lecturerId !== a.advisorId ||
      (latest &&
        (latest.assignmentId !== a.id ||
          !validRevision(latest.assignmentRevision) ||
          latest.assignmentRevision < 1 ||
          !validDate(latest.effectiveAt) ||
          latest.effectiveAt > at ||
          latest.newAdvisorId !== a.advisorId))
    ) {
      return {
        state: "NOT_READY",
        issues: [
          issue(
            "OFFICIAL_ADVISOR_NOT_READY",
            "Thiếu phân công FINALIZED hoặc bằng chứng bàn giao hiện hành hợp lệ.",
          ),
        ],
      };
    }
    return {
      state: "OFFICIAL",
      assignmentId: a.id,
      revision: latest?.assignmentRevision ?? 0,
      planId: plan.id,
      advisorId: a.advisorId,
      userId: a.advisor.userId,
      name: a.advisor.fullName,
    };
  }

  advisorAccess(user: ReviewPrincipal, advisor: OfficialAdvisorContext) {
    if (
      advisor.state !== "OFFICIAL" ||
      advisor.advisorId !== user.lecturer?.id ||
      advisor.userId !== user.id
    )
      this.fail(
        404,
        "UC17_NOT_FOUND",
        "Không tìm thấy hồ sơ trong phạm vi GVHD chính thức hiện hành.",
      );
  }

  pdfMetadata(
    report: ReportRecord | null,
    proposalId: string,
    studentUserId: string,
    at: Date,
  ): PdfContext {
    const base = {
      finalReportId: report?.id ?? null,
      revision: report?.revision ?? 0,
      submittedAt: iso(report?.submittedAt),
      snapshot: null,
      issues: [],
    };
    if (!report) return { ...base, state: "NOT_SUBMITTED" };
    if (report.proposalId !== proposalId || !validRevision(report.revision))
      return {
        ...base,
        state: "INVALID",
        issues: [
          issue(
            "PDF_METADATA_INVALID",
            "Metadata PDF không khớp hồ sơ/revision.",
          ),
        ],
      };
    if (!report.fileAssetId && report.revision > 0 && !report.filePath)
      return {
        ...base,
        state: "INVALID",
        issues: [
          issue(
            "PDF_METADATA_INVALID",
            "Báo cáo đã có revision nhưng mất metadata file hiện hành.",
          ),
        ],
      };
    if (!report.fileAssetId)
      return {
        ...base,
        state: report.filePath ? "LEGACY" : "NOT_SUBMITTED",
        issues: report.filePath
          ? [
              issue(
                "PDF_LEGACY",
                "PDF legacy cần đối soát; không đọc filePath cũ.",
              ),
            ]
          : [],
      };
    try {
      const asset = this.reports.asset(report.fileAsset, studentUserId);
      this.files.filename(asset.originalName);
      if (
        asset.id !== report.fileAssetId ||
        !/\.pdf$/i.test(asset.originalName) ||
        report.revision < 1 ||
        !validDate(report.submittedAt) ||
        report.submittedAt > at
      )
        throw new Error("Invalid report metadata");
      return {
        ...base,
        state: "UNVERIFIED",
        snapshot: {
          finalReportId: report.id,
          revision: report.revision,
          checksum: asset.checksum,
          originalName: asset.originalName,
          sizeBytes: asset.sizeBytes,
          submittedAt: report.submittedAt.toISOString(),
        },
      };
    } catch {
      return {
        ...base,
        state: "INVALID",
        issues: [
          issue(
            "PDF_METADATA_INVALID",
            "PDF thiếu FileAsset READY hoặc metadata hợp lệ.",
          ),
        ],
      };
    }
  }

  pdfBytes(pdf: PdfContext, bytes: Buffer): PdfContext {
    if (!["UNVERIFIED", "READY"].includes(pdf.state) || !pdf.snapshot)
      return pdf;
    const s = pdf.snapshot;
    try {
      if (bytes.length !== s.sizeBytes || digest(bytes) !== s.checksum)
        throw new Error("Checksum mismatch");
      this.files.file(
        "REPORT",
        {
          originalname: s.originalName,
          mimetype: "application/pdf",
          size: bytes.length,
          buffer: bytes,
        } as Express.Multer.File,
        finalReportPolicy(UC17_PDF_READ_MAX_BYTES),
      );
      return { ...pdf, state: "READY" };
    } catch {
      return this.pdfUnavailable(pdf, "PDF_CONTENT_INVALID");
    }
  }

  pdfUnavailable(pdf: PdfContext, code = "PDF_FILE_UNAVAILABLE"): PdfContext {
    return {
      ...pdf,
      state: "INVALID",
      snapshot: null,
      issues: [issue(code, "Không xác minh được file PDF hiện hành.")],
    };
  }

  decision(row: DefenseConfirmation | null, at: Date): DecisionContext {
    const base = {
      id: row?.id ?? null,
      status: row?.status ?? null,
      revision: row?.revision ?? 0,
      advisorId: row?.advisorId ?? null,
      note: row?.note ?? null,
      confirmedAt: iso(row?.confirmedAt),
      decidedAt: iso(row?.decidedAt),
      decidedByUserId: row?.decidedByUserId ?? null,
      snapshot: null,
      issues: [],
    };
    if (!row) return { ...base, state: "ABSENT" };
    if (row.revision === 0)
      return {
        ...base,
        state:
          row.status === "PENDING" && !row.decisionContext && !row.confirmedAt
            ? "PENDING"
            : "LEGACY",
        issues: [
          issue(
            "DECISION_LEGACY_OR_UNINITIALIZED",
            "Chưa có snapshot quyết định đã được xác minh; không tạo lịch sử giả.",
          ),
        ],
      };
    const snapshot = decisionSnapshotSchema.safeParse(row.decisionContext);
    let unsafeName = false;
    if (snapshot.success && snapshot.data.pdf) {
      try {
        this.files.filename(snapshot.data.pdf.originalName);
        unsafeName = !/\.pdf$/i.test(snapshot.data.pdf.originalName);
      } catch {
        unsafeName = true;
      }
    }
    if (
      !validRevision(row.revision) ||
      !["CONFIRMED", "REJECTED"].includes(row.status) ||
      !snapshot.success ||
      !row.decidedByUserId ||
      !row.advisorId ||
      !validDate(row.decidedAt) ||
      row.decidedAt > at ||
      !validDate(row.updatedAt) ||
      row.updatedAt > at ||
      unsafeName ||
      (row.status === "REJECTED" &&
        (!row.note?.trim() || row.confirmedAt !== null)) ||
      (row.status === "CONFIRMED" &&
        (!validDate(row.confirmedAt) ||
          row.confirmedAt > at ||
          !snapshot.data.pdf)) ||
      (snapshot.success &&
        snapshot.data.pdf &&
        new Date(snapshot.data.pdf.submittedAt) > row.decidedAt)
    ) {
      return {
        ...base,
        state: "INVALID",
        issues: [
          issue(
            "DECISION_METADATA_INVALID",
            "Metadata/snapshot quyết định cần đối soát.",
          ),
        ],
      };
    }
    return { ...base, state: "RECORDED", snapshot: snapshot.data };
  }

  changed(
    decision: DecisionContext,
    pdf: PdfContext,
    advisor: OfficialAdvisorContext,
  ) {
    let pdfChangedSinceDecision: boolean | null = null,
      advisorChangedSinceDecision: boolean | null = null;
    if (decision.state === "RECORDED" && decision.snapshot) {
      const old = decision.snapshot.pdf;
      if (pdf.state === "READY" && pdf.snapshot)
        pdfChangedSinceDecision =
          !old ||
          old.finalReportId !== pdf.snapshot.finalReportId ||
          old.revision !== pdf.snapshot.revision ||
          old.checksum !== pdf.snapshot.checksum;
      else if (pdf.state === "NOT_SUBMITTED")
        pdfChangedSinceDecision = old !== null;
      else if (
        old &&
        pdf.finalReportId &&
        (old.finalReportId !== pdf.finalReportId ||
          old.revision !== pdf.revision)
      )
        pdfChangedSinceDecision = true;
    }
    if (advisor.state === "OFFICIAL" && decision.advisorId) {
      if (decision.advisorId !== advisor.advisorId)
        advisorChangedSinceDecision = true;
      else if (decision.state === "RECORDED" && decision.snapshot)
        advisorChangedSinceDecision =
          decision.snapshot.assignment.assignmentId !== advisor.assignmentId ||
          decision.snapshot.assignment.revision !== advisor.revision;
    }
    let applicable: boolean | null = null;
    if (
      decision.state === "ABSENT" ||
      decision.state === "PENDING" ||
      (decision.state === "RECORDED" && decision.status === "REJECTED")
    )
      applicable = false;
    else if (decision.state === "RECORDED" && decision.status === "CONFIRMED") {
      if (
        pdfChangedSinceDecision === true ||
        advisorChangedSinceDecision === true ||
        (advisor.state === "OFFICIAL" &&
          decision.decidedByUserId !== advisor.userId)
      )
        applicable = false;
      else if (
        pdf.state === "READY" &&
        advisor.state === "OFFICIAL" &&
        pdfChangedSinceDecision === false &&
        advisorChangedSinceDecision === false
      )
        applicable = true;
    }
    return {
      pdfChangedSinceDecision,
      advisorChangedSinceDecision,
      confirmationApplicableToCurrentContext: applicable,
    };
  }

  window(
    term: Term,
    row: DefenseConfirmationWindow | null,
    at: Date,
  ): WindowContext {
    const base = {
      configured: !!row,
      opensAt: iso(row?.opensAt),
      closesAt: iso(row?.closesAt),
      locked: row?.isLocked ?? null,
      revision: row?.revision ?? 0,
    };
    const result = (
      state: WindowContext["state"],
      code: string,
      message: string,
    ): WindowContext => ({ ...base, state, issues: [issue(code, message)] });
    if (!row)
      return result(
        "NOT_CONFIGURED",
        "UC17_WINDOW_NOT_CONFIGURED",
        "Chưa cấu hình cửa sổ UC17 riêng.",
      );
    if (
      row.termId !== term.id ||
      !validRevision(row.revision) ||
      !validDate(row.opensAt) ||
      !validDate(row.closesAt) ||
      !validDate(term.startDate) ||
      !validDate(term.endDate) ||
      term.startDate >= term.endDate ||
      row.opensAt >= row.closesAt ||
      row.opensAt < term.startDate ||
      row.closesAt > term.endDate
    )
      return result(
        "INVALID",
        "UC17_WINDOW_INVALID",
        "Cửa sổ UC17 không hợp lệ với đợt.",
      );
    if (term.isLocked || ["COMPLETED", "CANCELLED"].includes(term.status))
      return result("TERM_LOCKED", "UC17_TERM_LOCKED", "Đợt đã khóa/kết thúc.");
    if (row.isLocked)
      return result("LOCKED", "UC17_WINDOW_LOCKED", "Cửa sổ UC17 đã khóa.");
    if (at < row.opensAt)
      return result(
        "NOT_OPEN",
        "UC17_WINDOW_NOT_OPEN",
        "Chưa đến thời gian UC17.",
      );
    if (at >= row.closesAt)
      return result("CLOSED", "UC17_WINDOW_CLOSED", "Đã hết thời gian UC17.");
    return { ...base, state: "OPEN", issues: [] };
  }

  uc18(state: Uc18Finalization, termId: string): ContextIssue[] {
    if (state.termId !== termId || state.scope !== "TERM")
      return [
        issue("UC18_SCOPE_INVALID", "Không xác minh được phạm vi chốt UC18."),
      ];
    if (state.state === "FINALIZED")
      return [issue("UC18_FINALIZED", "Khoa đã chốt danh sách UC18.")];
    if (state.state !== "OPEN" || !validRevision(state.revision))
      return [
        issue(
          "UC18_FINALIZATION_UNKNOWN",
          "Chưa có nguồn xác định trạng thái chốt UC18.",
        ),
      ];
    return [];
  }

  contextChanged(
    expected: ExpectedDecisionContext,
    context: DefenseConfirmationContext,
  ): ContextIssue[] {
    if (!expectedContextSchema.safeParse(expected).success)
      return [
        issue(
          "EXPECTED_CONTEXT_INVALID",
          "Thiếu revision/context đã xem hợp lệ.",
        ),
      ];
    const a = context.advisor,
      p = context.pdf.snapshot,
      old = expected.pdf;
    if (
      !validRevision(expected.revision) ||
      expected.revision !== context.decision.revision
    )
      return [
        issue(
          "REVISION_CONFLICT",
          "Quyết định đã thay đổi; cần tải lại context.",
        ),
      ];
    if (
      a.state !== "OFFICIAL" ||
      !validRevision(expected.assignment.revision) ||
      expected.assignment.assignmentId !== a.assignmentId ||
      expected.assignment.revision !== a.revision
    )
      return [
        issue(
          "ASSIGNMENT_CONTEXT_CHANGED",
          "Phân công đã thay đổi; cần tải lại context.",
        ),
      ];
    // Unavailable PDF is represented by null; CONFIRMED separately requires a
    // verified PDF, while REJECTED may proceed without one.
    if (
      !!old !== !!p ||
      (old &&
        p &&
        (!validRevision(old.revision) ||
          old.finalReportId !== p.finalReportId ||
          old.revision !== p.revision ||
          old.checksum !== p.checksum))
    )
      return [
        issue(
          "PDF_CONTEXT_CHANGED",
          "PDF đã thay đổi hoặc chưa xác minh được.",
        ),
      ];
    return [];
  }

  readiness(
    context: Pick<
      DefenseConfirmationContext,
      "advisor" | "window" | "pdf" | "uc18" | "term" | "student" | "decision"
    > & { proposal?: { status: string } },
    status: "CONFIRMED" | "REJECTED",
  ) {
    const blockers: ContextIssue[] = [];
    if (context.proposal && context.proposal.status !== "APPROVED")
      blockers.push(
        issue(
          "UC17_PROPOSAL_NOT_APPROVED",
          "Hồ sơ chưa được duyệt chính thức.",
        ),
      );
    if (
      !validRevision(context.decision.revision) ||
      context.decision.revision >= 2147483647
    )
      blockers.push(
        issue(
          "REVISION_CONFLICT",
          "Revision không cho phép ghi quyết định tiếp theo.",
        ),
      );
    if (context.advisor.state !== "OFFICIAL")
      blockers.push(...context.advisor.issues);
    blockers.push(
      ...context.window.issues,
      ...this.uc18(context.uc18, context.term.id),
    );
    if (!context.student.active)
      blockers.push(
        issue("UC17_STUDENT_INACTIVE", "Sinh viên không hoạt động."),
      );
    if (context.decision.state === "INVALID")
      blockers.push(...context.decision.issues);
    if (status === "CONFIRMED" && context.pdf.state !== "READY")
      blockers.push(
        issue(
          "UC17_VALID_PDF_REQUIRED",
          "Đồng ý bảo vệ cần PDF hiện hành đã xác minh.",
        ),
      );
    // Progress is deliberately absent: incomplete/missing tasks are warnings.
    return { allowed: blockers.length === 0, blockers };
  }

  /** Policy gate only. A future command must recheck actor/permission and reload
   * all facts under its transaction/locks; a previous read is never authority.
   */
  assertWritable(
    context: DefenseConfirmationContext,
    status: "CONFIRMED" | "REJECTED",
    expected: ExpectedDecisionContext,
  ) {
    const blockers = [
      ...this.readiness(context, status).blockers,
      ...this.contextChanged(expected, context),
    ];
    if (blockers.length) this.fail(409, blockers[0].code, blockers[0].message);
  }

  private fail(status: number, code: string, message: string): never {
    throw new HttpException({ error: { code, message } }, status);
  }
}
