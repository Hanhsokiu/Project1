import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  defenseConfirmationParamsSchema,
  defenseConfirmationPutSchema,
} from "./defense-confirmation.dto";
import { commandFixture } from "./defense-confirmation-command.test-fixtures";

describe("UC17 decision request and authority validation", () => {
  it("accepts the minimal expected context and trims text without using it as a persisted snapshot", () => {
    const f = commandFixture(),
      input = { ...f.input("REJECTED"), note: "  Chưa đạt  " };
    expect(f.command.input(input).note).toBe("Chưa đạt");
    expect(defenseConfirmationPutSchema.safeParse(f.input()).success).toBe(
      true,
    );
  });
  it.each([
    "actorId",
    "advisorId",
    "studentId",
    "decidedAt",
    "confirmedAt",
    "decisionContext",
    "pdfSnapshot",
    "assignmentSnapshot",
    "storageKey",
  ])("rejects client-controlled %s", (field) => {
    const f = commandFixture();
    expect(() =>
      f.command.input({ ...f.input(), [field]: "spoofed" }),
    ).toThrow();
  });
  it("rejects full PDF/assignment snapshot fields even nested inside expectedContext", () => {
    const f = commandFixture(),
      input = f.input();
    expect(
      defenseConfirmationPutSchema.safeParse({
        ...input,
        expectedContext: {
          ...input.expectedContext,
          pdf: { ...input.expectedContext.pdf, originalName: "spoofed.pdf" },
        },
      }).success,
    ).toBe(false);
    expect(
      defenseConfirmationPutSchema.safeParse({
        ...input,
        expectedContext: {
          ...input.expectedContext,
          assignment: {
            ...input.expectedContext.assignment,
            advisorId: "spoofed",
          },
        },
      }).success,
    ).toBe(false);
  });
  it.each(["PENDING", "ELIGIBLE", "confirmed", null])(
    "rejects unsupported status %s",
    (status) => {
      const f = commandFixture();
      expect(() => f.command.input({ ...f.input(), status })).toThrow();
    },
  );
  it.each([-1, 1.5, "0", 2147483647])(
    "rejects invalid expectedRevision %s",
    (revision) => {
      const f = commandFixture();
      expect(() =>
        f.command.input({ ...f.input(), expectedRevision: revision }),
      ).toThrow();
    },
  );
  it("requires expectedContext and matching inner revision", () => {
    const f = commandFixture();
    expect(() =>
      f.command.input({ status: "CONFIRMED", expectedRevision: 0 }),
    ).toThrow();
    const input = f.input();
    input.expectedContext.revision++;
    expect(() => f.command.input(input)).toThrow();
  });
  it("bounds note/reason and rejects blank changeReason", () => {
    const f = commandFixture();
    for (const extra of [
      { note: "a".repeat(10001) },
      { changeReason: "a".repeat(10001) },
      { changeReason: " " },
    ])
      expect(() => f.command.input({ ...f.input(), ...extra })).toThrow();
  });
  it("requires a fitting proposal key without accepting arbitrary extra route parameters", () => {
    expect(
      defenseConfirmationParamsSchema.safeParse({ proposalId: "proposal" })
        .success,
    ).toBe(true);
    for (const value of [
      { proposalId: "" },
      { proposalId: "x".repeat(37) },
      { proposalId: "proposal", actorId: "spoofed" },
    ])
      expect(defenseConfirmationParamsSchema.safeParse(value).success).toBe(
        false,
      );
  });
  it("requires both lecturer/account readiness and an explicit decision permission", () => {
    const f = commandFixture();
    expect(f.command.principal(f.state.user, "advisor-user")).toBe(
      f.state.user,
    );
    f.state.user!.mustChangePassword = true;
    expect(() => f.command.principal(f.state.user, "advisor-user")).toThrow();
    f.state.user!.mustChangePassword = false;
    f.state.user!.lecturer!.isActive = false;
    expect(() => f.command.principal(f.state.user, "advisor-user")).toThrow();
  });
});
