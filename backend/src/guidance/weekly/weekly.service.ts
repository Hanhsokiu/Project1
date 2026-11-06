import { Injectable, HttpException } from "@nestjs/common";
import { GuidancePeriod, Prisma } from "@prisma/client";
import type {
  WeeklyPlanCreate,
  WeeklyPlanUpdate,
  WeeklyPlanState,
  WeeklyPlanView,
  WeeklyQuery,
  WeeklyStudentRow,
  WeeklySummary,
} from "@doan/shared";
import { WeeklyRepository, WeeklySession } from "./weekly.repository";
import { GuidanceValidator } from "../tasks/guidance.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import { SubmissionService } from "../submissions/submission.service";
import { groupError } from "../../topic/review-groups/review-group.errors";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export function validateWeeklyDates(
  input: WeeklyPlanCreate,
  term: { startDate: Date; endDate: Date },
  phase: { startDate: Date; endDate: Date },
) {
  const start = new Date(input.startsAt),
    end = new Date(input.endsAt),
    due = new Date(input.reportDueAt);
  if (
    ![start, end, due].every((d) => Number.isFinite(d.getTime())) ||
    start >= end ||
    due <= start ||
    due > end
  )
    groupError(
      400,
      "WEEK_DATES_INVALID",
      "Tuần phải có ngày bắt đầu trước ngày kết thúc; hạn nộp nằm trong tuần.",
    );
  if (
    start < term.startDate ||
    end > term.endDate ||
    start < phase.startDate ||
    end > phase.endDate ||
    due >= phase.endDate
  )
    groupError(
      400,
      "DEADLINE_OUTSIDE_PHASE",
      "Tuần phải nằm trong đợt và giai đoạn hướng dẫn.",
    );
}
export function weeklyMetrics(
  rows: WeeklyStudentRow[],
): WeeklySummary["metrics"] {
  const metrics = {
    NOT_SUBMITTED: 0,
    PENDING: 0,
    PASS: 0,
    FAIL: 0,
    REVISION_REQUIRED: 0,
    LATE: 0,
  };
  for (const r of rows) {
    metrics[r.status]++;
    if (r.isLate) metrics.LATE++;
  }
  return metrics;
}
@Injectable()
export class WeeklyService {
  constructor(
    private readonly repo: WeeklyRepository,
    private readonly gv: GuidanceValidator,
    private readonly review: ProposalReviewValidator,
    private readonly submissions: SubmissionService,
  ) {}
  private async scope(
    s: WeeklySession,
    userId: string,
    termId: string,
    manage = false,
  ) {
    const u = this.review.principal(await s.principal(userId));
    const term = await s.term(termId);
    if (!term) groupError(404, "COMMON_001", "Không tìm thấy đợt.");
    const grants = this.gv.role(u, "FACULTY", "guidance", "monitor")
      ? await s.grants(userId, termId)
      : [];
    const grant = grants[0];
    const canManage = !!grant?.allDepartments;
    if (
      manage &&
      (!canManage ||
        term.isLocked ||
        ["COMPLETED", "CANCELLED"].includes(term.status))
    )
      groupError(
        403,
        "WEEK_MANAGE_FORBIDDEN",
        "Cần quyền khoa toàn đợt và đợt chưa khóa/kết thúc.",
      );
    const student =
      u.student?.isActive && this.gv.role(u, "STUDENT", "guidance", "read")
        ? await s.weeklyDb.termStudent.findUnique({
            where: { termId_studentId: { termId, studentId: u.student.id } },
          })
        : null;
    const lecturer =
      u.lecturer?.isActive &&
      this.gv.role(u, "LECTURER", "guidance", "read") &&
      (await s.roster(termId, u.lecturer.id));
    if (!grant && !student && !lecturer)
      groupError(404, "COMMON_001", "Không tìm thấy đợt trong phạm vi.");
    return { u, term, grant, canManage, student, lecturer };
  }
  private view(p: GuidancePeriod, canManage: boolean): WeeklyPlanView {
    return {
      id: p.id,
      termId: p.termId,
      ordinal: p.ordinal,
      label: p.label,
      description: p.description,
      expectedDeliverables: p.expectedDeliverables,
      startsAt: p.startsAt.toISOString(),
      endsAt: p.endsAt.toISOString(),
      reportDueAt: p.reportDueAt!.toISOString(),
      state: p.state,
      revision: p.revision,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      allowLate: p.allowLate,
      canManage,
    };
  }
  async options(userId: string) {
    return this.repo.transaction(async (s) => {
      const terms = [];
      for (const t of await s.terms({})) {
        try {
          const scope = await this.scope(s, userId, t.id);
          terms.push({ ...t, canManage: scope.canManage });
        } catch (e) {
          if (
            !(e instanceof HttpException) ||
            ![403, 404].includes(e.getStatus())
          )
            throw e;
        }
      }
      return terms;
    });
  }
  async list(userId: string, termId: string) {
    return this.repo.transaction(async (s) => {
      const scope = await this.scope(s, userId, termId);
      return (await s.periods(termId))
        .filter(
          (p) =>
            p.type === "WEEK" &&
            p.reportDueAt &&
            (scope.canManage || p.state !== "DRAFT"),
        )
        .map((p) => this.view(p, scope.canManage));
    });
  }
  private async obligations(s: WeeklySession, p: GuidancePeriod) {
    // Publication snapshots the current roster. Re-publication also includes newly enrolled students.
    const students = await s.weeklyDb.termStudent.findMany({
      where: { termId: p.termId },
      include: { student: true },
    });
    for (const ts of students) {
      await s.weeklyDb.periodRequiredStudent.upsert({
        where: {
          periodId_termStudentId: { periodId: p.id, termStudentId: ts.id },
        },
        create: { periodId: p.id, termStudentId: ts.id, termId: p.termId },
        update: {},
      });
      const config = json({
        schemaVersion: 1,
        periodId: p.id,
        termStudentId: ts.id,
        termId: p.termId,
        periodRevision: p.revision,
        startsAt: p.startsAt,
        reportDueAt: p.reportDueAt,
        expectedDeliverables: p.expectedDeliverables,
      });
      const o = await s.weeklyDb.weeklyReportObligation.upsert({
        where: {
          periodId_termStudentId: { periodId: p.id, termStudentId: ts.id },
        },
        create: {
          periodId: p.id,
          termStudentId: ts.id,
          configRevision: p.revision,
          configSnapshot: config,
        },
        update: {
          configRevision: p.revision,
          configSnapshot: config,
          revision: { increment: 1 },
        },
      });
      if (o.currentTaskId) {
        const task = await s.task(o.currentTaskId);
        if (task) {
          await s.updateTask(task.id, { deadline: p.reportDueAt! });
          await s.advanceTask(task.id, task.pr2bTaskWorkflowTaskId!.revision, {
            startsAt: p.startsAt,
            expectedDeliverables: p.expectedDeliverables,
          });
          await s.taskHistory({
            taskId: task.id,
            actorId: p.updatedByUserId!,
            reason: p.stateReason ?? "WEEK_UPDATED",
            snapshot: json({
              oldDeadline: task.deadline,
              deadline: p.reportDueAt,
              periodRevision: p.revision,
            }),
          });
        }
      }
      await s.outbox({
        eventId: `weekly:${p.id}:${p.revision}:${ts.id}`,
        type: "GUIDANCE_NOTIFICATION",
        aggregateId: p.id,
        payload: json({
          userId: ts.student.userId,
          termId: p.termId,
          title: "Cập nhật kế hoạch tuần",
          body: "Khoa đã công bố hoặc điều chỉnh tuần. Kiểm tra trạng thái và hạn nộp mới.",
          link: `/guidance/weeks?termId=${p.termId}`,
        }),
      });
    }
  }
  async command(
    userId: string,
    termId: string,
    input: WeeklyPlanCreate | WeeklyPlanUpdate | WeeklyPlanState,
    key: string,
    id?: string,
    stateOnly = false,
  ) {
    this.submissions.key(key);
    return this.repo.transaction(async (s) => {
      const scope = await this.scope(s, userId, termId, true);
      await s.lock(termId, [], "");
      const route = `/terms/${termId}/weekly-plans/${id ?? ""}${stateOnly ? "/state" : ""}`,
        hash = reviewHash(input);
      const replay = await s.guidanceReplay(userId, "POST", route, key);
      if (replay) {
        if (replay.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa đã dùng cho dữ liệu khác.",
          );
        return replay.result as unknown as WeeklyPlanView;
      }
      const old = id ? await s.period(id) : null;
      if (id && (!old || old.termId !== termId || old.type !== "WEEK"))
        groupError(404, "COMMON_001", "Không tìm thấy tuần.");
      if (old)
        this.review.revision(
          old.revision,
          (input as WeeklyPlanUpdate).expectedRevision,
        );
      let p: GuidancePeriod;
      if (stateOnly) {
        const i = input as WeeklyPlanState;
        if (!old || (old.state === "DRAFT" && i.state === "LOCKED"))
          groupError(
            409,
            "STATE_TRANSITION_INVALID",
            "Công bố tuần trước khi khóa.",
          );
        const phase = await s.guidancePhase(termId);
        if (!phase)
          groupError(
            409,
            "INPUT_NOT_READY",
            "Chưa cấu hình giai đoạn hướng dẫn.",
          );
        validateWeeklyDates(this.view(old, true), scope.term, phase.refPhaseId);
        p = await s.weeklyDb.guidancePeriod.update({
          where: { id },
          data: {
            state: i.state,
            stateReason: i.reason,
            publishedAt: old.publishedAt ?? new Date(),
            updatedByUserId: userId,
            revision: { increment: 1 },
          },
        });
      } else {
        const i = input as WeeklyPlanCreate;
        const phase = await s.guidancePhase(termId);
        if (!phase)
          groupError(
            409,
            "INPUT_NOT_READY",
            "Chưa cấu hình giai đoạn hướng dẫn.",
          );
        validateWeeklyDates(i, scope.term, phase.refPhaseId);
        const data = {
          ordinal: i.ordinal,
          label: i.label,
          description: i.description,
          expectedDeliverables: i.expectedDeliverables,
          startsAt: new Date(i.startsAt),
          endsAt: new Date(i.endsAt),
          reportDueAt: new Date(i.reportDueAt),
          allowLate: i.allowLate,
          updatedByUserId: userId,
        };
        p = old
          ? await s.weeklyDb.guidancePeriod.update({
              where: { id },
              data: {
                ...data,
                stateReason: (input as WeeklyPlanUpdate).reason,
                revision: { increment: 1 },
              },
            })
          : await s.weeklyDb.guidancePeriod.create({
              data: {
                ...data,
                termId,
                type: "WEEK",
                state: "DRAFT",
                createdByUserId: userId,
              },
            });
      }
      if (p.state !== "DRAFT") await this.obligations(s, p);
      await s.guidanceAudit(
        userId,
        p.id,
        old ? "WEEK_UPDATED" : "WEEK_CREATED",
        json({
          actorRole: "FACULTY",
          termId,
          before: old,
          after: p,
          reason: (input as WeeklyPlanUpdate).reason ?? "CREATE",
        }),
      );
      const result = this.view(p, true);
      await s.guidanceRemember(userId, "POST", route, key, hash, json(result));
      return result;
    }, true);
  }
  async history(userId: string, termId: string, id: string) {
    return this.repo.transaction(async (s) => {
      const scope = await this.scope(s, userId, termId);
      if (!scope.canManage)
        groupError(
          403,
          "WEEK_MANAGE_FORBIDDEN",
          "Cần quyền khoa toàn đợt để xem lịch sử cấu hình.",
        );
      const p = await s.period(id);
      if (!p || p.termId !== termId)
        groupError(404, "COMMON_001", "Không tìm thấy tuần.");
      return s.weeklyDb.auditLog.findMany({
        where: {
          resource: "guidance-task",
          resourceId: id,
          action: { in: ["WEEK_CREATED", "WEEK_UPDATED"] },
        },
        orderBy: { createdAt: "asc" },
      });
    });
  }
  async summary(
    userId: string,
    termId: string,
    q: WeeklyQuery,
  ): Promise<WeeklySummary> {
    return this.repo.transaction(async (s) => {
      const scope = await this.scope(s, userId, termId),
        rows: WeeklyStudentRow[] = [];
      // A student appears once per published week. Resolve these read-only
      // contexts once inside this transaction, rather than repeating the same
      // queries for every week and exhausting the shared database pool.
      const advisors = new Map<
        string,
        Awaited<ReturnType<ProposalReviewValidator["advisor"]>> | null
      >();
      const obligations = new Map<
        string,
        Awaited<ReturnType<WeeklySession["obligations"]>>
      >();
      const plans = new Map<
        string,
        Awaited<ReturnType<WeeklySession["planFor"]>>
      >();
      for (const pair of await s.coveragePairs(termId)) {
        const period = pair.refPeriodId,
          ts = pair.refTermStudentId;
        if (
          period.state === "DRAFT" ||
          !period.reportDueAt ||
          (q.periodId && period.id !== q.periodId)
        )
          continue;
        if (
          scope.student &&
          !scope.grant &&
          !scope.lecturer &&
          scope.student.id !== ts.id
        )
          continue;
        const topic = ts.pr2bTopicWorkflowTermStudentId?.refTopicId;
        const p = topic?.proposals.find((p) => p.studentId === ts.studentId);
        const dept =
          p?.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
            ?.departmentId;
        if (p && !advisors.has(p.id)) {
          advisors.set(p.id, null);
          try {
            advisors.set(p.id, await this.review.advisor(s, p));
          } catch (e) {
            if (!(e instanceof HttpException)) throw e;
          }
        }
        const official = p ? (advisors.get(p.id) ?? null) : null;
        const faculty =
          scope.grant &&
          (scope.grant.allDepartments ||
            scope.grant.pr2bGrantDepartmentGrantId.some(
              (d) => d.departmentId === dept,
            ));
        if (
          !faculty &&
          scope.student?.id !== ts.id &&
          !(
            scope.lecturer &&
            official?.assignment.advisorId === scope.u.lecturer?.id
          )
        )
          continue;
        if (
          (q.studentId && ts.studentId !== q.studentId) ||
          (q.advisorId && official?.assignment.advisorId !== q.advisorId)
        )
          continue;
        if (
          q.studentSearch &&
          !`${ts.student.fullName} ${ts.student.studentCode}`
            .toLocaleLowerCase()
            .includes(q.studentSearch.toLocaleLowerCase())
        )
          continue;
        if (
          q.advisorSearch &&
          !official?.assignment.advisor.fullName
            .toLocaleLowerCase()
            .includes(q.advisorSearch.toLocaleLowerCase())
        )
          continue;
        if (!obligations.has(ts.id))
          obligations.set(ts.id, await s.obligations(ts.id));
        const o = obligations.get(ts.id)!.find((o) => o.periodId === period.id);
        const tw = o?.refCurrentTaskId?.pr2bTaskWorkflowTaskId;
        const sw =
          tw?.refCurrentSubmissionId?.pr2bSubmissionWorkflowSubmissionId;
        const valid =
          !!sw?.submittedAt &&
          !!sw.contextSnapshot &&
          tw?.state !== "CANCELLED";
        const decision =
          valid && sw?.refEffectiveReviewId?.state === "RECORDED"
            ? sw.refEffectiveReviewId
            : null;
        if (p && !plans.has(p.id)) plans.set(p.id, await s.planFor(p.id));
        const plan = p ? (plans.get(p.id) ?? null) : null;
        const status = !valid
          ? "NOT_SUBMITTED"
          : (decision?.decision ?? "PENDING");
        if (q.isLate && (!valid || sw?.isLate !== (q.isLate === "true")))
          continue;
        if (q.status && q.status !== status) continue;
        rows.push({
          periodId: period.id,
          label: period.label,
          startsAt: period.startsAt.toISOString(),
          endsAt: period.endsAt.toISOString(),
          dueAt: period.reportDueAt.toISOString(),
          studentId: ts.studentId,
          studentName: ts.student.fullName,
          studentCode: ts.student.studentCode,
          advisorId: official?.assignment.advisorId ?? null,
          advisorName: official?.assignment.advisor.fullName ?? null,
          topicTitle: topic?.title ?? null,
          proposalId: p?.id ?? null,
          obligationId: o?.id ?? null,
          taskId: o?.currentTaskId ?? null,
          submissionId: valid ? sw!.submissionId : null,
          versionNumber: valid ? (sw!.versionNumber ?? 0) : 0,
          taskCount: plan
            ? await s.taskCount({
                guidancePlanId: plan.id,
                pr2bTaskWorkflowTaskId: {
                  is: {
                    periodId: period.id,
                    kind: "AD_HOC",
                    state: { not: "CANCELLED" },
                  },
                },
              })
            : 0,
          status,
          isLate: valid ? sw!.isLate : null,
          submittedAt: valid ? sw!.submittedAt!.toISOString() : null,
          revisionDueAt: decision?.revisionDueAt?.toISOString() ?? null,
        });
      }
      rows.sort(
        (a, b) =>
          a.startsAt.localeCompare(b.startsAt) ||
          a.studentCode.localeCompare(b.studentCode),
      );
      return {
        data: rows.slice((q.page - 1) * q.limit, q.page * q.limit),
        total: rows.length,
        page: q.page,
        totalPages: Math.ceil(rows.length / q.limit),
        metrics: weeklyMetrics(rows),
      };
    });
  }
}
