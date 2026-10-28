import { describe, it, expect } from "vitest";
import {
  buildDecisionInput,
  contextReviewKey,
  decisionInputSchema,
} from "./validation";
import { contextFixture } from "./test-fixtures";

const form = {
  status: "CONFIRMED" as const,
  note: "",
  changeReason: "",
  reviewed: true,
};
describe("UC17 decision form and backend expectations", () => {
  it("copies backend expectations without calculating them from visible fields; incomplete tasks only warn", () => {
    const c = contextFixture();
    c.advisor = { state: "NOT_READY", issues: [] }; // Expectations are never reconstructed here.
    const result = buildDecisionInput(c, form);
    expect(result.expectedContext).toEqual(c.expectedContext);
    expect(result.expectedRevision).toBe(c.expectedRevision);
    expect(c.progress.summary.incomplete).toBeGreaterThan(0);
    expect(Object.keys(result).sort()).toEqual([
      "expectedContext",
      "expectedRevision",
      "note",
      "status",
    ]);
  });
  it("requires explicit review, not a completed download", () => {
    expect(() =>
      buildDecisionInput(contextFixture(), { ...form, reviewed: false }),
    ).toThrow("xem lại");
  });
  it("REJECTED requires a nonblank reason", () => {
    expect(() =>
      buildDecisionInput(contextFixture(), {
        ...form,
        status: "REJECTED",
        note: " \n ",
      }),
    ).toThrow("lý do");
    expect(
      buildDecisionInput(contextFixture(), {
        ...form,
        status: "REJECTED",
        note: " Cần chỉnh sửa ",
      }).note,
    ).toBe("Cần chỉnh sửa");
  });
  it("can reject without a PDF when backend allows it", () => {
    const c = contextFixture();
    c.expectedContext!.pdf = null;
    c.pdf.state = "NOT_SUBMITTED";
    c.pdf.snapshot = null;
    c.readiness.confirm = {
      allowed: false,
      blockers: [{ code: "PDF_REQUIRED", message: "Thiếu PDF" }],
    };
    expect(
      buildDecisionInput(c, {
        ...form,
        status: "REJECTED",
        note: "Chưa hoàn thành",
      }).expectedContext.pdf,
    ).toBeNull();
    expect(() => buildDecisionInput(c, form)).toThrow("Thiếu PDF");
  });
  it("requires changeReason for replacing an existing or legacy decision", () => {
    const c = contextFixture();
    c.changeReasonRequiredForChanges = true;
    expect(() => buildDecisionInput(c, form)).toThrow("lý do thay đổi");
    expect(
      buildDecisionInput(c, { ...form, changeReason: " Đã xem bản PDF mới " })
        .changeReason,
    ).toBe("Đã xem bản PDF mới");
  });
  it.each(["UNKNOWN", "FINALIZED", "CLOSED", "LOCKED"])(
    "honors server blockers for %s",
    (state) => {
      const c = contextFixture();
      c.readiness.confirm = {
        allowed: false,
        blockers: [{ code: state, message: `Không được ghi: ${state}` }],
      };
      expect(() => buildDecisionInput(c, form)).toThrow(state);
    },
  );
  it("missing decide permission blocks even if a readiness flag is true", () => {
    const c = contextFixture();
    c.permissions.canDecide = false;
    expect(() => buildDecisionInput(c, form)).toThrow();
  });
  it("cannot submit null/mismatched expectations or extra authority fields", () => {
    const c = contextFixture();
    c.expectedContext = null;
    expect(() => buildDecisionInput(c, form)).toThrow();
    const valid = buildDecisionInput(contextFixture(), form);
    expect(
      decisionInputSchema.safeParse({ ...valid, expectedRevision: 2 }).success,
    ).toBe(false);
    expect(
      decisionInputSchema.safeParse({ ...valid, actorId: "client-actor" })
        .success,
    ).toBe(false);
    expect(
      decisionInputSchema.safeParse({ ...valid, advisorId: "client-advisor" })
        .success,
    ).toBe(false);
  });
  it("rejects oversize notes, invalid statuses, revisions and checksum", () => {
    const valid = buildDecisionInput(contextFixture(), form);
    for (const change of [
      { note: "x".repeat(10001) },
      { status: "PENDING" },
      { expectedRevision: -1 },
      { expectedRevision: 2147483647 },
    ])
      expect(
        decisionInputSchema.safeParse({ ...valid, ...change }).success,
      ).toBe(false);
    const c = contextFixture();
    c.expectedContext!.pdf!.checksum = "invalid";
    expect(() => buildDecisionInput(c, form)).toThrow();
  });
  it("requires a new UI acknowledgement after same-checksum reupload, assignment, window or context refresh", () => {
    const original = contextFixture(),
      key = contextReviewKey(original);
    for (const update of [
      (c: ReturnType<typeof contextFixture>) => {
        c.expectedContext!.pdf!.revision++;
      },
      (c: ReturnType<typeof contextFixture>) => {
        c.expectedContext!.assignment.revision++;
      },
      (c: ReturnType<typeof contextFixture>) => {
        c.window.revision++;
      },
      (c: ReturnType<typeof contextFixture>) => {
        c.asOf = "2026-10-27T12:01:00Z";
      },
    ]) {
      const c = contextFixture();
      update(c);
      expect(contextReviewKey(c)).not.toBe(key);
    }
  });
});
