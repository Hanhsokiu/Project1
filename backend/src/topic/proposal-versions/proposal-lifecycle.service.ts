import { HttpException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  ProposalLifecycleAction,
  ProposalLifecycleContext,
  ProposalLifecycleView,
  ProposalWithdraw,
  ProposalReturnToDraft,
  ProposalReopen,
} from "@doan/shared";
import {
  ProposalVersionRepository,
  ProposalVersionSession,
} from "./proposal-version.repository";
import { ProposalVersionValidator } from "./proposal-version.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../proposal-reviews/proposal-review.validator";
import type {
  ReviewPrincipal,
  ReviewProposal,
} from "../proposal-reviews/proposal-review.repository";
import { groupError } from "../review-groups/review-group.errors";

type Input = ProposalWithdraw | ProposalReturnToDraft | ProposalReopen;
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

@Injectable()
export class ProposalLifecycleService {
  constructor(
    private readonly repo: ProposalVersionRepository,
    private readonly validator: ProposalVersionValidator,
    private readonly review: ProposalReviewValidator,
  ) {}

  private async phase(
    s: ProposalVersionSession,
    termId: string,
    action: ProposalLifecycleAction,
  ) {
    if (action !== "reopen") return this.validator.phase(s, termId);
    // Faculty may reopen outside the edit window; this never opens student editing.
    const term = await s.term(termId);
    if (
      !term ||
      ![
        "DRAFT",
        "OPEN_REGISTRATION",
        "CLOSED_REGISTRATION",
        "IN_PROGRESS",
      ].includes(term.status)
    )
      groupError(409, "TERM_003", "Đợt không cho phép mở lại đề cương.");
  }

  private async authorized(
    s: ProposalVersionSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    action: ProposalLifecycleAction,
  ) {
    if (action === "withdraw") {
      if (
        !this.review.role(u, "STUDENT", "submit") ||
        !u.student?.isActive ||
        u.student.id !== p.studentId
      )
        return false;
      this.review.ownership(p);
      return true;
    }
    const permission = action === "reopen" ? "reopen" : "assign";
    const department =
      p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
        ?.departmentId;
    if (!department || !this.review.role(u, "FACULTY", permission))
      return false;
    const [grant] = await s.grants(u.id, p.topic.termId);
    return (
      !!grant &&
      (grant.allDepartments ||
        grant.pr2bGrantDepartmentGrantId.some(
          (d) => d.departmentId === department,
        ))
    );
  }

  private async load(
    s: ProposalVersionSession,
    userId: string,
    proposalId: string,
    action: ProposalLifecycleAction,
  ) {
    const u = this.review.principal(await s.principal(userId)),
      p = await s.proposal(proposalId);
    if (!p || !(await this.authorized(s, u, p, action)))
      groupError(
        404,
        "COMMON_001",
        "Không tìm thấy đề cương trong quyền thao tác.",
      );
    return { u, p };
  }

