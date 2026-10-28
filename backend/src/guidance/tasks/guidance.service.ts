import { Injectable, HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  GuidanceContext,
  GuidancePlanView,
  GuidanceTaskView,
  GuidanceTaskQuery,
  GuidancePlanCreate,
  GuidancePlanUpdate,
  GuidancePlanResume,
  GuidanceTaskCreate,
  GuidanceTaskUpdate,
  GuidanceTaskCancel,
  GuidanceTaskProgress,
  WeeklyCoverageRow,
} from "@doan/shared";
import {
  GuidanceRepository,
  GuidanceSession,
  GuidancePlanRecord,
  GuidanceTaskRecord,
  ObligationRecord,
} from "./guidance.repository";
import { GuidanceValidator } from "./guidance.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import type {
  ReviewProposal,
  ReviewPrincipal,
} from "../../topic/proposal-reviews/proposal-review.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Aggregate = {
  p: ReviewProposal;
  plan?: GuidancePlanRecord | null;
  task?: GuidanceTaskRecord;
  obligation?: ObligationRecord;
};
@Injectable()
export class GuidanceService {
  constructor(
    private readonly repo: GuidanceRepository,
    private readonly v: GuidanceValidator,
    private readonly review: ProposalReviewValidator,
  ) {}
  private async proposal(s: GuidanceSession, id: string) {
    const p = await s.proposal(id);
    if (!p) groupError(404, "COMMON_001", "Không tìm thấy hồ sơ hướng dẫn.");
    return p;
  }
  private async fromPlan(s: GuidanceSession, id: string): Promise<Aggregate> {
    const plan = await s.plan(id);
    if (!plan) groupError(404, "COMMON_001", "Không tìm thấy kế hoạch.");
    return { p: await this.proposal(s, plan.proposalId), plan };
  }
  private async fromTask(s: GuidanceSession, id: string): Promise<Aggregate> {
    const task = await s.task(id);
    if (!task) groupError(404, "COMMON_001", "Không tìm thấy nhiệm vụ.");
    return {
      p: await this.proposal(s, task.guidancePlan.proposalId),
      plan: task.guidancePlan,
      task,
    };
  }
  private async fromObligation(
    s: GuidanceSession,
    id: string,
  ): Promise<Aggregate> {
    const obligation = await s.obligation(id);
    if (!obligation)
      groupError(404, "COMMON_001", "Không tìm thấy nghĩa vụ tuần.");
    const owner = await s.ownerProposal(obligation.termStudentId),
      p = owner?.refTopicId.proposals.find(
        (p) => p.studentId === owner.refTermStudentId?.studentId,
      );
    if (!p)
      groupError(404, "COMMON_001", "Không tìm thấy hồ sơ của nghĩa vụ tuần.");
    const plan = obligation.planId
      ? await s.plan(obligation.planId)
      : await s.planFor(p.id);
    if (plan && plan.proposalId !== p.id)
      groupError(409, "INPUT_NOT_READY", "Nghĩa vụ không khớp owner kế hoạch.");
    return { p, plan, obligation };
  }
  private async can(
    s: GuidanceSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    resource: string,
    action: string,
  ) {
    if (
      ((resource === "guidance" && action === "read") ||
        (resource === "submission" && ["read", "download"].includes(action))) &&
      this.v.role(u, "FACULTY", resource, action)
    ) {
      const dept =
          p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
            ?.departmentId,
        [g] = await s.grants(u.id, p.topic.termId);
      if (
        dept &&
        g &&
        (g.allDepartments ||
          g.pr2bGrantDepartmentGrantId.some((d) => d.departmentId === dept))
      )
        return true;
    }
    if (
      (action === "read" ||
        (resource === "submission" &&
          ["create", "download"].includes(action)) ||
        action === "progress" ||
        action === "ensure-weekly") &&
      this.v.role(u, "STUDENT", resource, action) &&
      u.student?.isActive &&
      u.student.id === p.studentId
    ) {
      this.review.ownership(p);
      return true;
    }
    if (
      action !== "progress" &&
      action !== "create" &&
      this.v.role(u, "LECTURER", resource, action) &&
      u.lecturer?.isActive
    ) {
      const registration = await s.advisor(p.topic.termId, p.studentId);
      if (registration?.advisorAssignment?.advisorId === u.lecturer.id)
        try {
          await this.review.advisor(s, p);
          return true;
        } catch (e) {
          if (!(e instanceof HttpException)) throw e;
        }
    }
    return false;
  }
  private async access(
    s: GuidanceSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    resource: string,
    action: string,
  ) {
    if (!(await this.can(s, u, p, resource, action)))
      groupError(
        404,
        "COMMON_001",
        "Không tìm thấy tài nguyên hướng dẫn trong phạm vi.",
      );
  }
  // Reuse the same parent identity/roster/grant/official-advisor rules for 8B.
  async submissionAccess(
    s: GuidanceSession,
    userId: string,
    taskId: string,
    action: "read" | "create" | "download",
  ) {
    const u = this.review.principal(await s.principal(userId)),
      a = await this.fromTask(s, taskId);
    await this.access(s, u, a.p, "submission", action);
    return { u, t: a.task!, p: a.p, plan: a.plan! };
  }
  async reviewAccess(s: GuidanceSession, userId: string, taskId: string) {
    const u = this.review.principal(await s.principal(userId)),
      a = await this.fromTask(s, taskId);
    await this.access(s, u, a.p, "task", "review");
    return { u, t: a.task!, p: a.p, plan: a.plan! };
  }
  async planAccess(
    s: GuidanceSession,
    userId: string,
    planId: string,
    action: "read" | "manage",
  ) {
    const u = this.review.principal(await s.principal(userId)),
      a = await this.fromPlan(s, planId);
    await this.access(s, u, a.p, "guidance", action);
    return { u, p: a.p, plan: a.plan! };
  }
  private async scopedWhere(
    s: GuidanceSession,
    u: ReviewPrincipal,
    termId: string,
  ): Promise<Prisma.ProposalWhereInput> {
    const clauses: Prisma.ProposalWhereInput[] = [];
    if (this.v.role(u, "FACULTY", "guidance", "read")) {
      const [g] = await s.grants(u.id, termId);
      if (g && (g.allDepartments || g.pr2bGrantDepartmentGrantId.length))
        clauses.push({
          topic: {
            researchArea: {
              pr2bResearchAreaWorkflowResearchAreaId: {
                is: {
                  departmentId: g.allDepartments
                    ? { not: null }
                    : {
                        in: g.pr2bGrantDepartmentGrantId.map(
                          (d) => d.departmentId,
                        ),
                      },
                },
              },
            },
          },
        });
    }
    if (this.v.role(u, "STUDENT", "guidance", "read") && u.student?.isActive)
      clauses.push({
        studentId: u.student.id,
        topic: {
          pr2bTopicWorkflowTopicId: {
            is: {
              termId,
              refTermStudentId: { is: { termId, studentId: u.student.id } },
            },
          },
        },
      });
    const officialId = (await s.term(termId))?.pr2bTermWorkflowTermId
      ?.officialAssignmentPlanId;
    if (
      officialId &&
      this.v.role(u, "LECTURER", "guidance", "read") &&
      u.lecturer?.isActive &&
      (await s.roster(termId, u.lecturer.id))
    )
      clauses.push({
        student: {
          registrations: {
            some: {
              termId,
              advisorAssignments: {
                some: {
                  advisorId: u.lecturer.id,
                  assignmentPlanId: officialId,
                  advisor: { isActive: true },
                  assignmentPlan: {
                    status: "FINALIZED",
                    pr2bAssignmentPlanWorkflowPlanId: {
                      is: {
                        finalizedAt: { not: null },
                        finalizedByUserId: { not: null },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    if (!clauses.length)
      groupError(
        404,
        "COMMON_001",
        "Không tìm thấy đợt hướng dẫn trong phạm vi.",
      );
    return { topic: { termId }, OR: clauses };
  }
  private async availability(
    s: GuidanceSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    plan: GuidancePlanRecord,
  ) {
    const actions: GuidancePlanView["allowedActions"] = [],
      readiness: string[] = [];
    try {
      await this.v.active(s, p, plan);
      if (await this.can(s, u, p, "task", "manage"))
        actions.push("create-task");
      if (await this.can(s, u, p, "guidance", "manage")) actions.push("update");
    } catch (e) {
      if (!(e instanceof HttpException)) throw e;
      readiness.push(
        (e.getResponse() as { error?: { code?: string } }).error?.code ??
          "INPUT_NOT_READY",
      );
    }
    if (
      plan.pr2bGuidancePlanWorkflowPlanId?.state === "PAUSED" &&
      (await this.can(s, u, p, "guidance", "manage"))
    )
      try {
        await this.v.phase(s, p.topic.termId);
        await this.v.finalized(s, p);
        await this.v.official(s, p);
        actions.push("resume");
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
      }
    return { actions, readiness };
  }
  private async planView(
    s: GuidanceSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    plan: GuidancePlanRecord,
  ): Promise<GuidancePlanView> {
    const w = plan.pr2bGuidancePlanWorkflowPlanId,
      a = await this.availability(s, u, p, plan),
      registration = await s.advisor(p.topic.termId, p.studentId);
    return {
      id: plan.id,
      proposalId: p.id,
      termId: p.topic.termId,
      termStudentId: p.topic.pr2bTopicWorkflowTopicId?.termStudentId ?? "",
      studentName: p.student.fullName,
      studentCode: p.student.studentCode,
      topicTitle: p.topic.title,
      advisorId: plan.advisorId,
      currentAdvisorId: registration?.advisorAssignment?.advisorId ?? null,
      state: w?.state ?? null,
      revision: w?.revision ?? 0,
      description: plan.description,
      finalizationId: w?.finalizationId ?? null,
      assignmentId: w?.assignmentId ?? null,
      assignmentRevision: w?.assignmentRevision ?? null,
      allowedActions: a.actions,
      readiness: a.readiness,
    };
  }
  async context(userId: string, proposalId: string): Promise<GuidanceContext> {
    return this.repo.transaction(async (s) => {
      const u = this.review.principal(await s.principal(userId)),
        p = await this.proposal(s, proposalId);
      await this.access(s, u, p, "guidance", "read");
      const plan = await s.planFor(p.id),
        d = await s.dossier(p.id),
        phase = await s.guidancePhase(p.topic.termId),
        periods = await s.periods(p.topic.termId),
        readiness: string[] = [];
      let canCreate = false;
      if (!plan && (await this.can(s, u, p, "guidance", "manage")))
        try {
          await this.v.phase(s, p.topic.termId);
          await this.v.finalized(s, p);
          await this.v.official(s, p);
          canCreate = true;
        } catch (e) {
          if (!(e instanceof HttpException)) throw e;
          readiness.push(
            (e.getResponse() as { error?: { code?: string } }).error?.code ??
              "INPUT_NOT_READY",
          );
        }
      return {
        proposalId: p.id,
        termId: p.topic.termId,
        title: p.topic.title,
        studentName: p.student.fullName,
        studentCode: p.student.studentCode,
        plan: plan ? await this.planView(s, u, p, plan) : null,
        currentFinalizationId:
          d?.pr2bDossierWorkflowDossierId?.currentFinalizationId ?? null,
        dossierRevision: d?.pr2bDossierWorkflowDossierId?.revision ?? 0,
        canCreate,
        readiness,
        phase: phase
          ? {
              startsAt: phase.refPhaseId.startDate.toISOString(),
              endsAt: phase.refPhaseId.endDate.toISOString(),
              isLocked: phase.refPhaseId.isLocked,
            }
          : null,
        periods: periods.map((p) => ({
          id: p.id,
          termId: p.termId,
          ordinal: p.ordinal,
          label: p.label,
          type: p.type,
          startsAt: p.startsAt.toISOString(),
          endsAt: p.endsAt.toISOString(),
          reportDueAt: p.reportDueAt?.toISOString() ?? null,
          revision: p.revision,
        })),
      };
    });
  }
  async planByProposal(userId: string, proposalId: string) {
    const c = await this.context(userId, proposalId);
    if (!c.plan) groupError(404, "COMMON_001", "Chưa có kế hoạch hướng dẫn.");
    return c.plan;
  }
  async periodOptions(userId: string, termId: string) {
    return this.repo.transaction(async (s) => {
      const u = this.review.principal(await s.principal(userId));
      await this.scopedWhere(s, u, termId);
      return (await s.periods(termId)).map((p) => ({
        id: p.id,
        termId: p.termId,
        ordinal: p.ordinal,
        label: p.label,
        type: p.type,
        startsAt: p.startsAt.toISOString(),
        endsAt: p.endsAt.toISOString(),
        reportDueAt: p.reportDueAt?.toISOString() ?? null,
        revision: p.revision,
      }));
    });
  }
  private async command<T>(
    userId: string,
    method: string,
    route: string,
    key: string,
    input: unknown,
    resource: string,
    action: string,
    load: (s: GuidanceSession) => Promise<Aggregate>,
    work: (s: GuidanceSession, u: ReviewPrincipal, a: Aggregate) => Promise<T>,
  ): Promise<T> {
    if (!key || key.length > 200 || !/^[\w.-]+$/.test(key))
      groupError(400, "COMMON_003", "Thiếu hoặc sai Idempotency-Key.");
    return this.repo.transaction(async (s) => {
      let u = this.review.principal(await s.principal(userId)),
        a = await load(s);
      await this.access(s, u, a.p, resource, action);
      await s.lock(a.p.topic.termId, [], a.p.id);
      await s.lockAggregate(
        a.plan?.id,
        a.obligation?.id ??
          a.task?.pr2bTaskWorkflowTaskId?.obligationId ??
          undefined,
        a.task?.id,
      );
      u = this.review.principal(await s.principal(userId));
      a = await load(s);
      await this.access(s, u, a.p, resource, action);
      const hash = reviewHash(input),
        old = await s.guidanceReplay(u.id, method, route, key);
      if (old) {
        if (old.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa đã dùng với dữ liệu khác.",
          );
        return old.result as unknown as T;
      }
      await this.v.phase(s, a.p.topic.termId);
      const result = await work(s, u, a);
      await this.v.phase(s, a.p.topic.termId);
      await s.guidanceRemember(u.id, method, route, key, hash, json(result));
      return result;
    }, true);
  }
  private async evidence(
    s: GuidanceSession,
    actorId: string,
    id: string,
    action: string,
    snapshot: unknown,
    reason = action,
    task = false,
  ) {
    if (task)
      await s.taskHistory({
        taskId: id,
        actorId,
        reason,
        snapshot: json(snapshot),
      });
    else
      await s.planHistory({
        planId: id,
        actorId,
        reason,
        action,
        snapshot: json(snapshot),
      });
    await s.guidanceAudit(
      actorId,
      id,
      action,
      json({ historyHash: reviewHash(snapshot), action }),
    );
  }
  async createPlan(
    userId: string,
    proposalId: string,
    input: GuidancePlanCreate,
    key: string,
  ) {
    return this.command(
      userId,
      "POST",
      `/proposals/${proposalId}/guidance-plan`,
      key,
      input,
      "guidance",
      "manage",
      async (s) => ({
        p: await this.proposal(s, proposalId),
        plan: await s.planFor(proposalId),
      }),
      async (s, u, a) => {
        if (a.plan)
          groupError(
            409,
            "PLAN_ALREADY_EXISTS",
            "Hồ sơ đã có kế hoạch hướng dẫn.",
          );
        const final = await this.v.finalized(s, a.p),
          official = await this.v.official(s, a.p),
          owner = this.review.ownership(a.p);
        this.review.revision(final.w.revision, input.expectedDossierRevision);
        if (final.f.id !== input.finalizationId)
          groupError(409, "STALE_FINALIZATION", "Bản chốt hiện hành đã đổi.");
        const plan = await s.addPlan({
          proposalId: a.p.id,
          advisorId: official.assignment.advisorId,
          description: input.description || null,
          pr2bGuidancePlanWorkflowPlanId: {
            create: {
              state: "ACTIVE",
              proposalId: a.p.id,
              finalizationId: final.f.id,
              assignmentId: official.assignment.id,
              assignmentRevision: official.revision,
            },
          },
        });
        await s.linkObligations(owner.termStudentId!, plan.id);
        await this.evidence(s, u.id, plan.id, "PLAN_CREATED", {
          proposalId: a.p.id,
          finalizationId: final.f.id,
          assignmentId: official.assignment.id,
          assignmentRevision: official.revision,
        });
        return this.planView(s, u, a.p, plan);
      },
    );
  }
  async updatePlan(
    userId: string,
    id: string,
    input: GuidancePlanUpdate,
    key: string,
  ) {
    return this.command(
      userId,
      "PATCH",
      `/guidance-plans/${id}`,
      key,
      input,
      "guidance",
      "manage",
      (s) => this.fromPlan(s, id),
      async (s, u, a) => {
        await this.v.active(s, a.p, a.plan!);
        this.review.revision(
          a.plan!.pr2bGuidancePlanWorkflowPlanId!.revision,
          input.expectedRevision,
        );
        await s.advancePlan(id, input.expectedRevision);
        await s.updatePlan(id, { description: input.description });
        await this.evidence(
          s,
          u.id,
          id,
          "PLAN_UPDATED",
          {
            changedFields: ["description"],
            revision: input.expectedRevision + 1,
          },
          input.reason,
        );
        return this.planView(s, u, a.p, (await s.plan(id))!);
      },
    );
  }
  async resume(
    userId: string,
    id: string,
    input: GuidancePlanResume,
    key: string,
  ) {
    return this.command(
      userId,
      "POST",
      `/guidance-plans/${id}/resume`,
      key,
      input,
      "guidance",
      "manage",
      (s) => this.fromPlan(s, id),
      async (s, u, a) => {
        const w = a.plan!.pr2bGuidancePlanWorkflowPlanId;
        if (!w || w.state !== "PAUSED")
          groupError(
            409,
            "STATE_TRANSITION_INVALID",
            "Chỉ xác nhận lại kế hoạch PAUSED.",
          );
        this.review.revision(w.revision, input.expectedRevision);
        const final = await this.v.finalized(s, a.p),
          official = await this.v.official(s, a.p);
        this.review.revision(final.w.revision, input.expectedDossierRevision);
        if (input.finalizationId !== final.f.id)
          groupError(409, "STALE_FINALIZATION", "Bản chốt hiện hành đã đổi.");
        await s.advancePlan(id, w.revision, {
          state: "ACTIVE",
          finalizationId: final.f.id,
          assignmentId: official.assignment.id,
          assignmentRevision: official.revision,
        });
        await s.updatePlan(id, { advisorId: official.assignment.advisorId });
        await this.evidence(s, u.id, id, "PLAN_RESUMED", {
          oldFinalizationId: w.finalizationId,
          finalizationId: final.f.id,
          oldAssignmentRevision: w.assignmentRevision,
          assignmentRevision: official.revision,
          acknowledgeRebase: true,
        });
        return this.planView(s, u, a.p, (await s.plan(id))!);
      },
    );
  }
  private async taskView(
    s: GuidanceSession,
    u: ReviewPrincipal,
    a: Aggregate,
    t: GuidanceTaskRecord,
  ): Promise<GuidanceTaskView> {
    const w = t.pr2bTaskWorkflowTaskId,
      allowedActions: GuidanceTaskView["allowedActions"] = [];
    try {
      await this.v.active(s, a.p, t.guidancePlan);
      const ready =
        w?.startsAt &&
        w.expectedDeliverables !== null &&
        w.kind &&
        w.planId === t.guidancePlanId &&
        w.periodId;
      if (
        ready &&
        (await this.can(s, u, a.p, "task", "manage")) &&
        w?.state &&
        !["COMPLETED", "CANCELLED"].includes(w.state)
      )
        allowedActions.push("update", "cancel");
      if (
        ready &&
        (await this.can(s, u, a.p, "task", "progress")) &&
        w?.state &&
        ["TODO", "IN_PROGRESS", "REVISION_REQUESTED"].includes(w.state)
      )
        allowedActions.push("progress");
    } catch (e) {
      if (!(e instanceof HttpException)) throw e;
    }
    return {
      id: t.id,
      planId: t.guidancePlanId,
      proposalId: a.p.id,
      termId: a.p.topic.termId,
      termStudentId: a.p.topic.pr2bTopicWorkflowTopicId?.termStudentId ?? "",
      studentName: a.p.student.fullName,
      studentCode: a.p.student.studentCode,
      topicTitle: a.p.topic.title,
      advisorId: w?.assignedAdvisorId ?? t.guidancePlan.advisorId,
      periodId: w?.periodId ?? null,
      periodLabel: w?.refPeriodId?.label ?? null,
      kind: w?.kind ?? null,
      title: t.title,
      description: t.description,
      expectedDeliverables: w?.expectedDeliverables ?? null,
      startDate: w?.startsAt?.toISOString() ?? null,
      dueDate: t.deadline.toISOString(),
      status: w?.state ?? null,
      revision: w?.revision ?? 0,
      isOverdue: this.v.overdue(t.deadline, w?.state ?? null),
      hasSubmissions: t.submissions.length > 0,
      allowedActions,
      progress: t.pr2bTaskProgressEventTaskId.map((e) => ({
        id: e.id,
        note: e.note,
        actorId: e.actorId,
        createdAt: e.createdAt.toISOString(),
      })),
      history: t.pr2bTaskHistoryTaskId.map((e) => ({
        id: e.id,
        reason: e.reason,
        actorId: e.actorId,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
  async detailTask(userId: string, id: string) {
    return this.repo.transaction(async (s) => {
      const u = this.review.principal(await s.principal(userId)),
        a = await this.fromTask(s, id);
      await this.access(s, u, a.p, "guidance", "read");
      return this.taskView(s, u, a, a.task!);
    });
  }
  private filter(q: GuidanceTaskQuery): Prisma.TaskWhereInput {
    const now = new Date(),
      overdue: Prisma.TaskWhereInput = {
        deadline: { lt: now },
        pr2bTaskWorkflowTaskId: {
          is: { state: { notIn: ["COMPLETED", "CANCELLED"] } },
        },
      };
    return {
      AND: [
        {
          pr2bTaskWorkflowTaskId: {
            is: { state: q.status ?? { not: null }, periodId: q.periodId },
          },
        },
        ...(q.search
          ? [
              {
                OR: [
                  {
                    title: { contains: q.search, mode: "insensitive" as const },
                  },
                  {
                    description: {
                      contains: q.search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            ]
          : []),
        ...(q.isOverdue
          ? [q.isOverdue === "true" ? overdue : { NOT: overdue }]
          : []),
      ],
    };
  }
  async tasks(
    userId: string,
    q: GuidanceTaskQuery,
    scope: { planId?: string; termId?: string },
  ) {
    return this.repo.transaction(async (s) => {
      const u = this.review.principal(await s.principal(userId));
      let base: Prisma.TaskWhereInput;
      if (scope.planId) {
        const a = await this.fromPlan(s, scope.planId);
        await this.access(s, u, a.p, "guidance", "read");
        base = { guidancePlanId: scope.planId };
      } else {
        const where = await this.scopedWhere(s, u, scope.termId!);
        base = {
          guidancePlan: {
            pr2bGuidancePlanWorkflowPlanId: { is: { refProposalId: where } },
          },
        };
      }
      const where = { AND: [base, this.filter(q)] },
        rows = await s.tasks(where, (q.page - 1) * q.limit, q.limit),
        total = await s.taskCount(where),
        overdueTotal = await s.taskCount({
          AND: [
            where,
            {
              deadline: { lt: new Date() },
              pr2bTaskWorkflowTaskId: {
                is: { state: { notIn: ["COMPLETED", "CANCELLED"] } },
              },
            },
          ],
        });
      const data: GuidanceTaskView[] = [];
      for (const t of rows) {
        const p =
          t.guidancePlan.pr2bGuidancePlanWorkflowPlanId?.refProposalId ??
          (await this.proposal(s, t.guidancePlan.proposalId));
        await this.access(s, u, p, "guidance", "read");
        data.push(
          await this.taskView(s, u, { p, plan: t.guidancePlan, task: t }, t),
        );
      }
      return {
        data,
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
        overdueTotal,
      };
    });
  }
  async createTask(
    userId: string,
    planId: string,
    input: GuidanceTaskCreate,
    key: string,
  ) {
    return this.command(
      userId,
      "POST",
      `/guidance-plans/${planId}/tasks`,
      key,
      input,
      "task",
      "manage",
      (s) => this.fromPlan(s, planId),
      async (s, u, a) => {
        const active = await this.v.active(s, a.p, a.plan!);
        this.review.revision(
          a.plan!.pr2bGuidancePlanWorkflowPlanId!.revision,
          input.expectedPlanRevision,
        );
        this.v.period(await s.period(input.periodId), a.p.topic.termId);
        this.v.dates(
          new Date(input.startDate),
          new Date(input.dueDate),
          await this.v.phase(s, a.p.topic.termId),
        );
        const task = await s.addTask({
          guidancePlanId: planId,
          title: input.title,
          description: input.description || null,
          deadline: new Date(input.dueDate),
          pr2bTaskWorkflowTaskId: {
            create: {
              planId,
              periodId: input.periodId,
              kind: "AD_HOC",
              state: "TODO",
              startsAt: new Date(input.startDate),
              expectedDeliverables: input.expectedDeliverables,
              createdByUserId: u.id,
              assignedAdvisorId: active.official.assignment.advisorId,
              nextSubmissionNumber: 1,
            },
          },
        });
        await s.advancePlan(planId, input.expectedPlanRevision);
        await this.evidence(
          s,
          u.id,
          task.id,
          "TASK_CREATED",
          {
            planId,
            periodId: input.periodId,
            assignedAdvisorId: active.official.assignment.advisorId,
            assignmentRevision: active.official.revision,
            title: input.title,
            startDate: input.startDate,
            dueDate: input.dueDate,
          },
          "TASK_CREATED",
          true,
        );
        await s.notify({
          userId: a.p.student.userId,
          termId: a.p.topic.termId,
          title: "Nhiệm vụ hướng dẫn mới",
          body: "GVHD đã giao một nhiệm vụ mới. Mở hồ sơ để xem yêu cầu và thời hạn.",
          link: `/guidance/tasks/${task.id}`,
        });
        return this.taskView(s, u, a, (await s.task(task.id))!);
      },
    );
  }
  async updateTask(
    userId: string,
    id: string,
    input: GuidanceTaskUpdate,
    key: string,
  ) {
    return this.command(
      userId,
      "PATCH",
      `/tasks/${id}`,
      key,
      input,
      "task",
      "manage",
      (s) => this.fromTask(s, id),
      async (s, u, a) => {
        await this.v.active(s, a.p, a.plan!);
        const t = a.task!,
          w = this.v.editable(t, input.acknowledgeExistingSubmissions);
        this.review.revision(w.revision, input.expectedRevision);
        if (
          w.kind === "WEEKLY_REPORT" &&
          (input.dueDate !== undefined ||
            input.startDate !== undefined ||
            input.expectedDeliverables !== undefined)
        )
          groupError(
            409,
            "WEEKLY_REQUIREMENT_IMMUTABLE",
            "Lịch/sản phẩm tuần phải sửa qua cấu hình nghĩa vụ, không sửa riêng task.",
          );
        const start = input.startDate ? new Date(input.startDate) : w.startsAt!,
          due = input.dueDate ? new Date(input.dueDate) : t.deadline;
        this.v.dates(start, due, await this.v.phase(s, a.p.topic.termId));
        await s.updateTask(id, {
          title: input.title,
          description: input.description,
          deadline: due,
        });
        await s.advanceTask(id, w.revision, {
          startsAt: start,
          expectedDeliverables: input.expectedDeliverables,
        });
        await this.evidence(
          s,
          u.id,
          id,
          "TASK_UPDATED",
          {
            old: {
              title: t.title,
              description: t.description,
              startDate: w.startsAt,
              dueDate: t.deadline,
              expectedDeliverables: w.expectedDeliverables,
            },
            changedFields: Object.keys(input).filter(
              (k) =>
                ![
                  "expectedRevision",
                  "reason",
                  "acknowledgeExistingSubmissions",
                ].includes(k),
            ),
            revision: w.revision + 1,
            acknowledgeExistingSubmissions:
              input.acknowledgeExistingSubmissions ?? false,
          },
          input.reason,
          true,
        );
        return this.taskView(s, u, a, (await s.task(id))!);
      },
    );
  }
  async progressTask(
    userId: string,
    id: string,
    input: GuidanceTaskProgress,
    key: string,
  ) {
    return this.command(
      userId,
      "POST",
      `/tasks/${id}/progress`,
      key,
      input,
      "task",
      "progress",
      (s) => this.fromTask(s, id),
      async (s, u, a) => {
        await this.v.active(s, a.p, a.plan!);
        const t = a.task!,
          w = this.v.progress(t);
        this.review.revision(w.revision, input.expectedRevision);
        await s.progress({ taskId: id, actorId: u.id, note: input.note });
        await s.advanceTask(id, w.revision, {
          state: w.state === "TODO" ? "IN_PROGRESS" : w.state,
        });
        if (w.state === "TODO")
          await s.updateTask(id, { status: "IN_PROGRESS" });
        await s.guidanceAudit(
          u.id,
          id,
          "TASK_PROGRESS",
          json({
            fromState: w.state,
            toState: w.state === "TODO" ? "IN_PROGRESS" : w.state,
            revision: w.revision + 1,
          }),
        );
        return this.taskView(s, u, a, (await s.task(id))!);
      },
    );
  }
  async cancelTask(
    userId: string,
    id: string,
    input: GuidanceTaskCancel,
    key: string,
  ) {
    return this.command(
      userId,
      "POST",
      `/tasks/${id}/cancel`,
      key,
      input,
      "task",
      "manage",
      (s) => this.fromTask(s, id),
      async (s, u, a) => {
        await this.v.active(s, a.p, a.plan!);
        const t = a.task!,
          w = this.v.editable(t, input.acknowledgeExistingSubmissions);
        this.review.revision(w.revision, input.expectedRevision);
        await s.advanceTask(id, w.revision, {
          state: "CANCELLED",
          cancellationReason: input.reason,
        });
        if (w.obligationId) {
          const o = await s.obligation(w.obligationId);
          if (o?.currentTaskId === id)
            await s.advanceObligation(o.id, o.revision, {
              currentTaskId: null,
            });
        }
        await this.evidence(
          s,
          u.id,
          id,
          "TASK_CANCELLED",
          {
            fromState: w.state,
            toState: "CANCELLED",
            revision: w.revision + 1,
            obligationId: w.obligationId,
            acknowledgeExistingSubmissions:
              input.acknowledgeExistingSubmissions ?? false,
          },
          input.reason,
          true,
        );
        return this.taskView(s, u, a, (await s.task(id))!);
      },
    );
  }
  async ensureWeekly(
    userId: string,
    id: string,
    input: { expectedObligationRevision: number; expectedPlanRevision: number },
    key: string,
  ) {
    return this.command(
      userId,
      "POST",
      `/weekly-report-obligations/${id}/task`,
      key,
      input,
      "task",
      "ensure-weekly",
      (s) => this.fromObligation(s, id),
      async (s, u, a) => {
        if (!a.plan)
          groupError(
            409,
            "REPORTING_SCOPE_NOT_CONFIGURED",
            "Chưa có kế hoạch hướng dẫn cho nghĩa vụ.",
          );
        const active = await this.v.active(s, a.p, a.plan),
          o = a.obligation!,
          owner = this.review.ownership(a.p),
          config = this.v.obligation(o, owner.termStudentId!, a.p.topic.termId);
        this.review.revision(o.revision, input.expectedObligationRevision);
        this.review.revision(
          a.plan.pr2bGuidancePlanWorkflowPlanId!.revision,
          input.expectedPlanRevision,
        );
        if (o.currentTaskId) {
          const t = await s.task(o.currentTaskId);
          if (
            t?.guidancePlanId === a.plan.id &&
            t.pr2bTaskWorkflowTaskId?.state !== "CANCELLED"
          )
            return this.taskView(s, u, a, t);
          groupError(
            409,
            "INPUT_NOT_READY",
            "Task tuần hiện hành không nhất quán.",
          );
        }
        this.v.dates(
          new Date(config.startsAt),
          new Date(config.reportDueAt),
          await this.v.phase(s, a.p.topic.termId),
        );
        const t = await s.addTask({
          guidancePlanId: a.plan.id,
          title: `Báo cáo ${o.refPeriodId.label}`,
          deadline: new Date(config.reportDueAt),
          pr2bTaskWorkflowTaskId: {
            create: {
              planId: a.plan.id,
              periodId: o.periodId,
              obligationId: o.id,
              kind: "WEEKLY_REPORT",
              state: "TODO",
              startsAt: new Date(config.startsAt),
              expectedDeliverables: config.expectedDeliverables,
              requirements: json([
                { kind: "REPORT", required: true },
                { kind: "SOURCE", required: true },
              ]),
              createdByUserId: u.id,
              assignedAdvisorId: active.official.assignment.advisorId,
              nextSubmissionNumber: 1,
            },
          },
        });
        await s.advanceObligation(o.id, o.revision, {
          planId: a.plan.id,
          currentTaskId: t.id,
        });
        await s.advancePlan(a.plan.id, input.expectedPlanRevision);
        await this.evidence(
          s,
          u.id,
          t.id,
          "WEEKLY_TASK_MATERIALIZED",
          {
            obligationId: o.id,
            periodId: o.periodId,
            configRevision: o.configRevision,
          },
          "WEEKLY_TASK_MATERIALIZED",
          true,
        );
        await s.notify({
          userId: a.p.student.userId,
          termId: a.p.topic.termId,
          title: "Nhiệm vụ báo cáo tuần",
          body: "Nhiệm vụ báo cáo tuần đã được tạo theo kế hoạch. Mở hồ sơ để xem yêu cầu và thời hạn.",
          link: `/guidance/tasks/${t.id}`,
        });
        return this.taskView(s, u, a, (await s.task(t.id))!);
      },
    );
  }
  async legacyTasks(userId: string, planId: string) {
    return this.repo.transaction(async (s) => {
      const u = this.review.principal(await s.principal(userId)),
        a = await this.fromPlan(s, planId);
      await this.access(s, u, a.p, "guidance", "read");
      return s.legacyTasks(planId);
    });
  }
  async coverage(userId: string, termId: string, q: GuidanceTaskQuery) {
    return this.repo.transaction(async (s) => {
      const u = this.review.principal(await s.principal(userId));
      await this.scopedWhere(s, u, termId);
      const pairs = await s.coveragePairs(termId),
        periods = (await s.periods(termId)).filter((p) => p.type === "WEEK"),
        rows: WeeklyCoverageRow[] = [],
        warnings: string[] = [];
      if (
        !periods.length ||
        !pairs.length ||
        periods.some(
          (period) => !pairs.some((pair) => pair.periodId === period.id),
        )
      )
        warnings.push("REPORTING_SCOPE_NOT_CONFIGURED");
      for (const pair of pairs) {
        const ts = pair.refTermStudentId,
          p = ts.pr2bTopicWorkflowTermStudentId?.refTopicId.proposals.find(
            (p) => p.studentId === ts.studentId,
          );
        if (pair.refPeriodId.termId !== termId || ts.termId !== termId)
          continue;
        const canRead = p
          ? await this.can(s, u, p, "guidance", "read")
          : (this.v.role(u, "STUDENT", "guidance", "read") &&
              u.student?.id === ts.studentId) ||
            (this.v.role(u, "FACULTY", "guidance", "read") &&
              (await s.grants(u.id, termId)).some((g) => g.allDepartments));
        if (!canRead) continue;
        if (q.periodId && pair.periodId !== q.periodId) continue;
        const o =
            (await s.obligations(ts.id)).find(
              (o) => o.periodId === pair.periodId,
            ) ?? null,
          plan = p ? await s.planFor(p.id) : null,
          period = pair.refPeriodId,
          readiness: string[] = [];
        if (!period.reportDueAt)
          readiness.push("REPORTING_SCOPE_NOT_CONFIGURED");
        if (!o) readiness.push("MISSING_OBLIGATION_RECORD");
        else
          try {
            this.v.obligation(o, ts.id, termId);
          } catch (e) {
            if (!(e instanceof HttpException)) throw e;
            readiness.push("REPORTING_SCOPE_NOT_CONFIGURED");
          }
        const candidate = o?.refCurrentTaskId,
          task =
            plan && candidate?.guidancePlanId === plan.id
              ? candidate
              : undefined;
        if ((candidate && !task) || (o?.planId && o.planId !== plan?.id))
          readiness.push("REPORTING_SCOPE_NOT_CONFIGURED");
        const tw = task?.pr2bTaskWorkflowTaskId,
          submission =
            tw?.state !== "CANCELLED"
              ? tw?.refCurrentSubmissionId?.pr2bSubmissionWorkflowSubmissionId
              : null,
          hasSubmission =
            !!submission &&
            ["SUBMITTED", "REVIEWED"].includes(submission.state ?? "");
        if (!plan) readiness.push("MISSING_PLAN");
        if (!task || tw?.state === "CANCELLED") readiness.push("MISSING_TASK");
        let canEnsure = false;
        if (
          p &&
          plan &&
          o &&
          !readiness.includes("REPORTING_SCOPE_NOT_CONFIGURED") &&
          !task
        )
          try {
            await this.v.active(s, p, plan);
            canEnsure = await this.can(s, u, p, "task", "ensure-weekly");
          } catch (e) {
            if (!(e instanceof HttpException)) throw e;
          }
        const overdue = period.reportDueAt
          ? new Date() > period.reportDueAt && !hasSubmission
          : null;
        if (q.isOverdue && (q.isOverdue === "true") !== overdue) continue;
        if (
          q.search &&
          ![ts.student.fullName, ts.student.studentCode, period.label].some(
            (v) =>
              v.toLocaleLowerCase().includes(q.search!.toLocaleLowerCase()),
          )
        )
          continue;
        rows.push({
          termStudentId: ts.id,
          studentName: ts.student.fullName,
          studentCode: ts.student.studentCode,
          proposalId: p?.id ?? null,
          periodId: period.id,
          periodLabel: period.label,
          startsAt: period.startsAt.toISOString(),
          reportDueAt: period.reportDueAt?.toISOString() ?? null,
          obligationId: o?.id ?? null,
          obligationRevision: o?.revision ?? null,
          planId: plan?.id ?? null,
          planRevision: plan?.pr2bGuidancePlanWorkflowPlanId?.revision ?? null,
          currentTaskId: task && tw?.state !== "CANCELLED" ? task.id : null,
          missingPlan: !plan,
          missingTask: !task || tw?.state === "CANCELLED",
          missingObligationRecord: !o,
          isOverdue: overdue,
          submissionState: hasSubmission
            ? "SUBMITTED"
            : new Date() < period.startsAt
              ? "NOT_DUE"
              : "MISSING",
          reviewResult:
            hasSubmission &&
            submission?.refEffectiveReviewId?.state === "RECORDED"
              ? submission.refEffectiveReviewId.decision
              : null,
          canEnsure,
          readiness,
        });
      }
      const configured =
        !warnings.length &&
        !rows.some(
          (r) =>
            r.missingObligationRecord ||
            r.readiness.includes("REPORTING_SCOPE_NOT_CONFIGURED"),
        );
      return {
        data: rows.slice((q.page - 1) * q.limit, q.page * q.limit),
        total: rows.length,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(rows.length / q.limit),
        coverageState: configured
          ? ("READY" as const)
          : ("NOT_CONFIGURED" as const),
        warnings: configured ? [] : ["REPORTING_SCOPE_NOT_CONFIGURED"],
      };
    });
  }
}
