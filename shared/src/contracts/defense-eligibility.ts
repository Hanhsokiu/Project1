import { z } from "zod";

const id = z.string().trim().min(1).max(36);
const text = z.string().trim().min(1).max(4000);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const EligibilityPreviewSchema = z.enum([
  "QUALIFIED",
  "NEGATIVE",
  "PENDING",
  "MISSING",
  "STALE",
  "UNVERIFIED",
]);
export type EligibilityPreview = z.infer<typeof EligibilityPreviewSchema>;
export const EligibilityPolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    status: z.literal("APPROVED"),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    phaseCode: z.enum(["FINAL", "DEFENSE"]),
    progressRule: z.enum(["UC17_REVIEW", "ALL_ACTIVE_TASKS_PASSED"]),
    academicSources: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-zA-Z][\w.-]{0,99}$/),
            label: z.string().trim().min(1).max(200),
            mode: z.literal("FACULTY_ATTESTATION"),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .refine(
    (p) =>
      new Set(p.academicSources.map((s) => s.key)).size ===
      p.academicSources.length,
  );
export type EligibilityPolicy = z.infer<typeof EligibilityPolicySchema>;
export const AcademicAttestationInputSchema = z
  .object({
    source: z.string().trim().min(1).max(100),
    reference: text,
    outcome: z.enum(["PASS", "FAIL"]),
    effectiveFrom: z.string().datetime({ offset: true }),
    validUntil: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine((a) => Date.parse(a.effectiveFrom) < Date.parse(a.validUntil));
export type AcademicAttestationInput = z.infer<
  typeof AcademicAttestationInputSchema
>;
export const AcademicAttestationSchema = z
  .object({
    evidence: AcademicAttestationInputSchema,
    verifiedBy: id,
    verifiedAt: z.string().datetime({ offset: true }),
    policyHash: hash,
    termId: id,
    termStudentId: id,
  })
  .strict();
export type AcademicAttestation = z.infer<typeof AcademicAttestationSchema>;
export const EligibilityQuerySchema = z
  .object({
    termId: id,
    search: z.string().trim().max(200).default(""),
    preview: EligibilityPreviewSchema.optional(),
    official: z
      .enum([
        "NONE",
        "REVIEWED",
        "DECIDED",
        "FINALIZED",
        "STALE",
        "LEGACY_UNVERIFIED",
      ])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type EligibilityQuery = z.infer<typeof EligibilityQuerySchema>;
export const EligibilityDetailQuerySchema = z.object({ termId: id }).strict();
const expected = {
  termId: id,
  expectedRevision: z.number().int().nonnegative(),
  evidenceHash: hash,
};
export const EligibilityReviewSchema = z
  .object({
    ...expected,
    reason: text,
    academic: AcademicAttestationInputSchema.optional(),
  })
  .strict();
export type EligibilityReview = z.infer<typeof EligibilityReviewSchema>;
export const EligibilityDecisionSchema = z
  .object({
    ...expected,
    reason: text,
    status: z.enum(["ELIGIBLE", "INELIGIBLE", "DEFERRED"]),
  })
  .strict();
export type EligibilityDecision = z.infer<typeof EligibilityDecisionSchema>;
export const EligibilityFinalizeSchema = z
  .object({
    termId: id,
    reason: text,
    members: z
      .array(
        z
          .object({
            termStudentId: id,
            expectedRevision: z.number().int().positive(),
            evidenceHash: hash,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.members.map((m) => m.termStudentId)).size === b.members.length,
  );
export type EligibilityFinalize = z.infer<typeof EligibilityFinalizeSchema>;
export type EligibilityCheck = {
  key: string;
  state: EligibilityPreview;
  message: string;
};
export type EffectiveEligibility = {
  termId: string;
  termStudentId: string;
  proposalId: string;
  decision: "ELIGIBLE";
  revision: number;
  approvedBy: string;
  approvedAt: string;
  finalizedBy: string;
  finalizedAt: string;
  evidenceHash: string;
  policyVersion: string;
  policyHash: string;
  batchId: string;
  effectiveStatus: "CURRENT";
};
export type EligibilityView = {
  termId: string;
  termStudentId: string;
  proposalId: string | null;
  studentCode: string;
  studentName: string;
  title: string;
  advisor: string | null;
  revision: number;
  evidenceHash: string;
  preview: EligibilityPreview;
  checks: EligibilityCheck[];
  uc17: string;
  pdf: string;
  policy: EligibilityPolicy | null;
  official: {
    state:
      | "NONE"
      | "REVIEWED"
      | "DECIDED"
      | "FINALIZED"
      | "STALE"
      | "LEGACY_UNVERIFIED";
    status: string;
    reason?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    decidedBy?: string;
    decidedAt?: string;
    finalizedBy?: string;
    finalizedAt?: string;
  };
  academic: AcademicAttestation | null;
  advisorSummary: { score?: number; comment?: string } | null;
  history: {
    id: string;
    action: string;
    at: string;
    actor: string | null;
    status?: string;
    reason?: string;
    revision?: number;
  }[];
  actionBlockers: { review: string[]; decide: string[]; finalize: string[] };
  downstream: EffectiveEligibility | null;
};
export type EligibilityList = {
  items: EligibilityView[];
  total: number;
  page: number;
  limit: number;
};
