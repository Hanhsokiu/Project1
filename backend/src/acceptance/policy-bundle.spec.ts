import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { buildAcceptancePolicies } from "./policy-bundle";
import { FinalDefenseValidator } from "../guidance/final-defense/final-defense.validator";
import { EligibilityValidator } from "../defense/eligibility/eligibility.validator";
import { CommitteeValidator } from "../defense/committees/committee.validator";
import { ReviewerValidator } from "../defense/reviewers/reviewer.validator";
import { ScheduleValidator } from "../defense/scheduling/schedule.validator";
import { ReviewerGradeValidator } from "../defense/reviewer-grading/reviewer-grade.validator";
import { CommitteeGradeValidator } from "../defense/committee-grading/committee-grade.validator";
import { ReportTemplates } from "../report/defense-reporting/report-templates";
import type { ReviewerGradeCommand } from "@doan/shared";

export function acceptanceContext() {
  return {
    runId: "DATN-E2E-B1B10-TEST-unit-only",
    termId: randomUUID(), departmentId: randomUUID(), roomId: randomUUID(),
    approvedBy: randomUUID(), approvedAt: new Date(Date.now() - 1000).toISOString(),
    startAt: "2020-01-01T00:00:00Z", endAt: "2035-01-01T00:00:00Z",
    defenseDate: "2030-01-02", reviewerCriteriaIds: Array.from({length:5}, () => randomUUID()),
    committeeCriteriaIds: Array.from({length:5}, () => randomUUID()),
  };
}
describe("project acceptance policies are concrete, term-bound technical choices", () => {
  it("builds all nine strict contracts without invented human identity or time", () => {
    const c = acceptanceContext(), b = buildAcceptancePolicies(c);
    expect(Object.keys(b.policies)).toHaveLength(9);
    for (const p of Object.values(b.policies)) {
      expect(p.approvedBy).toBe(c.approvedBy);
      expect(p.approvedAt).toBe(c.approvedAt);
      expect(p.version).toBe(c.runId);
    }
    expect(b.termId).toBe(c.termId);
    expect(b.policies.UC24_POLICY.reference).toContain("NOT faculty regulations");
    expect(b.policies.UC24_POLICY.components).toEqual([
      { source: "ADVISOR_UC17", weight: "0.2" }, { source: "REVIEWER", weight: "0.2" }, { source: "COMMITTEE", weight: "0.6" },
    ]);
  });
  it("real validators accept UC17 through UC23 policy bodies", () => {
    const p = buildAcceptancePolicies(acceptanceContext()).policies;
    const checks = [
      [new FinalDefenseValidator(), p.UC17_POLICY],
      [new EligibilityValidator(), p.UC18_POLICY],
      [new CommitteeValidator(), p.UC19_POLICY],
      [new ReviewerValidator(), p.UC20_POLICY],
      [new ScheduleValidator(), p.UC21_POLICY],
      [new ReviewerGradeValidator(), p.UC22_POLICY],
      [new CommitteeGradeValidator(), p.UC23_POLICY],
    ] as const;
    for (const [validator, policy] of checks)
      expect(validator.policy(JSON.stringify(policy))).not.toBeNull();
  });
  it("fails closed for missing identity, future approval, reused criterion IDs and non-test namespace", () => {
    const c = acceptanceContext();
    for (const patch of [{ approvedBy: "" }, { approvedAt: "2099-01-01T00:00:00Z" },
      { runId: "OFFICIAL" }, { committeeCriteriaIds: c.reviewerCriteriaIds }, { defenseDate: "2040-01-01" }])
      expect(() => buildAcceptancePolicies({ ...c, ...patch })).toThrow();
  });
  it("never represents unsigned test exports as official signatures or faculty forms", () => {
    const p = buildAcceptancePolicies(acceptanceContext()).policies.UC25_POLICY;
    expect(p.signature).toBe("UNSIGNED_ONLY");
    expect(p.memberResults).toBe("DENY");
    expect(p.templates).toHaveLength(15);
    expect(p.templates.every(t => t.name.startsWith("TEST") && t.roles.join() === "FACULTY")).toBe(true);
    expect(new ReportTemplates().policy(JSON.stringify(p))).not.toBeNull();
  });
  it("enforces two distinct questions only when the approved policy requests it", () => {
    const p = buildAcceptancePolicies(acceptanceContext()).policies.UC22_POLICY;
    const body = { totalScore: "8", criterionScores: Object.fromEntries(p.rubric!.criteria.map((c, i) => [c.id, ["1.6", "2.4", "0.8", "1.6", "1.6"][i]])), comment: "TEST", strengths: "TEST", weaknesses: "TEST", questions: "1. Câu hỏi?\n2. Câu hỏi?" } as ReviewerGradeCommand;
    const v = new ReviewerGradeValidator();
    expect(() => v.score(body, p, true)).toThrow();
    expect(v.score({ ...body, questions: "Thiết kế thế nào?\nĐã kiểm thử ra sao?" }, p, true)).toBe("8");
    expect(() => v.score({ ...body, questions: "Một câu hỏi" }, { ...p, minimumQuestions: undefined }, true)).not.toThrow();
  });
});
