import { SubmissionUploadPolicySchema } from "@doan/shared";
// Weekly report defaults: bounded separately by category; overrides are validated.
export const approvedSubmissionPolicy = SubmissionUploadPolicySchema.parse({
  policyId: "weekly-20261104-v2",
  maxFileBytes: 100 * 1024 * 1024,
  maxSubmissionBytes: 140 * 1024 * 1024,
  stagingTtlHours: 24,
  maxPendingFilesPerStudent: 10, // technical quota against abandoned staging
  zipMaxEntries: 1000,
  zipMaxExpandedBytes: 200 * 1024 * 1024,
  roles: {
    REPORT: { extensions: ["pdf"], maxFiles: 1, maxBytes: 20 * 1024 * 1024 },
    SOURCE: { extensions: ["zip"], maxFiles: 1, maxBytes: 100 * 1024 * 1024 },
    EVIDENCE: {
      extensions: ["pdf", "png", "jpg", "jpeg"],
      maxFiles: 3,
      maxBytes: 20 * 1024 * 1024,
    },
  },
});
export function readSubmissionPolicy(raw?: string) {
  return raw
    ? SubmissionUploadPolicySchema.parse(JSON.parse(raw))
    : approvedSubmissionPolicy;
}
