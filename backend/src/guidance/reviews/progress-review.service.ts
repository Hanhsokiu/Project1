import { Injectable, HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  ProgressReviewCreate,
  ProgressReviewAmend,
  ProgressReviewView,
  ProgressReviewContext,
  GuidanceMonitorQuery,
  GuidanceMonitorRow,
  GuidanceDashboard,
  GuidanceMeetingCreate,
  GuidanceMeetingAmend,
  GuidanceMeetingView,
} from "@doan/shared";
import { GuidanceService } from "../tasks/guidance.service";
import { GuidanceValidator } from "../tasks/guidance.validator";
import { SubmissionService } from "../submissions/submission.service";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import { groupError } from "../../topic/review-groups/review-group.errors";
import {
  ProgressRepository,
  ProgressSession,
  ProgressReviewRecord,
  MeetingRecord,
} from "./progress-review.repository";
import { ProgressReviewValidator } from "./progress-review.validator";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const code = (e: HttpException) =>
  (e.getResponse() as { error?: { code?: string } }).error?.code ??
  "INPUT_NOT_READY";
const page = <T>(rows: T[], q: { page: number; limit: number }) => ({
  data: rows.slice((q.page - 1) * q.limit, q.page * q.limit),
  total: rows.length,
  page: q.page,
  limit: q.limit,
  totalPages: Math.ceil(rows.length / q.limit),
});
@Injectable()
export class ProgressReviewService {
  async options(userId: string) {
    return this.repo.transaction(async (s) => {
      const u = this.review.principal(await s.principal(userId)),
        canReview =
          this.gv.role(u, "LECTURER", "task", "review") &&
          !!u.lecturer?.isActive,
        canMonitor = this.gv.role(u, "FACULTY", "guidance", "monitor"),
        terms = [];
      for (const t of await s.terms({})) {
        const grants = canMonitor ? await s.grants(userId, t.id) : [];
        if (
          grants.some(
            (g) => g.allDepartments || g.pr2bGrantDepartmentGrantId.length,
          ) ||
          (canReview && (await s.roster(t.id, u.lecturer!.id)))
        )
          terms.push(t);
      }
      return { terms, canReview, canMonitor };
    });
  }
  constructor(
    private readonly repo: ProgressRepository,
    private readonly guidance: GuidanceService,
    private readonly gv: GuidanceValidator,
    private readonly review: ProposalReviewValidator,
    private readonly v: ProgressReviewValidator,
    private readonly submissions: SubmissionService,
  ) {}
  view(r: ProgressReviewRecord): ProgressReviewView {
    return {
      id: r.id,
      submissionId: r.submissionId,
      decision: r.decision,
      comment: r.comment,
      state: r.state,
      reviewerUserId: r.reviewerUserId,
      reviewerName:
        r.refReviewerUserId.lecturer?.fullName ?? r.refReviewerUserId.username,
      assignmentRevision: r.assignmentRevision,
      recordedAt: r.recordedAt.toISOString(),
      revision: r.revision,
      supersedesReviewId: r.supersedesReviewId,
      amendmentReason: r.amendmentReason,
    };
  }
  private async sub(s: ProgressSession, id: string) {
    const sub = await s.submission(id);
    if (!sub) groupError(404, "COMMON_001", "Không tìm thấy bài nộp.");
    return sub;
  }
  async context(userId: string, id: string): Promise<ProgressReviewContext> {
    return this.repo.transaction(async (s) => {
      const sub = await this.sub(s, id),
        a = await this.guidance.submissionAccess(s, userId, sub.taskId, "read"),
        history = await s.reviews(id),
        effective =
          history.find(
            (r) =>
              r.id ===
              sub.pr2bSubmissionWorkflowSubmissionId?.effectiveReviewId,
          ) ?? null;
      const allowedActions: ProgressReviewContext["allowedActions"] = [],
        readiness: string[] = [];
      try {
        await this.guidance.reviewAccess(s, userId, sub.taskId);
        await this.gv.active(s, a.p, a.plan);
        this.v.current(a.t, sub, effective ?? undefined);
        allowedActions.push(effective ? "amend" : "review");
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        if (code(e) !== "COMMON_001") readiness.push(code(e));
      }
      return {
        submission: this.submissions.view(sub),
        taskId: a.t.id,
        taskTitle: a.t.title,
        proposalId: a.p.id,
        termId: a.p.topic.termId,
        studentName: a.p.student.fullName,
        studentCode: a.p.student.studentCode,
        periodLabel: a.t.pr2bTaskWorkflowTaskId?.refPeriodId?.label ?? null,
        taskStatus: a.t.pr2bTaskWorkflowTaskId?.state ?? null,
        taskRevision: a.t.pr2bTaskWorkflowTaskId?.revision ?? 0,
        currentSubmissionId:
          a.t.pr2bTaskWorkflowTaskId?.currentSubmissionId ?? null,
        effectiveReview: effective ? this.view(effective) : null,
        history: history.map((r) => this.view(r)),
        allowedActions,
        readiness,
      };
    });
  }
  async record(
    userId: string,
    submissionId: string,
    input: ProgressReviewCreate | ProgressReviewAmend,
    key: string,
    reviewId?: string,
  ) {
    this.submissions.key(key);
    this.v.comment(input.decision, input.comment);
    const route = reviewId
      ? `/task-reviews/${reviewId}/amendments`
      : `/task-submissions/${submissionId}/reviews`;
    return this.repo.transaction(async (s) => {
      let sub = await this.sub(s, submissionId),
        a = await this.guidance.reviewAccess(s, userId, sub.taskId);
      await s.lock(a.p.topic.termId, [], a.p.id);
      await s.lockAggregate(
        a.plan.id,
        a.t.pr2bTaskWorkflowTaskId?.obligationId ?? undefined,
        a.t.id,
      );
      sub = await this.sub(s, submissionId);
      a = await this.guidance.reviewAccess(s, userId, sub.taskId);
      const hash = reviewHash(input),
        replay = await s.guidanceReplay(userId, "POST", route, key);
      if (replay) {
        if (replay.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa đã dùng cho dữ liệu khác.",
          );
        return replay.result as unknown as ProgressReviewView;
      }
      const active = await this.gv.active(s, a.p, a.plan),
        old = reviewId ? await s.progressReview(reviewId) : null;
      if (reviewId && !old)
        groupError(404, "COMMON_001", "Không tìm thấy đánh giá.");
      const { tw, sw } = this.v.current(a.t, sub, old ?? undefined),
        snapshot = sw.contextSnapshot as {
          studentId?: string;
          termId?: string;
          termStudentId?: string;
          proposalId?: string;
        };
      if (
        sw.submittedByUserId !== a.p.student.userId ||
        snapshot.studentId !== a.p.studentId ||
        snapshot.termId !== a.p.topic.termId ||
        snapshot.proposalId !== a.p.id ||
        snapshot.termStudentId !== this.review.ownership(a.p).termStudentId
      )
        groupError(
          409,
          "INPUT_NOT_READY",
          "Snapshot bài nộp không khớp hồ sơ sở hữu.",
        );
      this.review.revision(tw.revision, input.expectedTaskRevision);
      this.review.revision(sw.revision, input.expectedSubmissionRevision);
      if (old) {
        const amendment = input as ProgressReviewAmend;
        this.review.revision(old.revision, amendment.expectedReviewRevision);
        if (!amendment.reason?.trim())
          groupError(400, "REASON_REQUIRED", "Cần lý do sửa đánh giá.");
        await s.supersedeReview(old.id, old.revision);
      }
      for (const link of sub.pr2bSubmissionAssetSubmissionId) {
        const upload = await s.assetUpload(link.fileId);
        if (
          !upload ||
          upload.state !== "COMMITTED" ||
          upload.submissionId !== sub.id ||
          upload.taskId !== a.t.id ||
          upload.actorId !==
            sub.pr2bSubmissionWorkflowSubmissionId!.submittedByUserId
        )
          groupError(
            409,
            "FILE_NOT_READY",
            "File chưa có chứng cứ nộp hợp lệ.",
          );
      }
      const now = new Date(),
        r = await s.addReview({
          submissionId: sub.id,
          decision: input.decision,
          comment: input.comment?.trim() || null,
          state: "RECORDED",
          assignmentRevision: active.official.revision,
          reviewerUserId: userId,
          recordedAt: now,
          supersedesReviewId: old?.id,
          amendmentReason: old ? (input as ProgressReviewAmend).reason : null,
        });
      await s.reviewSubmission(sub.id, sw.revision, r.id);
      const next = this.v.taskState(r.decision);
      await s.advanceTask(a.t.id, tw.revision, { state: next });
      await s.taskHistory({
        taskId: a.t.id,
        actorId: userId,
        reason: old
          ? (input as ProgressReviewAmend).reason
          : "PROGRESS_REVIEW_RECORDED",
        snapshot: json({
          submissionId: sub.id,
          versionNumber: sw.versionNumber,
          reviewId: r.id,
          supersedesReviewId: old?.id ?? null,
          decision: r.decision,
          fromState: tw.state,
          toState: next,
        }),
      });
      await s.guidanceAudit(
        userId,
        a.t.id,
        old ? "PROGRESS_REVIEW_AMENDED" : "PROGRESS_REVIEW_RECORDED",
        json({
          submissionId: sub.id,
          reviewId: r.id,
          reviewHash: reviewHash({
            decision: r.decision,
            comment: r.comment,
            reason: r.amendmentReason,
          }),
        }),
      );
      const notificationId = randomUUID();
      await s.notify({
        id: notificationId,
        userId: a.p.student.userId,
        termId: a.p.topic.termId,
        title: "Cập nhật đánh giá báo cáo",
        body: "GVHD đã cập nhật đánh giá bài nộp. Mở hồ sơ để xem nhận xét và yêu cầu tiếp theo.",
        link: `/guidance/review/${sub.id}`,
      });
      await s.outbox({
        eventId: `progress-review:${r.id}`,
        type: "TASK_SUBMISSION_REVIEWED",
        aggregateId: a.t.id,
        payload: json({
          reviewId: r.id,
          submissionId: sub.id,
          studentUserId: a.p.student.userId,
          notificationId,
        }),
      });
      await this.gv.phase(s, a.p.topic.termId);
      const result = this.view(r);
      await s.guidanceRemember(userId, "POST", route, key, hash, json(result));
      return result;
    }, true);
  }
  async amend(
    userId: string,
    id: string,
    input: ProgressReviewAmend,
    key: string,
  ) {
    const submissionId = await this.repo.transaction(async (s) => {
      const r = await s.progressReview(id);
      if (!r) groupError(404, "COMMON_001", "Không tìm thấy đánh giá.");
      const sub = await this.sub(s, r.submissionId);
      await this.guidance.reviewAccess(s, userId, sub.taskId);
      return r.submissionId;
    });
    return this.record(userId, submissionId, input, key, id);
  }
  private async rows(
    s: ProgressSession,
    userId: string,
    termId: string,
    faculty: boolean,
    asOf = new Date(),
  ) {
    const u = this.review.principal(await s.principal(userId));
    if (
      !this.gv.role(
        u,
        faculty ? "FACULTY" : "LECTURER",
        faculty ? "guidance" : "task",
        faculty ? "monitor" : "review",
      ) ||
      (!faculty && !u.lecturer?.isActive)
    )
      groupError(404, "COMMON_001", "Không tìm thấy phạm vi theo dõi.");
    if (!(await s.term(termId)))
      groupError(404, "COMMON_001", "Không tìm thấy đợt.");
    const grants = faculty ? await s.grants(userId, termId) : [],
      g = grants[0];
    if (
      faculty &&
      (!g || (!g.allDepartments && !g.pr2bGrantDepartmentGrantId.length))
    )
      groupError(404, "COMMON_001", "Không tìm thấy đợt trong phạm vi Khoa.");
    if (!faculty && !(await s.roster(termId, u.lecturer!.id)))
      groupError(404, "COMMON_001", "Không thuộc danh sách GV của đợt.");
    const rows: GuidanceMonitorRow[] = [],
      students = new Map<string, { id: string; name: string; code: string }>(),
      advisors = new Map<string, { id: string; name: string }>(),
      scope = new Set<string>();
    for (const { id } of await s.termPlanIds(termId)) {
      const plan = await s.plan(id),
        p = plan ? await s.proposal(plan.proposalId) : null;
      if (!plan || !p) continue;
      if (faculty) {
        const dept =
          p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
            ?.departmentId;
        if (
          !dept ||
          (!g!.allDepartments &&
            !g!.pr2bGrantDepartmentGrantId.some((d) => d.departmentId === dept))
        )
          continue;
      }
      let official: Awaited<
        ReturnType<ProposalReviewValidator["advisor"]>
      > | null = null;
      try {
        official = await this.review.advisor(s, p);
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
      }
      if (!faculty && official?.assignment.advisorId !== u.lecturer?.id)
        continue;
      scope.add(p.topic.pr2bTopicWorkflowTopicId?.termStudentId ?? "");
      students.set(p.studentId, {
        id: p.studentId,
        name: p.student.fullName,
        code: p.student.studentCode,
      });
      if (official)
        advisors.set(official.assignment.advisorId, {
          id: official.assignment.advisorId,
          name: official.assignment.advisor.fullName,
        });
      for (const t of await s.monitorTasks(plan.id)) {
        const tw = t.pr2bTaskWorkflowTaskId,
          sw = tw?.refCurrentSubmissionId?.pr2bSubmissionWorkflowSubmissionId,
          r = sw?.refEffectiveReviewId,
          legacyUnknown =
            !tw?.state ||
            (!tw.currentSubmissionId && t._count.submissions > 0) ||
            (!!tw.currentSubmissionId && !sw?.contextSnapshot),
          hasSubmission =
            !legacyUnknown &&
            !!sw &&
            ["SUBMITTED", "REVIEWED"].includes(sw.state ?? "") &&
            sw.taskId === t.id,
          decision =
            hasSubmission && r?.state === "RECORDED" ? r.decision : null;
        rows.push({
          legacyUnknown,
          taskId: t.id,
          planId: plan.id,
          proposalId: p.id,
          termId,
          studentId: p.studentId,
          studentName: p.student.fullName,
          studentCode: p.student.studentCode,
          advisorId: official?.assignment.advisorId ?? null,
          advisorName: official?.assignment.advisor.fullName ?? null,
          title: t.title,
          periodId: tw?.periodId ?? null,
          periodLabel: tw?.refPeriodId?.label ?? null,
          status: tw?.state ?? null,
          dueDate: t.deadline.toISOString(),
          isOverdue:
            !legacyUnknown &&
            this.gv.overdue(t.deadline, tw?.state ?? null, asOf),
          hasSubmission,
          submissionId: hasSubmission ? sw!.submissionId : null,
          versionNumber: hasSubmission ? sw!.versionNumber : null,
          decision,
          pendingReview:
            hasSubmission &&
            sw!.state === "SUBMITTED" &&
            !sw!.effectiveReviewId,
        });
      }
    }
    return {
      rows,
      students: [...students.values()],
      advisors: [...advisors.values()],
      scope,
      g,
    };
  }
  private filter(rows: GuidanceMonitorRow[], q: GuidanceMonitorQuery) {
    return rows.filter(
      (r) =>
        (!q.advisorId || r.advisorId === q.advisorId) &&
        (!q.studentId || r.studentId === q.studentId) &&
        (!q.periodId || r.periodId === q.periodId) &&
        (!q.status || r.status === q.status) &&
        (!q.decision || r.decision === q.decision) &&
        (!q.pending || (q.pending === "true") === r.pendingReview) &&
        (!q.search ||
          [r.title, r.studentName, r.studentCode].some((v) =>
            v.toLocaleLowerCase().includes(q.search!.toLocaleLowerCase()),
          )),
    );
  }
  async inbox(userId: string, termId: string, q: GuidanceMonitorQuery) {
    return this.repo.transaction(async (s) => {
      const result = await this.rows(s, userId, termId, false);
      return page(
        this.filter(
          result.rows.filter((r) => r.hasSubmission),
          q,
        ),
        q,
      );
    });
  }
  async dashboard(
    userId: string,
    termId: string,
    q: GuidanceMonitorQuery,
  ): Promise<GuidanceDashboard> {
    return this.repo.transaction(async (s) => {
      const asOf = new Date(),
        result = await this.rows(s, userId, termId, true, asOf),
        rows = this.filter(result.rows, q),
        warnings: string[] = [],
        weekly = {
          coverageState: "READY" as "READY" | "NOT_CONFIGURED",
          required: 0,
          submitted: 0,
          missing: 0,
          notDue: 0,
          overdue: 0,
          missingPlan: 0,
          missingTask: 0,
          warnings,
        };
      const pairs = await s.coveragePairs(termId),
        periods = (await s.periods(termId)).filter((p) => p.type === "WEEK");
      if (
        !periods.length ||
        periods.some((p) => !pairs.some((pair) => pair.periodId === p.id))
      )
        warnings.push("REPORTING_SCOPE_NOT_CONFIGURED");
      // Applicability is the source, even if no plan/task has been materialized.
      for (const pair of pairs) {
        if (q.periodId && pair.periodId !== q.periodId) continue;
        const ts = pair.refTermStudentId;
        if (ts.termId !== termId || pair.refPeriodId.termId !== termId)
          continue;
        const topic = ts.pr2bTopicWorkflowTermStudentId?.refTopicId,
          p = topic?.proposals.find((p) => p.studentId === ts.studentId),
          dept =
            p?.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
              ?.departmentId;
        if (!dept && !result.g!.allDepartments) {
          warnings.push("REPORTING_SCOPE_NOT_CONFIGURED");
          continue;
        }
        if (
          !result.g!.allDepartments &&
          (!dept ||
            !result.g!.pr2bGrantDepartmentGrantId.some(
              (d) => d.departmentId === dept,
            ))
        )
          continue;
        if (q.studentId && ts.studentId !== q.studentId) continue;
        let advisorId: string | null = null;
        if (p)
          try {
            advisorId = (await this.review.advisor(s, p)).assignment.advisorId;
          } catch (e) {
            if (!(e instanceof HttpException)) throw e;
          }
        if (q.advisorId && advisorId !== q.advisorId) continue;
        const o = (await s.obligations(ts.id)).find(
            (o) => o.periodId === pair.periodId,
          ),
          plan = p ? await s.planFor(p.id) : null,
          t =
            plan && o?.refCurrentTaskId?.guidancePlanId === plan.id
              ? o.refCurrentTaskId
              : null,
          tw = t?.pr2bTaskWorkflowTaskId,
          sw = tw?.refCurrentSubmissionId?.pr2bSubmissionWorkflowSubmissionId;
        weekly.required++;
        if (!plan) weekly.missingPlan++;
        if (!t || tw?.state === "CANCELLED") weekly.missingTask++;
        let configured = !!o && !!pair.refPeriodId.reportDueAt;
        if (o)
          try {
            this.gv.obligation(o, ts.id, termId);
          } catch (e) {
            if (!(e instanceof HttpException)) throw e;
            configured = false;
          }
        if (
          (o?.planId && o.planId !== plan?.id) ||
          (o?.currentTaskId && !t) ||
          (sw && !sw.contextSnapshot)
        )
          configured = false;
        if (!configured) warnings.push("REPORTING_SCOPE_NOT_CONFIGURED");
        const has =
          !!sw &&
          ["SUBMITTED", "REVIEWED"].includes(sw.state ?? "") &&
          tw?.state !== "CANCELLED";
        if (has) weekly.submitted++;
        else if (asOf < pair.refPeriodId.startsAt) weekly.notDue++;
        else weekly.missing++;
        if (
          !has &&
          pair.refPeriodId.reportDueAt &&
          asOf > pair.refPeriodId.reportDueAt
        )
          weekly.overdue++;
      }
      weekly.warnings = [...new Set(warnings)];
      weekly.coverageState = weekly.warnings.length
        ? "NOT_CONFIGURED"
        : "READY";
      return {
        asOf: asOf.toISOString(),
        termId,
        metrics: {
          totalTasks: rows.length,
          completed: rows.filter(
            (r) => r.status === "COMPLETED" && r.decision === "PASS",
          ).length,
          notSubmitted: rows.filter(
            (r) =>
              !r.legacyUnknown &&
              r.status !== null &&
              r.status !== "CANCELLED" &&
              !r.hasSubmission,
          ).length,
          overdue: rows.filter((r) => r.isOverdue).length,
          needsResubmission: rows.filter(
            (r) => r.status === "REVISION_REQUESTED",
          ).length,
          failed: rows.filter((r) => r.decision === "FAIL").length,
          revisionRequired: rows.filter(
            (r) => r.decision === "REVISION_REQUIRED",
          ).length,
          pendingReview: rows.filter((r) => r.pendingReview).length,
          cancelled: rows.filter((r) => r.status === "CANCELLED").length,
          legacyUnknown: rows.filter((r) => r.legacyUnknown).length,
        },
        weekly,
        tasks: page(rows, q),
        advisors: result.advisors,
        students: result.students,
      };
    });
  }
  private async meetingActions(
    s: ProgressSession,
    userId: string,
    planId: string,
  ) {
    const a = await this.guidance.planAccess(s, userId, planId, "read"),
      readiness: string[] = [];
    let canCreate = false;
    try {
      await this.guidance.planAccess(s, userId, planId, "manage");
      await this.gv.active(s, a.p, a.plan);
      canCreate = true;
    } catch (e) {
      if (!(e instanceof HttpException)) throw e;
      if (code(e) !== "COMMON_001") readiness.push(code(e));
    }
    return { a, canCreate, readiness };
  }
  private meetingView(
    m: MeetingRecord,
    canAmend: boolean,
  ): GuidanceMeetingView {
    const w = m.pr2bMeetingWorkflowMeetingId;
    return {
      id: m.id,
      planId: m.guidancePlanId,
      occurredAt: m.meetingDate.toISOString(),
      mode: w?.mode === "IN_PERSON" || w?.mode === "ONLINE" ? w.mode : null,
      location: m.location,
      discussion: w?.discussion ?? null,
      conclusion: w?.conclusion ?? null,
      authorUserId: w?.authorUserId ?? null,
      revision: w?.revision ?? 0,
      canAmend:
        canAmend && !!w?.authorUserId && !!w.discussion && !!w.conclusion,
      history: m.pr2bMeetingHistoryMeetingId.map((h) => ({
        id: h.id,
        actorId: h.actorId,
        createdAt: h.createdAt.toISOString(),
        reason: h.reason,
        snapshot: h.snapshot,
      })),
    };
  }
  async meetings(
    userId: string,
    id: string,
    q: { page: number; limit: number },
  ) {
    return this.repo.transaction(async (s) => {
      const { a, canCreate, readiness } = await this.meetingActions(
          s,
          userId,
          id,
        ),
        total = await s.meetingCount(id),
        meetings = await s.meetings(id, (q.page - 1) * q.limit, q.limit);
      return {
        data: meetings.map((m) => this.meetingView(m, canCreate)),
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
        planId: id,
        planRevision: a.plan.pr2bGuidancePlanWorkflowPlanId?.revision ?? 0,
        proposalId: a.p.id,
        studentName: a.p.student.fullName,
        canCreate,
        readiness,
      };
    });
  }
  async meetingCommand(
    userId: string,
    planId: string,
    input: GuidanceMeetingCreate | GuidanceMeetingAmend,
    key: string,
    meetingId?: string,
  ) {
    this.submissions.key(key);
    const method = meetingId ? "PATCH" : "POST",
      route = meetingId
        ? `/guidance-meetings/${meetingId}`
        : `/guidance-plans/${planId}/meetings`;
    return this.repo.transaction(async (s) => {
      let a = await this.guidance.planAccess(s, userId, planId, "manage");
      await s.lock(a.p.topic.termId, [], a.p.id);
      await s.lockAggregate(planId);
      if (meetingId) await s.lockMeeting(meetingId);
      a = await this.guidance.planAccess(s, userId, planId, "manage");
      const hash = reviewHash(input),
        replay = await s.guidanceReplay(userId, method, route, key);
      if (replay) {
        if (replay.payloadHash !== hash)
          groupError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Khóa đã dùng với nội dung khác.",
          );
        return replay.result as unknown as GuidanceMeetingView;
      }
      await this.gv.active(s, a.p, a.plan);
      let m: MeetingRecord;
      let content = {
        occurredAt: (input as GuidanceMeetingCreate).occurredAt,
        mode: (input as GuidanceMeetingCreate).mode,
        location: input.location ?? null,
        discussion: (input as GuidanceMeetingCreate).discussion,
        conclusion: (input as GuidanceMeetingCreate).conclusion,
      };
      if (meetingId) {
        const old = await s.meeting(meetingId);
        if (!old || old.guidancePlanId !== planId)
          groupError(404, "COMMON_001", "Không tìm thấy buổi hướng dẫn.");
        const w = this.v.meeting(old),
          i = input as GuidanceMeetingAmend;
        this.review.revision(w.revision, i.expectedRevision);
        content = {
          occurredAt: i.occurredAt ?? old.meetingDate.toISOString(),
          mode: i.mode ?? (w.mode as GuidanceMeetingCreate["mode"]),
          location: i.location === undefined ? old.location : i.location,
          discussion: i.discussion ?? w.discussion!,
          conclusion: i.conclusion ?? w.conclusion!,
        };
        await s.updateMeeting(meetingId, {
          meetingDate: new Date(content.occurredAt),
          location: content.location,
        });
        await s.advanceMeeting(meetingId, w.revision, {
          mode: content.mode,
          discussion: content.discussion,
          conclusion: content.conclusion,
        });
        await s.meetingHistory({
          meetingId,
          actorId: userId,
          reason: i.reason,
          snapshot: json({
            before: {
              occurredAt: old.meetingDate,
              location: old.location,
              mode: w.mode,
              discussion: w.discussion,
              conclusion: w.conclusion,
            },
            after: content,
          }),
        });
        m = (await s.meeting(meetingId))!;
      } else {
        this.review.revision(
          a.plan.pr2bGuidancePlanWorkflowPlanId!.revision,
          (input as GuidanceMeetingCreate).expectedPlanRevision,
        );
        m = await s.addMeeting({
          guidancePlanId: planId,
          meetingDate: new Date(content.occurredAt),
          location: content.location,
          pr2bMeetingWorkflowMeetingId: {
            create: {
              mode: content.mode,
              discussion: content.discussion,
              conclusion: content.conclusion,
              authorUserId: userId,
            },
          },
        });
        await s.meetingHistory({
          meetingId: m.id,
          actorId: userId,
          reason: "MEETING_RECORDED",
          snapshot: json(content),
        });
      }
      await s.advancePlan(
        planId,
        a.plan.pr2bGuidancePlanWorkflowPlanId!.revision,
      );
      await s.guidanceAudit(
        userId,
        planId,
        meetingId ? "GUIDANCE_MEETING_AMENDED" : "GUIDANCE_MEETING_RECORDED",
        json({ meetingId: m.id, contentHash: reviewHash(content) }),
      );
      await this.gv.phase(s, a.p.topic.termId);
      const result = this.meetingView((await s.meeting(m.id))!, true);
      await s.guidanceRemember(userId, method, route, key, hash, json(result));
      return result;
    }, true);
  }
  async amendMeeting(
    userId: string,
    id: string,
    input: GuidanceMeetingAmend,
    key: string,
  ) {
    const planId = await this.repo.transaction(async (s) => {
      const m = await s.meeting(id);
      if (!m) groupError(404, "COMMON_001", "Không tìm thấy nhật ký.");
      await this.guidance.planAccess(s, userId, m.guidancePlanId, "manage");
      return m.guidancePlanId;
    });
    return this.meetingCommand(userId, planId, input, key, id);
  }
}
