import { applicationPolicyRuntimeAllowed } from "../../common/security/application-policy-runtime";
import { Injectable } from "@nestjs/common";
import { ReviewerPolicySchema } from "@doan/shared";
import type { ReviewerLecturer, ReviewerPolicy } from "@doan/shared";
export type ReviewerSource = {
  departmentId: string | null;
  advisorId: string | null;
  history: { valid: boolean; advisorIds: string[]; areaId: string | null };
  committeeMembers: string[];
};
export function reviewerConflicts(
  l: ReviewerLecturer,
  c: ReviewerSource,
  p: ReviewerPolicy | null,
) {
  const issues: string[] = [];
  if (!p) return ["UC20_POLICY_REQUIRED"];
  if (!l.active) issues.push("LECTURER_INACTIVE");
  if (!l.inRoster) issues.push("LECTURER_NOT_IN_ROSTER");
  if (l.id === c.advisorId) issues.push("ADVISOR_CONFLICT");
  if (!c.history.valid) issues.push("ADVISOR_HISTORY_UNVERIFIED");
  if (
    c.history.advisorIds.includes(l.id) &&
    l.id !== c.advisorId &&
    p.formerAdvisorRule !== "ALLOW"
  )
    issues.push(
      p.formerAdvisorRule === "FORBID"
        ? "FORMER_ADVISOR_CONFLICT"
        : "FORMER_ADVISOR_PENDING_APPROVAL",
    );
  if (c.committeeMembers.includes(l.id) && p.committeeMembership !== "ALLOW")
    issues.push(
      p.committeeMembership === "FORBID"
        ? "COMMITTEE_MEMBER_FORBIDDEN"
        : "COMMITTEE_MEMBERSHIP_PENDING_APPROVAL",
    );
  if (
    p.departmentRule === "SAME_DEPARTMENT" &&
    l.departmentId !== c.departmentId
  )
    issues.push("REVIEWER_DEPARTMENT_MISMATCH");
  if (
    p.allowedTitleIds &&
    (!l.titleId || !p.allowedTitleIds.includes(l.titleId))
  )
    issues.push("REVIEWER_TITLE_REQUIRED");
  if (
    p.expertiseRule === "REQUIRED_AREA_MATCH" &&
    (!c.history.areaId || !l.areaIds.includes(c.history.areaId))
  )
    issues.push("REVIEWER_AREA_MATCH_REQUIRED");
  return issues;
}
@Injectable()
export class ReviewerValidator {
  policy(raw?: string | null): ReviewerPolicy | null {
    try {
      const p = ReviewerPolicySchema.parse(JSON.parse(raw ?? "null"));
      if (!applicationPolicyRuntimeAllowed(p)) return null;
      return Date.parse(p.approvedAt) <= Date.now() ? p : null;
    } catch {
      return null;
    }
  }
}
