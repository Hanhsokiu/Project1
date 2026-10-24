import { Injectable } from "@nestjs/common";
import {
  WeeklyObligationConfigSchema,
  SubmittedProposalContentSchema,
} from "@doan/shared";
import type { DossierPrintSnapshot } from "@doan/shared";
import type {
  GuidanceTaskRecord,
  GuidancePlanRecord,
  GuidanceSession,
  ObligationRecord,
} from "./guidance.repository";
import type {
  ReviewProposal,
  ReviewPrincipal,
} from "../../topic/proposal-reviews/proposal-review.repository";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import { groupError } from "../../topic/review-groups/review-group.errors";
@Injectable()
export class GuidanceValidator {
  constructor(private readonly review: ProposalReviewValidator) {}
  role(u: ReviewPrincipal, role: string, resource: string, action: string) {
    return u.userRoles.some(
      (r) =>
        r.role.name === role &&
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === resource &&
            p.permission.action === action,
        ),
    );
  }
  async phase(s: GuidanceSession, termId: string) {
    const term = await s.term(termId),
      mapping = await s.guidancePhase(termId),
      now = new Date();
    if (!term || term.status !== "IN_PROGRESS")
      groupError(409, "TERM_003", "Đợt không ở giai đoạn hướng dẫn.");
    if (!mapping || mapping.refPhaseId.termId !== termId)
      groupError(409, "INPUT_NOT_READY", "Chưa cấu hình phase GUIDANCE.");
    const phase = mapping.refPhaseId;
    if (
      phase.startDate >= phase.endDate ||
      phase.startDate < term.startDate ||
      phase.endDate > term.endDate
    )
      groupError(
        409,
        "INPUT_NOT_READY",
        "Phase GUIDANCE phải nằm trong thời gian đợt.",
      );
    if (phase.isLocked || now < phase.startDate || now >= phase.endDate)
      groupError(
        409,
        "TERM_003",
        "Phase hướng dẫn chưa mở, đã khóa hoặc hết hạn.",
      );
    return phase;
  }
  async official(s: GuidanceSession, p: ReviewProposal) {
    const owner = this.review.ownership(p),
      ctx = await this.review.advisor(s, p);
    if (
      owner.confirmedAt === null ||
      owner.confirmedByAdvisorId !== ctx.assignment.advisorId ||
      owner.confirmedTopicRevision !== owner.revision ||
      owner.confirmedAssignmentRevision !== ctx.revision
    )
      groupError(
        409,
        "TOPIC_NOT_AGREED",
        "GVHD cần xác nhận đúng đề tài và phân công hiện hành.",
      );
    return ctx;
  }
  async finalized(s: GuidanceSession, p: ReviewProposal) {
    this.review.state(["APPROVED"], p.status);
    const d = await s.dossier(p.id),
      w = d?.pr2bDossierWorkflowDossierId,
      f = d?.pr2bDossierFinalizationDossierId.find(
        (x) => x.id === w?.currentFinalizationId,
      );
    if (
      !d ||
      !w ||
      !["FINALIZED", "RECEIVED"].includes(w.state ?? "") ||
      !f ||
      f.supersededAt ||
      !f.printSnapshot ||
      reviewHash(f.printSnapshot) !== f.contentHash ||
      !f.approvalDecisionId
    )
      groupError(
        409,
        "DOSSIER_NOT_FINALIZED",
        "Hồ sơ chưa có bản chốt hợp lệ hiện hành.",
      );
    if (
      f.versionId !== p.pr2bProposalWorkflowProposalId?.submittedVersionId ||
      p.pr2bProposalWorkflowProposalId.workingVersionId !== f.versionId
    )
      groupError(
        409,
        "STALE_VERSION",
        "Bản chốt không khớp phiên bản hiện hành.",
      );
    const version = await s.version(f.versionId);
    if (
      version?.proposalId !== p.id ||
      version.pr2bProposalVersionWorkflowVersionId?.state !== "SEALED" ||
      version.pr2bProposalVersionWorkflowVersionId.contentHash !==
        reviewHash(version.content)
    )
      groupError(
        409,
        "STALE_VERSION",
        "Snapshot đề cương đã chốt chưa hợp lệ.",
      );
    const snapshot = f.printSnapshot as unknown as DossierPrintSnapshot;
    const owner = this.review.ownership(p);
    if (
      snapshot.schemaVersion !== 1 ||
      snapshot.student?.id !== p.studentId ||
      !SubmittedProposalContentSchema.safeParse(snapshot.content).success ||
      reviewHash(snapshot.content) !== reviewHash(version!.content) ||
      snapshot.topicRevision !== owner.revision ||
      f.finalizedAt > new Date()
    )
      groupError(
        409,
        "DOSSIER_NOT_FINALIZED",
        "Snapshot in/đề tài không khớp bản chốt; cần xử lý theo workflow mở lại/chốt lại.",
      );
    return { d, w, f };
  }
  async active(
    s: GuidanceSession,
    p: ReviewProposal,
    plan: GuidancePlanRecord,
  ) {
    const w = plan.pr2bGuidancePlanWorkflowPlanId;
    if (!w || w.proposalId !== p.id || !w.state)
      groupError(409, "INPUT_NOT_READY", "Kế hoạch legacy cần đối soát.");
    if (w.state !== "ACTIVE")
      groupError(409, "PLAN_PAUSED", "Kế hoạch đã tạm dừng/lưu trữ.");
    const official = await this.official(s, p),
      final = await this.finalized(s, p);
    if (
      w.assignmentId !== official.assignment.id ||
      w.assignmentRevision !== official.revision ||
      plan.advisorId !== official.assignment.advisorId ||
      w.finalizationId !== final.f.id
    )
      groupError(
        409,
        "REBASE_REQUIRED",
        "Phân công/bản chốt đã đổi; cần xác nhận lại kế hoạch theo workflow.",
      );
    await this.phase(s, p.topic.termId);
    return { official, final };
  }
  dates(start: Date, due: Date, phase: { startDate: Date; endDate: Date }) {
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(due.getTime()) ||
      start >= due
    )
      groupError(
        400,
        "TASK_DATES_INVALID",
        "Ngày bắt đầu phải trước hạn hoàn thành.",
      );
    if (start < phase.startDate || due >= phase.endDate)
      groupError(
        409,
        "DEADLINE_OUTSIDE_PHASE",
        "Thời gian nhiệm vụ phải nằm trong phase GUIDANCE [start,end).",
      );
  }
  period(period: { termId: string } | null, termId: string) {
    if (!period || period.termId !== termId)
      groupError(
        409,
        "PERIOD_INVALID",
        "Mốc kế hoạch không thuộc đợt của hồ sơ.",
      );
    return period;
  }
  editable(t: GuidanceTaskRecord, acknowledge?: boolean) {
    const w = t.pr2bTaskWorkflowTaskId;
    if (
      !w?.state ||
      !w.kind ||
      !w.startsAt ||
      w.expectedDeliverables === null ||
      w.planId !== t.guidancePlanId ||
      !w.periodId
    )
      groupError(409, "INPUT_NOT_READY", "Nhiệm vụ legacy cần đối soát.");
    if (["COMPLETED", "CANCELLED"].includes(w.state))
      groupError(
        409,
        "STATE_TRANSITION_INVALID",
        "Nhiệm vụ đã hoàn thành/hủy, không thể chỉnh sửa trực tiếp.",
      );
    if (t.submissions.length && !acknowledge)
      groupError(
        409,
        "ACKNOWLEDGEMENT_REQUIRED",
        "Nhiệm vụ có bài nộp; cần xác nhận trước khi sửa/hủy.",
      );
    return w;
  }
  progress(t: GuidanceTaskRecord) {
    const w = t.pr2bTaskWorkflowTaskId;
    if (
      !w?.state ||
      !w.kind ||
      !w.startsAt ||
      w.expectedDeliverables === null ||
      w.planId !== t.guidancePlanId ||
      !w.periodId
    )
      groupError(409, "INPUT_NOT_READY", "Nhiệm vụ legacy cần đối soát.");
    if (
      !w?.state ||
      !["TODO", "IN_PROGRESS", "REVISION_REQUESTED"].includes(w.state)
    )
      groupError(
        409,
        "STATE_TRANSITION_INVALID",
        "Chỉ ghi tiến độ khi nhiệm vụ đang thực hiện/cần sửa.",
      );
    return w;
  }
  overdue(due: Date, state: string | null, now = new Date()) {
    return now > due && !["COMPLETED", "CANCELLED"].includes(state ?? "");
  }
  obligation(o: ObligationRecord, termStudentId: string, termId: string) {
    const p = o.refPeriodId,
      c = WeeklyObligationConfigSchema.safeParse(o.configSnapshot);
    if (
      o.termStudentId !== termStudentId ||
      p.termId !== termId ||
      p.type !== "WEEK" ||
      !p.reportDueAt ||
      o.configRevision !== p.revision ||
      !c.success ||
      c.data.termId !== termId ||
      c.data.termStudentId !== termStudentId ||
      c.data.periodId !== p.id ||
      c.data.periodRevision !== p.revision ||
      Date.parse(c.data.startsAt) !== p.startsAt.getTime() ||
      Date.parse(c.data.reportDueAt) !== p.reportDueAt.getTime()
    )
      groupError(
        409,
        "REPORTING_SCOPE_NOT_CONFIGURED",
        "Nghĩa vụ tuần chưa có cấu hình/snapshot hợp lệ từ producer.",
      );
    return c.data;
  }
}
