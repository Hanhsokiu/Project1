import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  fixture,
  at,
  bytes,
} from "../../guidance/defense-confirmations/defense-confirmation.test-fixtures";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { evaluateDefenseEvidence } from "./defense-eligibility.policy";
function evidence() {
  const f = fixture();
  const rules = new DefenseConfirmationValidator(
    new ProposalReviewValidator(),
    new FinalReportValidator(),
    new SubmissionValidator(),
  );
  const advisor = rules.official(
    f.proposal,
    f.term,
    f.registration,
    f.roster,
    at,
  );
  const pdf = rules.pdfBytes(
    rules.pdfMetadata(f.report, "proposal", "student-user", at),
    bytes,
  );
  const decision = rules.decision(f.decision, at);
  return {
    proposalStatus: "APPROVED",
    active: true,
    advisor,
    decision,
    pdf,
    changes: rules.changed(decision, pdf, advisor),
  };
}
describe("UC18 evidence classification without inventing academic eligibility", () => {
  it("a verified current advisor/PDF/CONFIRMED decision is necessary but not sufficient", () => {
    const result = evaluateDefenseEvidence(evidence());
    expect(result).toEqual({
      result: "ACADEMIC_UNVERIFIED",
      admitted: false,
      officialEligibility: "UNKNOWN",
      reasons: ["ACADEMIC_SOURCE_NOT_VERIFIED"],
    });
  });
  it("a valid current REJECTED decision explains non-admission", () => {
    const e = evidence();
    e.decision.status = "REJECTED";
    expect(evaluateDefenseEvidence(e)).toMatchObject({
      result: "NOT_APPROVED",
      reasons: expect.arrayContaining(["ADVISOR_REJECTED"]),
    });
  });
  it("a decision by a former advisor requires review, not a current rejection or admission", () => {
    const e = evidence();
    e.decision.status = "REJECTED";
    e.changes.advisorChangedSinceDecision = true;
    const result = evaluateDefenseEvidence(e);
    expect(result.result).toBe("REVIEW_REQUIRED");
    expect(result.reasons).toContain("ASSIGNMENT_EVIDENCE_STALE");
    expect(result.reasons).not.toContain("ADVISOR_REJECTED");
  });
  it("unapproved proposal or inactive student cannot be admitted", () => {
    const e = evidence();
    e.proposalStatus = "DRAFT";
    e.active = false;
    expect(evaluateDefenseEvidence(e)).toMatchObject({
      admitted: false,
      result: "NOT_APPROVED",
      reasons: expect.arrayContaining([
        "PROPOSAL_NOT_APPROVED",
        "STUDENT_INACTIVE",
      ]),
    });
  });
});
