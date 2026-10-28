import { z } from "zod";
import type { SubmissionUploadPolicy } from "@doan/shared";

// Temporary technical limit, NOT an academic limit approved by the team.
export const finalReportMaxBytesSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(100 * 1024 * 1024);
export const TEMPORARY_FINAL_REPORT_MAX_BYTES = 20 * 1024 * 1024;
export const FINAL_REPORT_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
export function finalReportPolicy(
  value: unknown = TEMPORARY_FINAL_REPORT_MAX_BYTES,
): SubmissionUploadPolicy {
  const maxFileBytes = finalReportMaxBytesSchema.parse(value);
  // Adapter for the existing Step 8 stateless file validator. No task policy is inherited.
  return {
    policyId: "final-report-temporary-v1",
    maxFileBytes,
    maxSubmissionBytes: maxFileBytes,
    stagingTtlHours: 24,
    maxPendingFilesPerStudent: 1,
    zipMaxEntries: 1,
    zipMaxExpandedBytes: maxFileBytes,
    roles: {
      REPORT: { extensions: ["pdf"], maxFiles: 1 },
      SOURCE: { extensions: ["zip"], maxFiles: 1 },
      EVIDENCE: { extensions: ["pdf"], maxFiles: 1 },
    },
  };
}
