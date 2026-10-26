import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DossierSession } from "../../topic/proposal-dossiers/dossier.repository";
import { proposalInclude } from "../../topic/proposal-reviews/proposal-review.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
const planInclude = {
  pr2bGuidancePlanWorkflowPlanId: {
    include: { refProposalId: { include: proposalInclude } },
  },
  pr2bPlanHistoryPlanId: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.GuidancePlanInclude;
const taskInclude = {
  pr2bTaskWorkflowTaskId: { include: { refPeriodId: true } },
  guidancePlan: { include: planInclude },
  pr2bTaskProgressEventTaskId: { orderBy: { createdAt: "asc" as const } },
  pr2bTaskHistoryTaskId: { orderBy: { createdAt: "desc" as const } },
  submissions: { select: { id: true } },
} satisfies Prisma.TaskInclude;
export type GuidancePlanRecord = Prisma.GuidancePlanGetPayload<{
  include: typeof planInclude;
}>;
export type GuidanceTaskRecord = Prisma.TaskGetPayload<{
  include: typeof taskInclude;
}>;
const obligationInclude = {
  refPeriodId: true,
  refCurrentTaskId: {
    include: {
      pr2bTaskWorkflowTaskId: {
        include: {
          refCurrentSubmissionId: {
            include: {
              pr2bSubmissionWorkflowSubmissionId: {
                include: { refEffectiveReviewId: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.WeeklyReportObligationInclude;
export type ObligationRecord = Prisma.WeeklyReportObligationGetPayload<{
  include: typeof obligationInclude;
}>;
export class GuidanceSession extends DossierSession {
  constructor(private readonly guidanceDb: Prisma.TransactionClient) {
    super(guidanceDb);
  }
  guidancePhase(termId: string) {
    return this.guidanceDb.termPhaseWorkflow.findUnique({
      where: { termId_key: { termId, key: "GUIDANCE" } },
      include: { refPhaseId: true },
    });
  }
  plan(id: string) {
    return this.guidanceDb.guidancePlan.findUnique({
      where: { id },
      include: planInclude,
    });
  }
  planFor(proposalId: string) {
    return this.guidanceDb.guidancePlan.findUnique({
      where: { proposalId },
      include: planInclude,
    });
  }
  periods(termId: string) {
    return this.guidanceDb.guidancePeriod.findMany({
      where: { termId },
      orderBy: { ordinal: "asc" },
    });
  }
  period(id: string) {
    return this.guidanceDb.guidancePeriod.findUnique({ where: { id } });
  }
  task(id: string) {
    return this.guidanceDb.task.findUnique({
      where: { id },
      include: taskInclude,
    });
  }
  tasks(where: Prisma.TaskWhereInput, skip: number, take: number) {
    return this.guidanceDb.task.findMany({
      where,
      include: taskInclude,
      skip,
      take,
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
    });
  }
  taskCount(where: Prisma.TaskWhereInput) {
    return this.guidanceDb.task.count({ where });
  }
  legacyTasks(guidancePlanId: string) {
    return this.guidanceDb.task.findMany({
      where: { guidancePlanId },
      include: { submissions: true },
      orderBy: { deadline: "asc" },
    });
  }
  addPlan(data: Prisma.GuidancePlanUncheckedCreateInput) {
    return this.guidanceDb.guidancePlan.create({ data, include: planInclude });
  }
  addTask(data: Prisma.TaskUncheckedCreateInput) {
    return this.guidanceDb.task.create({ data, include: taskInclude });
  }
  updatePlan(id: string, data: Prisma.GuidancePlanUncheckedUpdateInput) {
    return this.guidanceDb.guidancePlan.update({ where: { id }, data });
  }
  async advancePlan(
    planId: string,
    revision: number,
    data: Prisma.GuidancePlanWorkflowUncheckedUpdateManyInput = {},
  ) {
    const result = await this.guidanceDb.guidancePlanWorkflow.updateMany({
      where: { planId, revision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (result.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Kế hoạch đã thay đổi.");
    return result;
  }
  updateTask(id: string, data: Prisma.TaskUncheckedUpdateInput) {
    return this.guidanceDb.task.update({ where: { id }, data });
  }
  async advanceTask(
    taskId: string,
    revision: number,
    data: Prisma.TaskWorkflowUncheckedUpdateManyInput = {},
  ) {
    const result = await this.guidanceDb.taskWorkflow.updateMany({
      where: { taskId, revision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (result.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Nhiệm vụ đã thay đổi.");
    return result;
  }
  planHistory(data: Prisma.PlanHistoryUncheckedCreateInput) {
    return this.guidanceDb.planHistory.create({ data });
  }
  taskHistory(data: Prisma.TaskHistoryUncheckedCreateInput) {
    return this.guidanceDb.taskHistory.create({ data });
  }
  progress(data: Prisma.TaskProgressEventUncheckedCreateInput) {
    return this.guidanceDb.taskProgressEvent.create({ data });
  }
  guidanceAudit(
    userId: string,
    resourceId: string,
    action: string,
    newValue: Prisma.InputJsonValue,
  ) {
    return this.guidanceDb.auditLog.create({
      data: { userId, resource: "guidance-task", resourceId, action, newValue },
    });
  }
  async lockAggregate(planId?: string, obligationId?: string, taskId?: string) {
    if (planId)
      await this.guidanceDb
        .$queryRaw`SELECT id FROM public."GUIDANCE_PLAN" WHERE id=${planId} FOR UPDATE`;
    if (obligationId)
      await this.guidanceDb
        .$queryRaw`SELECT id FROM public."WEEKLY_REPORT_OBLIGATION" WHERE id=${obligationId} FOR UPDATE`;
    if (taskId)
      await this.guidanceDb
        .$queryRaw`SELECT id FROM public."TASK" WHERE id=${taskId} FOR UPDATE`;
  }
  obligation(id: string) {
    return this.guidanceDb.weeklyReportObligation.findUnique({
      where: { id },
      include: obligationInclude,
    });
  }
  ownerProposal(termStudentId: string) {
    return this.guidanceDb.topicWorkflow.findUnique({
      where: { termStudentId },
      include: {
        refTermStudentId: true,
        refTopicId: { include: { proposals: { include: proposalInclude } } },
      },
    });
  }
  obligations(termStudentId: string) {
    return this.guidanceDb.weeklyReportObligation.findMany({
      where: { termStudentId },
      include: obligationInclude,
    });
  }
  async linkObligations(termStudentId: string, planId: string) {
    await this.guidanceDb.weeklyReportObligation.updateMany({
      where: { termStudentId, planId: null, currentTaskId: null },
      data: { planId, revision: { increment: 1 } },
    });
  }
  async advanceObligation(
    id: string,
    revision: number,
    data: Prisma.WeeklyReportObligationUncheckedUpdateManyInput,
  ) {
    const result = await this.guidanceDb.weeklyReportObligation.updateMany({
      where: { id, revision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (result.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Nghĩa vụ tuần đã thay đổi.");
    return result;
  }
  coveragePairs(termId: string) {
    return this.guidanceDb.periodRequiredStudent.findMany({
      where: { termId, refPeriodId: { type: "WEEK" } },
      include: {
        refPeriodId: true,
        refTermStudentId: {
          include: {
            student: true,
            pr2bTopicWorkflowTermStudentId: {
              include: {
                refTopicId: {
                  include: { proposals: { include: proposalInclude } },
                },
              },
            },
          },
        },
      },
      orderBy: [{ periodId: "asc" }, { termStudentId: "asc" }],
    });
  }
  guidanceReplay(actorId: string, method: string, route: string, key: string) {
    return this.guidanceDb.idempotencyRecord.findUnique({
      where: { actorId_method_route_key: { actorId, method, route, key } },
    });
  }
  guidanceRemember(
    actorId: string,
    method: string,
    route: string,
    key: string,
    payloadHash: string,
    result: Prisma.InputJsonValue,
  ) {
    return this.guidanceDb.idempotencyRecord.create({
      data: {
        actorId,
        method,
        route,
        key,
        payloadHash,
        result,
        expiresAt: new Date("9999-12-31Z"),
      },
    });
  }
}
@Injectable()
export class GuidanceRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    work: (s: GuidanceSession) => Promise<T>,
    mutation = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++)
      try {
        return await this.prisma.$transaction(
          (tx) => work(new GuidanceSession(tx)),
          {
            isolationLevel: mutation ? "Serializable" : "RepeatableRead",
            timeout: 30000,
          },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (["P2034", "P2002"].includes(e.code) ||
            (e.code === "P2010" &&
              ["40001", "40P01"].includes(String(e.meta?.code))))
        ) {
          if (attempt < 2) continue;
          groupError(
            409,
            "REVISION_CONFLICT",
            "Kế hoạch/nhiệm vụ đã thay đổi. Hãy tải lại.",
          );
        }
        throw e;
      }
  }
}
