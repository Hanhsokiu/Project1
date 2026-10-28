import { beforeEach, describe, expect, it } from "vitest";
import { DefenseConfirmationProgressValidator } from "./defense-confirmation-progress.validator";
import {
  at,
  completedTasks,
  fixture,
} from "./defense-confirmation.test-fixtures";
import type { OfficialAdvisorContext } from "./defense-confirmation.types";

const advisor: OfficialAdvisorContext = {
  state: "OFFICIAL",
  assignmentId: "assignment",
  revision: 0,
  planId: "assignment-plan",
  advisorId: "advisor",
  userId: "advisor-user",
  name: "GVHD",
};
const v = new DefenseConfirmationProgressValidator();
let f: ReturnType<typeof fixture>;
beforeEach(() => {
  f = fixture();
});
const summary = () => v.summarize(f.plan, f.tasks, f.evaluations, advisor, at);

describe("UC17 progress is evidence and warnings, not an automatic decision", () => {
  it("missing plan is MISSING, not zero tasks completed", () => {
    const result = v.summarize(null, [], [], advisor, at);
    expect(result.dataState).toBe("MISSING");
    expect(result.summary.completed).toBe(0);
    expect(result.warnings[0].code).toBe("PROGRESS_DATA_MISSING");
  });
  it("empty tasks/evaluations are explicitly missing even when plan exists", () => {
    const result = v.summarize(f.plan, [], [], advisor, at);
    expect(result.dataState).toBe("PARTIAL");
    expect(result.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining([
        "PROGRESS_TASKS_MISSING",
        "PROGRESS_EVALUATIONS_MISSING",
      ]),
    );
  });
  it("known TODO task is INCOMPLETE and overdue; its data is AVAILABLE", () => {
    const result = summary();
    expect(result.dataState).toBe("AVAILABLE");
    expect(result.summary).toMatchObject({
      completed: 0,
      incomplete: 1,
      unknown: 0,
      overdue: 1,
    });
    expect(result.tasks[0]).toMatchObject({
      dataState: "READY",
      completion: "INCOMPLETE",
      overdue: true,
      review: null,
    });
    expect(result.warnings.map((w) => w.code)).toContain(
      "PROGRESS_TASKS_INCOMPLETE",
    );
  });
  it("COMPLETED requires PASS from the current recorded review", () => {
    f.tasks = completedTasks();
    expect(summary().summary).toMatchObject({
      completed: 1,
      incomplete: 0,
      unknown: 0,
    });
    expect(summary().tasks[0].review).toMatchObject({
      id: "review",
      decision: "PASS",
    });
  });
  it.each(["superseded", "wrong-submission", "failed-review", "no-review"])(
    "does not count completion with %s evidence",
    (problem) => {
      f.tasks = completedTasks();
      const sw =
        f.tasks[0].pr2bTaskWorkflowTaskId!.refCurrentSubmissionId!
          .pr2bSubmissionWorkflowSubmissionId!;
      if (problem === "superseded")
        sw.refEffectiveReviewId!.state = "SUPERSEDED";
      if (problem === "wrong-submission")
        sw.refEffectiveReviewId!.submissionId = "old-submission";
      if (problem === "failed-review")
        sw.refEffectiveReviewId!.decision = "FAIL";
      if (problem === "no-review") sw.refEffectiveReviewId = null;
      expect(summary().summary).toMatchObject({ completed: 0, unknown: 1 });
      expect(summary().tasks[0].dataState).toBe("INCONSISTENT");
    },
  );
  it("legacy task is UNKNOWN even if the old Task.status says reviewed", () => {
    f.tasks[0].status = "REVIEWED";
    f.tasks[0].pr2bTaskWorkflowTaskId = null;
    expect(summary().tasks[0]).toMatchObject({
      completion: "UNKNOWN",
      dataState: "LEGACY",
      overdue: null,
    });
    expect(summary().summary.incomplete).toBe(0);
  });
  it("legacy submissions without a current pointer do not imply submitted/completed", () => {
    f.tasks[0]._count.submissions = 2;
    expect(summary().tasks[0].completion).toBe("UNKNOWN");
  });
  it("cancelled tasks are separate from completed/incomplete", () => {
    f.tasks[0].pr2bTaskWorkflowTaskId!.state = "CANCELLED";
    expect(summary().summary).toMatchObject({
      completed: 0,
      incomplete: 0,
      cancelled: 1,
      overdue: 0,
    });
  });
  it("a known future deadline is not overdue", () => {
    f.tasks[0].deadline = new Date("2026-12-01Z");
    expect(summary().tasks[0].overdue).toBe(false);
  });
  it("old plan assignment is a warning and never determines the official advisor", () => {
    f.plan.advisorId = "previous-advisor";
    const result = summary();
    expect(result.plan!.assignmentChanged).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain(
      "PROGRESS_ASSIGNMENT_CHANGED",
    );
    expect(advisor.advisorId).toBe("advisor");
  });
  it("marks legacy plan and evaluation metadata for reconciliation", () => {
    f.plan.pr2bGuidancePlanWorkflowPlanId = null;
    f.evaluations[0].pr2bEvaluationWorkflowEvaluationId = null;
    const result = summary();
    expect(result.plan!.legacy).toBe(true);
    expect(result.evaluations[0].dataState).toBe("LEGACY");
    expect(result.dataState).toBe("PARTIAL");
  });
  it("returns existing assessment/comment without inventing a missing score", () => {
    expect(summary().evaluations[0]).toMatchObject({
      score: null,
      comment: "Cần bổ sung",
      dataState: "AVAILABLE",
    });
  });
  it("returns student progress notes separately from review evidence and completion", () => {
    const notes = [
      {
        id: "event",
        taskId: "task",
        note: "Em đã làm xong",
        actorId: "student-user",
        createdAt: at,
      },
    ];
    const result = v.summarize(
      f.plan,
      f.tasks,
      f.evaluations,
      advisor,
      at,
      notes,
    );
    expect(result.tasks[0].progressNotes[0]).toMatchObject({
      note: "Em đã làm xong",
      actorId: "student-user",
    });
    expect(result.summary.completed).toBe(0);
    expect(result.summary.incomplete).toBe(1);
  });
});
