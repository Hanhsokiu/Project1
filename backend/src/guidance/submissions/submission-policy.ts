import { SubmissionUploadPolicySchema } from "@doan/shared";
// Approved by the user on 22/10/2026. Operational overrides are validated.
export const approvedSubmissionPolicy = SubmissionUploadPolicySchema.parse({
  policyId: "approved-20261022-v1",
  maxFileBytes: 20 * 1024 * 1024,
  maxSubmissionBytes: 50 * 1024 * 1024,
  stagingTtlHours: 24,
  maxPendingFilesPerStudent: 10, // technical quota against abandoned staging
  zipMaxEntries: 1000,
  zipMaxExpandedBytes: 200 * 1024 * 1024,
  roles: {
    REPORT: { extensions: ["pdf"], maxFiles: 1 },
    SOURCE: { extensions: ["zip"], maxFiles: 1 },
    EVIDENCE: { extensions: ["pdf", "png", "jpg", "jpeg"], maxFiles: 3 },
  },
});
export function readSubmissionPolicy(raw?: string) {
  return raw
    ? SubmissionUploadPolicySchema.parse(JSON.parse(raw))
    : approvedSubmissionPolicy;
}
