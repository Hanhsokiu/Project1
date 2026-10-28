import { describe, expect, it } from "vitest";
import {
  gradingDraftSchema,
  gradingHistoryQuerySchema,
  gradingPolicyInputSchema,
  gradingPolicySchema,
  gradingRubricSchema,
} from "@doan/shared";
import { calculateGrades, scoreDraft, assertOpen } from "./grading.policy";
import { calculationForTest, configForTest } from "./grading.test-fixtures";
import {
  UnknownAdvisorGradeReader,
  UnknownCouncilResultConfirmationReader,
} from "./advisor-grade.port";
import type { Prisma } from "@prisma/client";

describe("Grading explicit versioned policies, no default approval", () => {
  it("UTC documented example: advisor9/reviewer7/council7.5,8,8.5,9 = 8.15", () => {
    expect(calculateGrades(calculationForTest, 9, 7, [7.5, 8, 8.5, 9])).toEqual(
      { process: 8, committee: 8.25, final: 8.15, passed: true },
    );
  });
  it("does not let high HP override a failed process or council component", () => {
    expect(calculateGrades(calculationForTest, 0, 8, [10, 10, 10]).passed).toBe(
      false,
    );
    expect(calculateGrades(calculationForTest, 10, 10, [4, 4, 4]).passed).toBe(
      false,
    );
  });
  it("decimal HALF_UP rounding profiles are explicit, including pass RAW versus ROUNDED", () => {
    const p = structuredClone(calculationForTest);
    p.rounding.processDecimals = 1;
    p.rounding.committeeDecimals = 1;
    p.rounding.finalDecimals = 1;
    expect(calculateGrades(p, 8.15, 8.15, [8.15]).final).toBe(8.2);
    expect(calculateGrades(p, 4.96, 4.96, [4.96]).passed).toBe(true);
    p.rounding.passOn = "RAW";
    expect(calculateGrades(p, 4.96, 4.96, [4.96]).passed).toBe(false);
  });
  it.each([NaN, Infinity, -1, 11])("rejects invalid score %s", (value) => {
    expect(() => calculateGrades(calculationForTest, value, 8, [8])).toThrow();
  });
  it("no member scores is missing data, not zero", () => {
    expect(() => calculateGrades(calculationForTest, 8, 8, [])).toThrow();
  });
  it("zero component is a valid entered mark", () => {
    expect(
      scoreDraft(
        { values: { A: 0 }, comment: "0", questions: [] },
        [{ code: "A", label: "A", maxScore: 10 }],
        true,
      ),
    ).toBe(0);
  });
  it("empty draft and incomplete draft never fabricate a total", () => {
    expect(
      scoreDraft(
        { values: {}, comment: "", questions: [] },
        [{ code: "A", label: "A", maxScore: 10 }],
        false,
      ),
    ).toBe(null);
  });
  it.each([0.001, -0.1, 10.01, NaN])(
    "input rejects off-scale/precision score %s",
    (v) => {
      expect(
        gradingDraftSchema.safeParse({
          values: { A: v },
          comment: "",
          questions: [],
        }).success,
      ).toBe(false);
    },
  );
  it("committee rubric must explicitly sum to 10 with unique stable codes", () => {
    expect(
      gradingRubricSchema.safeParse([{ code: "A", label: "x", maxScore: 8 }])
        .success,
    ).toBe(false);
    expect(
      gradingRubricSchema.safeParse([
        { code: "A", label: "x", maxScore: 5 },
        { code: "A", label: "y", maxScore: 5 },
      ]).success,
    ).toBe(false);
  });
  it("configure cannot self-confirm a candidate calculation policy", () => {
    const config = structuredClone(configForTest);
    config.calculation = {
      state: "CONFIRMED",
      policy: calculationForTest,
      confirmedByUserId: "faculty",
      confirmedAt: "2026-10-28T00:00:00Z",
    };
    expect(gradingPolicySchema.safeParse(config).success).toBe(true);
    expect(
      gradingPolicyInputSchema.safeParse({
        expectedRevision: 0,
        expectedContext: "a".repeat(64),
        requestId: "a".repeat(16),
        config,
      }).success,
    ).toBe(false);
  });
  it("window close boundary is exclusive; UNKNOWN cannot imply OPEN", () => {
    expect(() => assertOpen(null, "REVIEWER", new Date())).toThrow();
    expect(() =>
      assertOpen(
        configForTest,
        "REVIEWER",
        new Date(configForTest.windows.REVIEWER.closesAt),
      ),
    ).toThrow();
  });
  it("history limits protect unbounded reads", () => {
    expect(gradingHistoryQuerySchema.parse({})).toEqual({
      afterRevision: 0,
      limit: 25,
    });
    expect(gradingHistoryQuerySchema.safeParse({ limit: 101 }).success).toBe(
      false,
    );
  });
  it("unapproved advisor and council sources remain UNKNOWN using caller transaction", async () => {
    const tx = {} as Prisma.TransactionClient;
    expect(
      await new UnknownAdvisorGradeReader().read("term", "proposal", tx),
    ).toEqual({ state: "UNKNOWN" });
    expect(
      await new UnknownCouncilResultConfirmationReader().read(
        "term",
        "proposal",
        tx,
      ),
    ).toEqual({ state: "UNKNOWN" });
  });
});
