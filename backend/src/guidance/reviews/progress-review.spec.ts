import { describe, it, expect, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import {
  ProgressReviewCreateSchema,
  ProgressReviewAmendSchema,
  GuidanceMeetingCreateSchema,
  GuidanceMeetingAmendSchema,
  GuidanceMonitorQuerySchema,
} from "@doan/shared";
import { ProgressReviewValidator } from "./progress-review.validator";
import type { GuidanceTaskRecord } from "../tasks/guidance.repository";
import type { SubmissionRecord } from "../submissions/submission.repository";
import type {
  ProgressReviewRecord,
  MeetingRecord,
} from "./progress-review.repository";
import { NotificationService } from "../../notification/service/notification.service";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
const v = new ProgressReviewValidator();
function fixture() {
  const files = ["REPORT", "SOURCE"].map((kind, n) => ({
    fileId: "f" + n,
    refFileId: { kind, state: "READY", checksum: "h" + n },
  }));
  const sub = {
    id: "s",
    taskId: "t",
    pr2bSubmissionWorkflowSubmissionId: {
      versionNumber: 1,
      revision: 0,
      state: "SUBMITTED",
      submittedAt: new Date(),
      deadlineSnapshot: new Date(),
      isLate: false,
      submittedByUserId: "sv",
      contextSnapshot: {
        planId: "p",
        periodId: "w",
        files: files.map((f) => ({
          fileId: f.fileId,
          checksum: f.refFileId.checksum,
        })),
      },
      effectiveReviewId: null,
    },
    pr2bSubmissionAssetSubmissionId: files,
  } as unknown as SubmissionRecord;
  const task = {
    id: "t",
    guidancePlanId: "p",
    pr2bTaskWorkflowTaskId: {
      state: "SUBMITTED",
      revision: 0,
      currentSubmissionId: "s",
      periodId: "w",
    },
  } as unknown as GuidanceTaskRecord;
  return { sub, task };
}
function fails(fn: () => unknown, code: string) {
  try {
    fn();
    throw Error("expected rejection");
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getResponse()).toMatchObject({
      error: { code },
    });
  }
}
describe("8C progress review rules", () => {
  it("keeps all three decisions and requires comments for FAIL and REVISION_REQUIRED", () => {
    for (const decision of ["PASS", "FAIL", "REVISION_REQUIRED"] as const) {
      const input = {
        expectedTaskRevision: 0,
        expectedSubmissionRevision: 0,
        decision,
        comment: "Nhận xét",
      };
      expect(ProgressReviewCreateSchema.safeParse(input).success).toBe(true);
      expect(() => v.comment(decision, input.comment)).not.toThrow();
      if (decision !== "PASS") {
        fails(() => v.comment(decision, " "), "REVIEW_COMMENT_REQUIRED");
        expect(
          ProgressReviewCreateSchema.safeParse({ ...input, comment: "" })
            .success,
        ).toBe(false);
      }
    }
    expect(
      ProgressReviewCreateSchema.safeParse({
        expectedTaskRevision: 0,
        expectedSubmissionRevision: 0,
        decision: "PASS",
      }).success,
    ).toBe(true);
    expect(
      ProgressReviewCreateSchema.safeParse({
        expectedTaskRevision: 0,
        expectedSubmissionRevision: 0,
        decision: "PASS",
        score: 10,
      }).success,
    ).toBe(false);
  });
  it("accepts exact current submitted version with evidence; rejects stale submission", () => {
    const { task, sub } = fixture();
    expect(v.current(task, sub).sw.versionNumber).toBe(1);
    task.pr2bTaskWorkflowTaskId!.currentSubmissionId = "new";
    fails(() => v.current(task, sub), "STALE_SUBMISSION");
  });
  it("rejects duplicate initial review and invalid states even when version still matches", () => {
    const { task, sub } = fixture();
    sub.pr2bSubmissionWorkflowSubmissionId!.effectiveReviewId = "r";
    fails(() => v.current(task, sub), "REVIEW_ALREADY_RECORDED");
    sub.pr2bSubmissionWorkflowSubmissionId!.effectiveReviewId = null;
    task.pr2bTaskWorkflowTaskId!.state = "CANCELLED";
    fails(() => v.current(task, sub), "STATE_TRANSITION_INVALID");
  });
  it("allows amendment on current effective review only; rejects superseded review and missing reason", () => {
    const { task, sub } = fixture(),
      old = {
        id: "r",
        submissionId: "s",
        state: "RECORDED",
        revision: 0,
      } as ProgressReviewRecord;
    task.pr2bTaskWorkflowTaskId!.state = "COMPLETED";
    sub.pr2bSubmissionWorkflowSubmissionId!.state = "REVIEWED";
    sub.pr2bSubmissionWorkflowSubmissionId!.effectiveReviewId = "r";
    expect(v.current(task, sub, old).tw.state).toBe("COMPLETED");
    old.state = "SUPERSEDED";
    fails(() => v.current(task, sub, old), "STALE_REVIEW");
    const i = {
      expectedTaskRevision: 1,
      expectedSubmissionRevision: 1,
      expectedReviewRevision: 0,
      decision: "FAIL",
      comment: "Làm lại",
      reason: "Đối soát",
    };
    expect(ProgressReviewAmendSchema.safeParse(i).success).toBe(true);
    expect(
      ProgressReviewAmendSchema.safeParse({ ...i, reason: "" }).success,
    ).toBe(false);
  });
  it("only PASS maps to completion while FAIL and revision keep distinct decision values", () => {
    expect(v.taskState("PASS")).toBe("COMPLETED");
    expect(v.taskState("FAIL")).toBe("REVISION_REQUESTED");
    expect(v.taskState("REVISION_REQUIRED")).toBe("REVISION_REQUESTED");
  });
  it("rejects legacy/missing/quarantined/mismatched evidence without guessing metadata", () => {
    const { task, sub } = fixture();
    expect(() => v.current(task, sub)).not.toThrow();
    sub.pr2bSubmissionWorkflowSubmissionId!.contextSnapshot = null;
    fails(() => v.current(task, sub), "INPUT_NOT_READY");
    const other = fixture();
    other.sub.pr2bSubmissionAssetSubmissionId[0].refFileId.state =
      "QUARANTINED";
    fails(() => v.current(other.task, other.sub), "FILE_NOT_READY");
  });
  it("meeting contract requires timezone, mode, discussion/conclusion and reason for amendment", () => {
    const data = {
      expectedPlanRevision: 0,
      occurredAt: "2026-10-23T09:00:00+07:00",
      mode: "ONLINE",
      discussion: "Đã trao đổi",
      conclusion: "Nhiệm vụ tiếp theo",
    };
    expect(GuidanceMeetingCreateSchema.safeParse(data).success).toBe(true);
    expect(
      GuidanceMeetingAmendSchema.safeParse({
        expectedRevision: 0,
        reason: "Bổ sung kết luận",
        conclusion: "Nội dung mới",
      }).success,
    ).toBe(true);
    expect(
      GuidanceMeetingAmendSchema.safeParse({
        expectedRevision: 0,
        reason: "Không thay field",
      }).success,
    ).toBe(false);
    expect(
      GuidanceMeetingCreateSchema.safeParse({
        ...data,
        occurredAt: "2026-10-23T09:00",
      }).success,
    ).toBe(false);
    expect(
      GuidanceMeetingAmendSchema.safeParse({
        ...data,
        expectedPlanRevision: undefined,
        expectedRevision: 0,
        reason: "",
      }).success,
    ).toBe(false);
  });
  it("legacy meeting cannot be silently split into new content, valid metadata can amend", () => {
    const m = {
      pr2bMeetingWorkflowMeetingId: {
        authorUserId: "gv",
        mode: "IN_PERSON",
        discussion: "Nội dung",
        conclusion: "Kết luận",
      },
    } as unknown as MeetingRecord;
    expect(v.meeting(m).mode).toBe("IN_PERSON");
    m.pr2bMeetingWorkflowMeetingId!.discussion = null;
    fails(() => v.meeting(m), "INPUT_NOT_READY");
  });
  it("scope filters are typed and strictly reject cross-term/body actor injection", () => {
    expect(
      GuidanceMonitorQuerySchema.safeParse({
        page: "1",
        studentId: "sv",
        advisorId: "gv",
        decision: "FAIL",
      }).success,
    ).toBe(true);
    expect(
      GuidanceMonitorQuerySchema.safeParse({ page: 1, limit: 1000 }).success,
    ).toBe(false);
    expect(
      GuidanceMonitorQuerySchema.safeParse({
        termId: "different",
        actorId: "other",
      }).success,
    ).toBe(false);
  });
});
describe("8C notification access regression", () => {
  it("legacy recipient route preserves own list but refuses a different user before reading", async () => {
    const legacy = vi.fn(async () => []),
      service = new NotificationService(
        {
          principal: async () => ({ id: "me", status: "ACTIVE" }),
          legacy,
        } as never,
        new ProposalReviewValidator(),
      );
    expect(await service.getUserNotifications("me", "me")).toEqual([]);
    expect(legacy).toHaveBeenCalledTimes(1);
    await expect(
      service.getUserNotifications("me", "other"),
    ).rejects.toMatchObject({ response: { error: { code: "COMMON_001" } } });
    expect(legacy).toHaveBeenCalledTimes(1);
  });
  it("read command is self scoped and missing foreign IDs are not readable", async () => {
    const read = vi.fn(async (user: string, id: string) =>
        id === "own" ? { id, userId: user, status: "READ" } : null,
      ),
      service = new NotificationService(
        {
          principal: async () => ({ id: "me", status: "ACTIVE" }),
          read,
        } as never,
        new ProposalReviewValidator(),
      );
    expect(await service.read("me", "own")).toMatchObject({
      userId: "me",
      status: "READ",
    });
    await expect(service.read("me", "foreign")).rejects.toMatchObject({
      response: { error: { code: "COMMON_001" } },
    });
  });
});