  // Used by both GET capabilities and POST guards. Reading never changes workflow state.
  private async inspect(
    s: ProposalVersionSession,
    p: ReviewProposal,
    action: ProposalLifecycleAction,
  ) {
    this.review.state(
      [
        action === "withdraw"
          ? "SUBMITTED"
          : action === "return-to-draft"
            ? "UNDER_REVIEW"
            : "APPROVED",
      ],
      p.status,
    );
    const w = p.pr2bProposalWorkflowProposalId;
    if (!w?.submittedVersionId || !w.nextVersionNumber || !w.nextReviewRound)
      groupError(
        409,
        "INPUT_NOT_READY",
        "Thiếu snapshot/counter đề cương từ producer.",
      );
    if (w.workingVersionId !== w.submittedVersionId)
      groupError(
        409,
        "STALE_VERSION",
        "Bản làm việc không khớp bản đã nộp; cần đối soát trước khi đổi trạng thái.",
      );
    const { assignment } = await this.review.advisor(s, p);
    const version = w.refSubmittedVersionId,
      meta = version?.pr2bProposalVersionWorkflowVersionId;
    // Reopening/withdrawing must remain possible after a handover invalidates Topic agreement.
    // A new submit still requires the current advisor's renewed agreement.
    if (
      !version ||
      version.proposalId !== p.id ||
      meta?.state !== "SEALED" ||
      meta.contentSchemaVersion !== 1 ||
      !meta.submittedAt ||
      meta.submittedAt > new Date() ||
      meta.submittedByUserId !== p.student.userId
    )
      groupError(
        409,
        "INPUT_NOT_READY",
        "Thiếu phiên bản đã nộp SEALED hợp lệ.",
      );
    if (reviewHash(version.content) !== meta.contentHash)
      groupError(409, "STALE_VERSION", "Hash phiên bản đã nộp không hợp lệ.");
    if (p.reviews.some((r) => !r.pr2bProposalReviewWorkflowReviewId?.state))
      groupError(409, "INPUT_NOT_READY", "Vòng duyệt legacy cần đối soát.");
    const active = p.reviews.filter((r) =>
      ["ASSIGNED", "IN_REVIEW"].includes(
        r.pr2bProposalReviewWorkflowReviewId!.state!,
      ),
    );
    const expectedState = action === "withdraw" ? "ASSIGNED" : "IN_REVIEW";
    if (
      active.length > 1 ||
      (action === "reopen" && active.length) ||
      (action === "return-to-draft" && active.length !== 1) ||
      active.some(
        (r) =>
          r.pr2bProposalReviewWorkflowReviewId!.state !== expectedState ||
          r.pr2bProposalReviewWorkflowReviewId!.versionId !== version.id,
      )
    )
      groupError(
        409,
        "ACTIVE_REVIEW_EXISTS",
        "Vòng duyệt hiện hành không phù hợp thao tác.",
      );
    let approvalDecisionId: string | null = null;
    if (action === "reopen") {
      const rounds = await s.history(p.id);
      const latest = rounds
        .filter(
          (r) => r.pr2bProposalReviewWorkflowReviewId?.state !== "SUPERSEDED",
        )
        .sort(
          (a, b) =>
            (b.pr2bProposalReviewWorkflowReviewId?.roundNumber ?? 0) -
            (a.pr2bProposalReviewWorkflowReviewId?.roundNumber ?? 0),
        )[0];
      if (
        !latest ||
        latest.pr2bProposalReviewWorkflowReviewId?.state !== "DECIDED" ||
        latest.pr2bProposalReviewWorkflowReviewId.versionId !== version.id ||
        latest.pr2bProposalReviewDecisionReviewId?.versionId !== version.id ||
        latest.pr2bProposalReviewDecisionReviewId.decision !== "APPROVED" ||
        latest.pr2bProposalReviewDecisionReviewId.decidedAt > new Date() ||
        latest.reviewGroup.termId !== p.topic.termId
      )
        groupError(
          409,
          "INPUT_NOT_READY",
          "Thiếu quyết định duyệt đúng phiên bản đã nộp.",
        );
      approvalDecisionId = latest.pr2bProposalReviewDecisionReviewId.id;
    }
    const dossier = await s.dossier(p.id),
      d = dossier?.pr2bDossierWorkflowDossierId;
    if (dossier) {
      if (
        !d?.state ||
        !["DRAFT", "REOPENED", "FINALIZED", "RECEIVED"].includes(d.state)
      )
        groupError(409, "DOSSIER_LOCKED", "Hồ sơ legacy cần đối soát.");
      const current = dossier.pr2bDossierFinalizationDossierId.filter(
        (f) => !f.supersededAt,
      );
      if (
        current.length !== (d.currentFinalizationId ? 1 : 0) ||
        current.some(
          (f) =>
            f.id !== d.currentFinalizationId ||
            f.proposalId !== p.id ||
            f.versionId !== version.id ||
            !f.printSnapshot ||
            !f.finalizedByUserId ||
            f.finalizedAt > new Date() ||
            reviewHash(f.printSnapshot) !== f.contentHash ||
            (action === "reopen" &&
              f.approvalDecisionId !== approvalDecisionId),
        ) ||
        (["FINALIZED", "RECEIVED"].includes(d.state) &&
          !d.currentFinalizationId)
      )
        groupError(
          409,
          "STALE_FINALIZATION",
          "Bản chốt hiện hành cần đối soát.",
        );
      if (
        action !== "reopen" &&
        (d.currentFinalizationId || !["DRAFT", "REOPENED"].includes(d.state))
      )
        groupError(409, "DOSSIER_LOCKED", "Hồ sơ đã chốt; cần Khoa mở lại.");
    }
    const plan = await s.planFor(p.id),
      planMeta = plan?.pr2bGuidancePlanWorkflowPlanId;
    if (
      plan &&
      (action !== "reopen" ||
        !planMeta ||
        planMeta.proposalId !== p.id ||
        !["ACTIVE", "PAUSED"].includes(planMeta.state ?? "") ||
        (planMeta.state === "ACTIVE" &&
          (!d?.currentFinalizationId ||
            planMeta.finalizationId !== d.currentFinalizationId)))
    )
      groupError(
        409,
        "INPUT_NOT_READY",
        "Kế hoạch hướng dẫn cần đối soát trước khi mở lại.",
      );
    return { w, version, assignment, active: active[0] ?? null, dossier, plan };
  }

