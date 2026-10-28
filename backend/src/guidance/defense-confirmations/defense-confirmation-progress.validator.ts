import { Injectable } from "@nestjs/common";
import type { DefenseConfirmationSession } from "./defense-confirmation.repository";
import type {
  OfficialAdvisorContext,
  ProgressContext,
  TaskContext,
} from "./defense-confirmation.types";

type Plan = Awaited<ReturnType<DefenseConfirmationSession["planFor"]>>;
type Tasks = Awaited<ReturnType<DefenseConfirmationSession["monitorTasks"]>>;
type Evaluations = Awaited<
  ReturnType<DefenseConfirmationSession["evaluations"]>
>;
type Events = Awaited<ReturnType<DefenseConfirmationSession["taskProgress"]>>;
const iso = (d: Date | null | undefined) =>
  d instanceof Date && Number.isFinite(d.getTime()) ? d.toISOString() : null;

@Injectable()
export class DefenseConfirmationProgressValidator {
  summarize(
    plan: Plan,
    rows: Tasks,
    evaluations: Evaluations,
    advisor: OfficialAdvisorContext,
    at: Date,
    events: Events = [],
  ): ProgressContext {
    const warnings: ProgressContext["warnings"] = [];
    const warn = (code: string, message: string) =>
      warnings.push({ code, message });
    if (!plan) {
      return {
        dataState: "MISSING",
        plan: null,
        tasks: [],
        evaluations: [],
        summary: {
          total: 0,
          completed: 0,
          incomplete: 0,
          cancelled: 0,
          unknown: 0,
          overdue: 0,
        },
        warnings: [
          {
            code: "PROGRESS_DATA_MISSING",
            message:
              "Chưa có kế hoạch hướng dẫn; không thể kết luận nhiệm vụ đã hoàn thành.",
          },
        ],
      };
    }
    const workflow = plan.pr2bGuidancePlanWorkflowPlanId,
      legacyPlan =
        !workflow?.state ||
        !workflow.assignmentId ||
        workflow.assignmentRevision === null,
      assignmentChanged =
        advisor.state !== "OFFICIAL" || legacyPlan
          ? null
          : workflow.assignmentId !== advisor.assignmentId ||
            workflow.assignmentRevision !== advisor.revision ||
            plan.advisorId !== advisor.advisorId;
    if (legacyPlan)
      warn(
        "PROGRESS_PLAN_LEGACY",
        "Kế hoạch hướng dẫn thiếu metadata chính thức.",
      );
    if (assignmentChanged)
      warn(
        "PROGRESS_ASSIGNMENT_CHANGED",
        "Kế hoạch tiến độ đang gắn phân công cũ; không dùng để xác định GVHD hiện hành.",
      );
    const tasks = rows.map((t): TaskContext => {
      const w = t.pr2bTaskWorkflowTaskId,
        sub = w?.refCurrentSubmissionId,
        sw = sub?.pr2bSubmissionWorkflowSubmissionId,
        r = sw?.refEffectiveReviewId;
      const legacy =
        !w?.state ||
        !w.kind ||
        !w.startsAt ||
        !w.periodId ||
        w.planId !== plan.id ||
        (!w.currentSubmissionId && t._count.submissions > 0) ||
        (!!w.currentSubmissionId && !sw?.contextSnapshot);
      const hasSubmission =
        !!sub &&
        !!sw &&
        sub.id === w?.currentSubmissionId &&
        sub.taskId === t.id &&
        sw.submissionId === sub.id &&
        sw.taskId === t.id &&
        ["SUBMITTED", "REVIEWED"].includes(sw.state ?? "") &&
        Number.isInteger(sw.versionNumber) &&
        sw.versionNumber! > 0 &&
        !!iso(sw.submittedAt);
      const hasReview =
        hasSubmission &&
        !!r &&
        sw!.effectiveReviewId === r.id &&
        r.submissionId === sub!.id &&
        r.state === "RECORDED" &&
        sw!.state === "REVIEWED" &&
        !!iso(r.recordedAt);
      const inconsistent =
        !legacy &&
        ((w!.currentSubmissionId !== null && !hasSubmission) ||
          (["SUBMITTED", "COMPLETED", "REVISION_REQUESTED"].includes(
            w!.state!,
          ) &&
            !hasSubmission) ||
          (w!.state === "COMPLETED" &&
            (!hasReview || r!.decision !== "PASS")) ||
          (w!.state === "REVISION_REQUESTED" &&
            (!hasReview || r!.decision === "PASS")) ||
          (!!sw?.effectiveReviewId && !hasReview));
      const dataState = legacy
        ? "LEGACY"
        : inconsistent
          ? "INCONSISTENT"
          : "READY";
      const completion =
        dataState !== "READY"
          ? "UNKNOWN"
          : w!.state === "CANCELLED"
            ? "CANCELLED"
            : w!.state === "COMPLETED"
              ? "COMPLETE"
              : "INCOMPLETE";
      return {
        id: t.id,
        title: t.title,
        state: w?.state ?? null,
        dataState,
        completion,
        deadline: iso(t.deadline),
        overdue:
          completion === "UNKNOWN" || !iso(t.deadline)
            ? null
            : completion === "INCOMPLETE" && at > t.deadline,
        progressNotes: events
          .filter((e) => e.taskId === t.id && iso(e.createdAt))
          .map((e) => ({
            id: e.id,
            note: e.note,
            actorId: e.actorId,
            createdAt: e.createdAt.toISOString(),
          })),
        submission: hasSubmission
          ? {
              id: sub!.id,
              version: sw!.versionNumber!,
              submittedAt: sw!.submittedAt!.toISOString(),
            }
          : null,
        review: hasReview
          ? {
              id: r!.id,
              decision: r!.decision,
              comment: r!.comment,
              recordedAt: r!.recordedAt.toISOString(),
            }
          : null,
      };
    });
    const assessment = evaluations.map((e) => {
      const w = e.pr2bEvaluationWorkflowEvaluationId;
      return {
        id: e.id,
        phaseName: e.phaseName,
        score: e.score === null ? null : Number(e.score),
        comment: e.comment,
        evaluatedAt: iso(e.evaluatedAt),
        dataState: (w?.planId === plan.id &&
        w.evaluatorUserId &&
        w.criteriaSnapshot &&
        w.criterionScores &&
        iso(e.evaluatedAt)
          ? "AVAILABLE"
          : "LEGACY") as "AVAILABLE" | "LEGACY",
      };
    });
    const summary = {
      total: tasks.length,
      completed: tasks.filter((t) => t.completion === "COMPLETE").length,
      incomplete: tasks.filter((t) => t.completion === "INCOMPLETE").length,
      cancelled: tasks.filter((t) => t.completion === "CANCELLED").length,
      unknown: tasks.filter((t) => t.completion === "UNKNOWN").length,
      overdue: tasks.filter((t) => t.overdue === true).length,
    };
    if (!tasks.length)
      warn(
        "PROGRESS_TASKS_MISSING",
        "Chưa có dữ liệu nhiệm vụ; không đồng nghĩa đã hoàn thành.",
      );
    if (!assessment.length)
      warn("PROGRESS_EVALUATIONS_MISSING", "Chưa có dữ liệu đánh giá mốc.");
    if (summary.unknown)
      warn(
        "PROGRESS_TASK_DATA_UNVERIFIED",
        "Có nhiệm vụ legacy hoặc chứng cứ hoàn thành chưa nhất quán.",
      );
    if (assessment.some((e) => e.dataState === "LEGACY"))
      warn(
        "PROGRESS_EVALUATION_LEGACY",
        "Có đánh giá thiếu metadata chính thức.",
      );
    if (summary.incomplete)
      warn(
        "PROGRESS_TASKS_INCOMPLETE",
        "Có nhiệm vụ chưa hoàn thành; đây là cảnh báo cho GVHD.",
      );
    return {
      dataState:
        legacyPlan ||
        assignmentChanged ||
        summary.unknown ||
        !tasks.length ||
        !assessment.length ||
        assessment.some((e) => e.dataState === "LEGACY")
          ? "PARTIAL"
          : "AVAILABLE",
      plan: {
        id: plan.id,
        state: workflow?.state ?? null,
        legacy: legacyPlan,
        assignmentChanged,
      },
      tasks,
      summary,
      evaluations: assessment,
      warnings,
    };
  }
}
