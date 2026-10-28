import type { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
type Validator = DefenseConfirmationValidator;
export function evaluateDefenseEvidence(input: {
  proposalStatus: string | null;
  active: boolean;
  advisor: ReturnType<Validator["official"]>;
  decision: ReturnType<Validator["decision"]>;
  pdf: ReturnType<Validator["pdfMetadata"]>;
  changes: ReturnType<Validator["changed"]>;
}) {
  const reasons: string[] = [];
  if (!input.active) reasons.push("STUDENT_INACTIVE");
  if (!input.proposalStatus) reasons.push("PROPOSAL_MISSING");
  else if (input.proposalStatus !== "APPROVED")
    reasons.push("PROPOSAL_NOT_APPROVED");
  if (input.advisor.state !== "OFFICIAL")
    reasons.push("OFFICIAL_ASSIGNMENT_MISSING");
  const decision = input.decision;
  if (decision.state === "ABSENT" || decision.state === "PENDING")
    reasons.push("ADVISOR_DECISION_PENDING");
  else if (decision.state !== "RECORDED")
    reasons.push("ADVISOR_DECISION_UNVERIFIED");
  else if (
    decision.status === "REJECTED" &&
    input.changes.advisorChangedSinceDecision !== true
  )
    reasons.push("ADVISOR_REJECTED");
  if (input.changes.pdfChangedSinceDecision === true)
    reasons.push("PDF_EVIDENCE_STALE");
  if (input.changes.advisorChangedSinceDecision === true)
    reasons.push("ASSIGNMENT_EVIDENCE_STALE");
  if (
    decision.state === "RECORDED" &&
    decision.status === "CONFIRMED" &&
    input.changes.confirmationApplicableToCurrentContext !== true
  )
    reasons.push("UC17_CONFIRMATION_NOT_APPLICABLE");
  if (input.pdf.state === "NOT_SUBMITTED") reasons.push("PDF_MISSING");
  else if (input.pdf.state !== "READY") reasons.push("PDF_NOT_VERIFIED");
  // A metadata-only preview never claims to have verified private file bytes.
  // Nor does the default-true Student flag certify academic debt for UC18.
  reasons.push("ACADEMIC_SOURCE_NOT_VERIFIED");
  const result = reasons.some((r) =>
    ["STUDENT_INACTIVE", "PROPOSAL_NOT_APPROVED", "ADVISOR_REJECTED"].includes(
      r,
    ),
  )
    ? "NOT_APPROVED"
    : reasons.includes("ADVISOR_DECISION_PENDING")
      ? "WAITING_ADVISOR"
      : reasons.some((r) => r !== "ACADEMIC_SOURCE_NOT_VERIFIED")
        ? "REVIEW_REQUIRED"
        : "ACADEMIC_UNVERIFIED";
  return {
    result,
    admitted: false as const,
    officialEligibility: "UNKNOWN" as const,
    reasons,
  };
}