  async context(
    s: ProposalVersionSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
  ): Promise<ProposalLifecycleContext> {
    const result: ProposalLifecycleContext = {
      allowedActions: [],
      reviewId: null,
      reviewRevision: null,
      dossierRevision: null,
      readiness: [],
    };
    const candidate: ProposalLifecycleAction | null =
      p.status === "SUBMITTED"
        ? "withdraw"
        : p.status === "UNDER_REVIEW"
          ? "return-to-draft"
          : p.status === "APPROVED"
            ? "reopen"
            : null;
    if (!candidate || !(await this.authorized(s, u, p, candidate)))
      return result;
    try {
      await this.phase(s, p.topic.termId, candidate);
      const state = await this.inspect(s, p, candidate);
      result.allowedActions.push(candidate);
      result.reviewId = state.active?.id ?? null;
      result.reviewRevision =
        state.active?.pr2bProposalReviewWorkflowReviewId?.revision ?? null;
      result.dossierRevision =
        state.dossier?.pr2bDossierWorkflowDossierId?.revision ?? null;
    } catch (e) {
      if (!(e instanceof HttpException)) throw e;
      result.readiness.push(
        (e.getResponse() as { error?: { code?: string } }).error?.code ??
          "INPUT_NOT_READY",
      );
    }
    return result;
  }

