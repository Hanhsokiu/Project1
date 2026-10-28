import { describe, it, expect } from "vitest";
import { HttpException } from "@nestjs/common";
import {
  GuidanceTaskCreateSchema,
  GuidanceTaskUpdateSchema,
  GuidanceTaskProgressSchema,
  GuidancePlanResumeSchema,
} from "@doan/shared";
import { GuidanceValidator } from "./guidance.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../../topic/proposal-reviews/proposal-review.validator";
import type {
  GuidanceTaskRecord,
  GuidanceSession,
  ObligationRecord,
} from "./guidance.repository";
const v = new GuidanceValidator(new ProposalReviewValidator());
const fail = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw Error("Expected error");
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getResponse()).toMatchObject({
      error: { code },
    });
  }
};
const create = {
  expectedPlanRevision: 0,
  title: "Phân tích yêu cầu",
  description: "Mô tả",
  expectedDeliverables: "Tài liệu yêu cầu",
  periodId: "week1",
  startDate: "2026-10-22T08:00:00+07:00",
  dueDate: "2026-10-23T08:00:00+07:00",
};
const task = (state = "TODO") =>
  ({
    id: "t",
    guidancePlanId: "p",
    submissions: [],
    pr2bTaskWorkflowTaskId: {
      state,
      kind: "AD_HOC",
      planId: "p",
      periodId: "week1",
      startsAt: new Date(create.startDate),
      expectedDeliverables: "Tài liệu",
    },
  }) as unknown as GuidanceTaskRecord;
