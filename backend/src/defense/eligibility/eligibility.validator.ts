import { Injectable } from "@nestjs/common";
import {
  AcademicAttestationSchema,
  EligibilityPolicySchema,
} from "@doan/shared";
import type {
  AcademicAttestation,
  EligibilityCheck,
  EligibilityPolicy,
  EligibilityPreview,
} from "@doan/shared";
import { groupError } from "../../topic/review-groups/review-group.errors";

// Pure evaluator: evidence-qualified is never a faculty decision.
export function evaluateEligibility(
  checks: EligibilityCheck[],
): EligibilityPreview {
  for (const state of [
    "UNVERIFIED",
    "STALE",
    "NEGATIVE",
    "MISSING",
    "PENDING",
  ] as const)
    if (checks.some((c) => c.state === state)) return state;
  return checks.length ? "QUALIFIED" : "UNVERIFIED";
}
@Injectable()
export class EligibilityValidator {
  policy(raw?: string | null): EligibilityPolicy | null {
    try {
      const p = EligibilityPolicySchema.parse(JSON.parse(raw ?? "null"));
      return Date.parse(p.approvedAt) <= Date.now() ? p : null;
    } catch {
      return null;
    }
  }
  academic(
    raw: unknown,
    policy: EligibilityPolicy | null,
    policyHash: string,
    termId: string,
    memberId: string,
  ): AcademicAttestation | null {
    const parsed = AcademicAttestationSchema.safeParse(raw);
    if (!parsed.success || !policy) return null;
    const a = parsed.data,
      now = Date.now();
    if (
      a.termId !== termId ||
      a.termStudentId !== memberId ||
      a.policyHash !== policyHash ||
      !policy.academicSources.some(
        (s) => s.key === a.evidence.source && s.mode === "FACULTY_ATTESTATION",
      ) ||
      Date.parse(a.verifiedAt) > now ||
      Date.parse(a.evidence.effectiveFrom) > now ||
      Date.parse(a.evidence.validUntil) <= now
    )
      return null;
    return a;
  }
  key(key: string) {
    if (!key || !/^[\w.-]{1,200}$/.test(key))
      groupError(400, "COMMON_003", "Cần Idempotency-Key hợp lệ.");
  }
}