  async transition(
    userId: string,
    proposalId: string,
    action: ProposalLifecycleAction,
    input: Input,
    key: string,
  ): Promise<ProposalLifecycleView> {
    if (!key || key.length > 200 || !/^[\w.-]+$/.test(key))
      groupError(400, "COMMON_003", "Thiếu hoặc sai Idempotency-Key.");
    return this.repo.transaction(async (s) => {
      let { u, p } = await this.load(s, userId, proposalId, action);
      await s.lock(
        p.topic.termId,
        p.reviews.map((r) => r.reviewGroupId),
        p.id,
      );
      ({ u, p } = await this.load(s, userId, proposalId, action));
      const route = `/proposals/${proposalId}/${action}`,
        hash = reviewHash(input);
      const replay = await s.replay(u.id, route, key);
      if (replay) {
        if (replay.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa gửi lại có nội dung khác.",
          );
        return replay.result as unknown as ProposalLifecycleView;
      }
      await this.phase(s, p.topic.termId, action);
      const state = await this.inspect(s, p, action),
        { w, version, active, dossier, plan } = state;
      this.review.revision(w.revision, input.expectedProposalRevision);
      if (input.versionId !== version.id)
        groupError(409, "STALE_VERSION", "Phiên bản đã nộp đã đổi.");
      if (action !== "reopen") {
        const request = input as ProposalWithdraw;
        if ((request.reviewId ?? null) !== (active?.id ?? null))
          groupError(
            409,
            "REVISION_CONFLICT",
            "Vòng duyệt đã thay đổi. Hãy tải lại.",
          );
        if (active) {
          this.review.revision(
            active.pr2bProposalReviewWorkflowReviewId!.revision,
            request.expectedReviewRevision!,
          );
          const changed = await s.advanceReview(
            active.id,
            request.expectedReviewRevision!,
            { state: "SUPERSEDED" },
          );
          if (changed.count !== 1)
            groupError(409, "REVISION_CONFLICT", "Vòng duyệt đã thay đổi.");
        }
      } else {
        const expected = (input as ProposalReopen).expectedDossierRevision;
        if (dossier)
          this.review.revision(
            dossier.pr2bDossierWorkflowDossierId!.revision,
            expected!,
          );
        else if (expected !== undefined)
          groupError(409, "STALE_FINALIZATION", "Hồ sơ đã thay đổi.");
      }
      const reason = input.reason ?? "Sinh viên rút đề cương để chỉnh sửa.",
        now = new Date();
      if (action === "reopen" && dossier)
        await s.reopenDossier(
          dossier.id,
          dossier.pr2bDossierWorkflowDossierId!.revision,
          dossier.pr2bDossierWorkflowDossierId!.currentFinalizationId,
          u.id,
          reason,
          now,
        );
      if (action === "reopen" && plan)
        await s.pausePlan(
          plan.id,
          plan.pr2bGuidancePlanWorkflowPlanId!.revision,
          u.id,
          reason,
          json({
            proposalId,
            reason,
            oldState: plan.pr2bGuidancePlanWorkflowPlanId!.state,
            finalizationId: plan.pr2bGuidancePlanWorkflowPlanId!.finalizationId,
            assignmentId: plan.pr2bGuidancePlanWorkflowPlanId!.assignmentId,
          }),
        );
      // Keep the SEALED source pointer; only a subsequent save appends a new DRAFT snapshot.
      const changed = await s.advance(p.id, w.revision, {
        workingVersionId: version.id,
      });
      if (changed.count !== 1)
        groupError(409, "REVISION_CONFLICT", "Đề cương đã thay đổi.");
      await s.status(p.id, "DRAFT");
      const result: ProposalLifecycleView = {
        proposalId,
        status: "DRAFT",
        revision: w.revision + 1,
        workingVersionId: version.id,
        submittedVersionId: version.id,
        supersededReviewId: active?.id ?? null,
        reopenedDossierId: action === "reopen" ? (dossier?.id ?? null) : null,
        pausedPlanId: action === "reopen" ? (plan?.id ?? null) : null,
      };
      const event =
        action === "withdraw"
          ? "PROPOSAL_WITHDRAWN"
          : action === "return-to-draft"
            ? "PROPOSAL_RETURNED_TO_DRAFT"
            : "PROPOSAL_REOPENED";
      await s.versionAudit(
        u.id,
        p.id,
        event,
        json({
          status: p.status,
          revision: w.revision,
          workingVersionId: w.workingVersionId,
        }),
        json({
          ...result,
          reason,
          versionId: version.id,
          contentHash:
            version.pr2bProposalVersionWorkflowVersionId!.contentHash,
        }),
      );
      if (active)
        await s.audit(
          u.id,
          active.id,
          "SUPERSEDED",
          json({ state: active.pr2bProposalReviewWorkflowReviewId!.state }),
          json({ reason, action, proposalId, versionId: version.id }),
        );
      await s.outbox({
        eventId: randomUUID(),
        aggregateId: p.id,
        type: event,
        payload: json({
          ...result,
          reason,
          actorUserId: u.id,
          termId: p.topic.termId,
          studentUserId: p.student.userId,
          advisorUserId: state.assignment.advisor.userId,
        }),
      });
      for (const recipient of new Set([
        p.student.userId,
        state.assignment.advisor.userId,
      ]))
        await s.notify({
          userId: recipient,
          termId: p.topic.termId,
          title:
            action === "withdraw"
              ? "Đề cương đã được rút về nháp"
              : action === "return-to-draft"
                ? "Khoa đã trả đề cương về nháp"
                : "Khoa đã mở lại đề cương",
          body: reason,
          link: `/topic/proposal/${p.id}`,
        });
      await this.phase(s, p.topic.termId, action);
      await s.remember(u.id, route, key, hash, json(result));
      return result;
    }, true);
  }
}
