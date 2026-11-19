import { applicationPolicyRuntimeAllowed } from "../../common/security/application-policy-runtime";
import { Injectable } from "@nestjs/common";
import { CommitteePolicySchema } from "@doan/shared";
import type { CommitteeMemberInput, CommitteePolicy } from "@doan/shared";
import { groupError } from "../../topic/review-groups/review-group.errors";
export const advisorConflict = (
  members: readonly { lecturerId: string }[],
  advisorId: string,
) => members.some((m) => m.lecturerId === advisorId);
export function committeeStructure(
  members: readonly CommitteeMemberInput[],
  p: CommitteePolicy | null,
) {
  const issues: string[] = [];
  if (members.length < 3 || members.length > 5)
    issues.push("COMMITTEE_SIZE_3_TO_5");
  if (new Set(members.map((m) => m.lecturerId)).size !== members.length)
    issues.push("DUPLICATE_MEMBER");
  if (members.some((m) => !["CHAIR", "SECRETARY", "MEMBER"].includes(m.role)))
    issues.push("INVALID_MEMBER_ROLE");
  if (
    p &&
    (members.filter((m) => m.role === "CHAIR").length !== p.chairCount ||
      members.filter((m) => m.role === "SECRETARY").length !== p.secretaryCount)
  )
    issues.push("OFFICER_COUNTS_REQUIRED");
  return issues;
}
@Injectable()
export class CommitteeValidator {
  policy(raw?: string | null): CommitteePolicy | null {
    try {
      const p = CommitteePolicySchema.parse(JSON.parse(raw ?? "null"));
      if (!applicationPolicyRuntimeAllowed(p)) return null;
      return Date.parse(p.approvedAt) <= Date.now() ? p : null;
    } catch {
      return null;
    }
  }
  key(key: string) {
    if (!key || !/^[\w.-]{1,200}$/.test(key))
      groupError(400, "COMMON_003", "Cần Idempotency-Key hợp lệ.");
  }
}
