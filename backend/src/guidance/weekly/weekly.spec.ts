import { describe, it, expect } from "vitest";
import {
  WeeklyPlanCreateSchema,
  WeeklyPlanUpdateSchema,
  WeeklyReportDraftSchema,
  WeeklyReportSubmitSchema,
  WeeklyReopenSchema,
} from "@doan/shared";
import type { WeeklyStudentRow } from "@doan/shared";
import { validateWeeklyDates, weeklyMetrics } from "./weekly.service";
import { GuidanceValidator } from "../tasks/guidance.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { ProgressReviewValidator } from "../reviews/progress-review.validator";
import { SubmissionValidator } from "../submissions/submission.validator";
import type { GuidanceTaskRecord } from "../tasks/guidance.repository";
const plan = {
  ordinal: 1,
  label: "Tuần 1",
  description: "",
  expectedDeliverables: "Báo cáo và mã nguồn",
  allowLate: true,
  startsAt: "2026-11-05T00:00:00+07:00",
  endsAt: "2026-11-12T00:00:00+07:00",
  reportDueAt: "2026-11-11T23:59:59+07:00",
};
const boundary = {
  startDate: new Date("2026-11-01Z"),
  endDate: new Date("2026-12-01Z"),
};
const report = {
  assignedWork: "Thiết kế",
  completedWork: "Hoàn thành ERD",
  results: "ERD đã kiểm tra",
  unfinishedWork: "",
  unfinishedReason: "",
  difficulties: "",
  solutions: "",
  nextWork: "API",
  notes: "",
};
describe("Weekly report contracts and temporal rules", () => {
  it("allows partial drafts but requires substantive official content", () => {
    expect(
      WeeklyReportDraftSchema.safeParse({
        expectedDraftRevision: 0,
        report: {},
      }).success,
    ).toBe(true);
    expect(WeeklyReportSubmitSchema.safeParse(report).success).toBe(true);
    for (const key of ["assignedWork", "completedWork", "results", "nextWork"])
      expect(
        WeeklyReportSubmitSchema.safeParse({ ...report, [key]: " " }).success,
      ).toBe(false);
    expect(
      WeeklyReportSubmitSchema.safeParse({ ...report, unfinishedWork: "API" })
        .success,
    ).toBe(false);
  });
  it("rejects forged owners, roles, review results and timezone-free dates", () => {
    expect(
      WeeklyReportDraftSchema.safeParse({
        expectedDraftRevision: 0,
        report: {},
        studentId: "other",
      }).success,
    ).toBe(false);
    expect(
      WeeklyPlanCreateSchema.safeParse({ ...plan, role: "FACULTY" }).success,
    ).toBe(false);
    expect(
      WeeklyPlanCreateSchema.safeParse({
        ...plan,
        reportDueAt: "2026-11-11T23:59",
      }).success,
    ).toBe(false);
    expect(
      WeeklyReopenSchema.safeParse({
        expectedTaskRevision: 0,
        reason: "",
        revisionDueAt: plan.reportDueAt,
      }).success,
    ).toBe(false);
  });
  it("requires an audit reason for deadline edits", () => {
    expect(
      WeeklyPlanUpdateSchema.safeParse({ ...plan, expectedRevision: 0 })
        .success,
    ).toBe(false);
    expect(
      WeeklyPlanUpdateSchema.safeParse({
        ...plan,
        expectedRevision: 0,
        reason: "Gia hạn",
      }).success,
    ).toBe(true);
  });
  it("validates interval and deadline against the term and GUIDANCE phase", () => {
    expect(() => validateWeeklyDates(plan, boundary, boundary)).not.toThrow();
    for (const dates of [
      { endsAt: plan.startsAt },
      { reportDueAt: plan.startsAt },
      { reportDueAt: "2026-11-13T00:00:00Z" },
      { startsAt: "2026-10-01T00:00:00Z" },
    ])
      expect(() =>
        validateWeeklyDates({ ...plan, ...dates }, boundary, boundary),
      ).toThrow();
  });
  it("treats equality with deadline as on time, even across the UTC+7 day boundary", () => {
    const v = new SubmissionValidator(),
      due = new Date("2026-11-05T00:00:00+07:00");
    expect(v.late(new Date("2026-11-04T17:00:00Z"), due)).toBe(false);
    expect(v.late(new Date(due.getTime() + 1), due)).toBe(true);
  });
  it.each(["DRAFT", "LOCKED"])(
    "blocks writes for %s weeks and mismatched terms",
    (state) => {
      const v = new GuidanceValidator(new ProposalReviewValidator());
      expect(() => v.period({ termId: "a", state }, "a")).toThrow();
      expect(() => v.period({ termId: "b", state: "OPEN" }, "a")).toThrow();
      expect(() => v.period({ termId: "a", state: "OPEN" }, "a")).not.toThrow();
    },
  );
  it.each(["SUBMITTED", "COMPLETED", "CANCELLED"])(
    "does not allow a new version for %s tasks",
    (state) => {
      const task = {
        guidancePlanId: "p",
        pr2bTaskWorkflowTaskId: {
          kind: "WEEKLY_REPORT",
          state,
          startsAt: new Date(),
          periodId: "w",
          planId: "p",
          nextSubmissionNumber: 2,
        },
      } as unknown as GuidanceTaskRecord;
      expect(() => new SubmissionValidator().task(task)).toThrow();
    },
  );
  it("requires a future revision deadline strictly before phase end, including extension beyond week end", () => {
    const v = new ProgressReviewValidator(),
      now = new Date("2026-11-05Z"),
      end = new Date("2026-12-01Z");
    expect(
      v.deadline("REVISION_REQUIRED", "2026-11-20T00:00:00Z", end, now),
    ).toEqual(new Date("2026-11-20Z"));
    for (const due of [undefined, "bad", now.toISOString(), end.toISOString()])
      expect(() => v.deadline("REVISION_REQUIRED", due, end, now)).toThrow();
    expect(() => v.deadline("PASS", plan.reportDueAt, end, now)).toThrow();
  });
  it("counts students per obligation, independently of version count and lateness", () => {
    const rows = [
      { status: "PASS", isLate: true, versionNumber: 3 },
      { status: "NOT_SUBMITTED", isLate: null },
      { status: "PENDING", isLate: false },
    ] as WeeklyStudentRow[];
    expect(weeklyMetrics(rows)).toEqual({
      PASS: 1,
      FAIL: 0,
      REVISION_REQUIRED: 0,
      NOT_SUBMITTED: 1,
      PENDING: 1,
      LATE: 1,
    });
    expect(Object.values(weeklyMetrics([])).every((n) => n === 0)).toBe(true);
  });
});