describe("Step 8A input and temporal contracts", () => {
  it("accepts timezone-aware task input, rejects unknown actor/status and timestamps without offset", () => {
    expect(GuidanceTaskCreateSchema.safeParse(create).success).toBe(true);
    for (const value of [
      { ...create, advisorId: "forged" },
      { ...create, status: "COMPLETED" },
      { ...create, dueDate: "2026-10-23T08:00" },
      { ...create, dueDate: create.startDate },
    ])
      expect(GuidanceTaskCreateSchema.safeParse(value).success).toBe(false);
  });
  it("requires revision/reason on edits and preserves empty optional descriptions", () => {
    expect(
      GuidanceTaskUpdateSchema.safeParse({
        expectedRevision: 0,
        description: "",
        reason: "Làm rõ",
      }).success,
    ).toBe(true);
    expect(
      GuidanceTaskUpdateSchema.safeParse({
        expectedRevision: 0,
        title: "Đổi tên",
      }).success,
    ).toBe(false);
    expect(
      GuidanceTaskUpdateSchema.safeParse({
        expectedRevision: 0,
        reason: "Không có thay đổi",
      }).success,
    ).toBe(false);
  });
  it("accepts dates in phase and rejects deadline exactly at exclusive end", () => {
    const phase = {
      startDate: new Date(create.startDate),
      endDate: new Date(create.dueDate),
    };
    expect(() =>
      v.dates(phase.startDate, new Date(phase.endDate.getTime() - 1), phase),
    ).not.toThrow();
    fail(
      () => v.dates(phase.startDate, phase.endDate, phase),
      "DEADLINE_OUTSIDE_PHASE",
    );
    fail(
      () => v.dates(phase.endDate, phase.startDate, phase),
      "TASK_DATES_INVALID",
    );
  });
  it("derives overdue independently of workflow and respects exact deadline/completed/cancelled", () => {
    const due = new Date("2026-10-22T00:00:00Z");
    expect(v.overdue(due, "TODO", due)).toBe(false);
    expect(v.overdue(due, "IN_PROGRESS", new Date(due.getTime() + 1))).toBe(
      true,
    );
    expect(v.overdue(due, "COMPLETED", new Date(due.getTime() + 1))).toBe(
      false,
    );
    expect(v.overdue(due, "CANCELLED", new Date(due.getTime() + 1))).toBe(
      false,
    );
  });
});
describe("Step 8A workflow/legacy protection", () => {
  it("accepts FINALIZED without paper receipt and rejects topic revision changed after the official snapshot", async () => {
    const content = {
      schemaVersion: 1,
      objectives: "Mục tiêu",
      scope: "Phạm vi",
      mainContents: "Nội dung",
      tools: "Công nghệ",
      expectedResults: "Sản phẩm",
      startsAt: create.startDate,
      endsAt: create.dueDate,
      schedule: [
        {
          label: "Phân tích",
          startsAt: create.startDate,
          endsAt: create.dueDate,
          deliverables: "Tài liệu",
        },
      ],
    };
    const snapshot = {
      schemaVersion: 1,
      student: { id: "student" },
      topicRevision: 0,
      content,
    };
    const owner = {
      termId: "term",
      termStudentId: "ts",
      revision: 0,
      refTermStudentId: { termId: "term", studentId: "student" },
    };
    const p = {
      id: "p",
      studentId: "student",
      status: "APPROVED",
      topic: { termId: "term", pr2bTopicWorkflowTopicId: owner },
      pr2bProposalWorkflowProposalId: {
        workingVersionId: "v",
        submittedVersionId: "v",
      },
    } as Parameters<GuidanceValidator["finalized"]>[1];
    const final = {
      id: "f",
      versionId: "v",
      approvalDecisionId: "decision",
      supersededAt: null,
      printSnapshot: snapshot,
      contentHash: reviewHash(snapshot),
      finalizedAt: new Date("2020-01-01Z"),
    };
    const s = {
      dossier: async () => ({
        pr2bDossierWorkflowDossierId: {
          state: "FINALIZED",
          currentFinalizationId: "f",
        },
        pr2bDossierFinalizationDossierId: [final],
      }),
      version: async () => ({
        proposalId: "p",
        content,
        pr2bProposalVersionWorkflowVersionId: {
          state: "SEALED",
          contentHash: reviewHash(content),
        },
      }),
    } as unknown as GuidanceSession;
    await expect(v.finalized(s, p)).resolves.toMatchObject({ f: { id: "f" } });
    owner.revision = 1;
    await expect(v.finalized(s, p)).rejects.toMatchObject({
      response: { error: { code: "DOSSIER_NOT_FINALIZED" } },
    });
  });
  it("allows progress from TODO/IN_PROGRESS/revision but rejects self-completion and submitted states", () => {
    for (const state of ["TODO", "IN_PROGRESS", "REVISION_REQUESTED"])
      expect(v.progress(task(state)).state).toBe(state);
    fail(() => v.progress(task("COMPLETED")), "STATE_TRANSITION_INVALID");
    fail(() => v.progress(task("SUBMITTED")), "STATE_TRANSITION_INVALID");
    expect(
      GuidanceTaskProgressSchema.safeParse({
        expectedRevision: 0,
        note: "Đang thực hiện",
        status: "COMPLETED",
      }).success,
    ).toBe(false);
  });
  it("blocks legacy tasks with missing start/deliverable metadata", () => {
    const t = task();
    expect(() => v.editable(t)).not.toThrow();
    t.pr2bTaskWorkflowTaskId!.startsAt = null;
    fail(() => v.editable(t), "INPUT_NOT_READY");
    fail(() => v.progress(t), "INPUT_NOT_READY");
  });
  it("requires acknowledgement to amend a task that already has submissions", () => {
    const t = task();
    t.submissions.push({ id: "existing" });
    fail(() => v.editable(t), "ACKNOWLEDGEMENT_REQUIRED");
    expect(() => v.editable(t, true)).not.toThrow();
    fail(() => v.editable(task("CANCELLED"), true), "STATE_TRANSITION_INVALID");
  });
  it("requires explicit rebase acknowledgement and rejects forged advisor ID", () => {
    const input = {
      expectedRevision: 0,
      expectedDossierRevision: 1,
      finalizationId: "f",
      acknowledgeRebase: true,
    };
    expect(GuidancePlanResumeSchema.safeParse(input).success).toBe(true);
    expect(
      GuidancePlanResumeSchema.safeParse({ ...input, acknowledgeRebase: false })
        .success,
    ).toBe(false);
    expect(
      GuidancePlanResumeSchema.safeParse({ ...input, advisorId: "forged" })
        .success,
    ).toBe(false);
  });
  it("validates weekly obligation snapshot against exact period/owner/revision", () => {
    const o = {
      termStudentId: "ts",
      configRevision: 1,
      configSnapshot: {
        schemaVersion: 1,
        periodId: "w",
        termStudentId: "ts",
        termId: "term",
        periodRevision: 1,
        startsAt: create.startDate,
        reportDueAt: create.dueDate,
        expectedDeliverables: "Báo cáo",
      },
      refPeriodId: {
        id: "w",
        termId: "term",
        type: "WEEK",
        revision: 1,
        startsAt: new Date(create.startDate),
        reportDueAt: new Date(create.dueDate),
      },
    } as unknown as ObligationRecord;
    expect(v.obligation(o, "ts", "term").expectedDeliverables).toBe("Báo cáo");
    fail(
      () => v.obligation(o, "other", "term"),
      "REPORTING_SCOPE_NOT_CONFIGURED",
    );
    o.configRevision = 2;
    fail(() => v.obligation(o, "ts", "term"), "REPORTING_SCOPE_NOT_CONFIGURED");
  });
});
