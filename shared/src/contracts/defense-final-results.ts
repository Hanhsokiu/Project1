import { z } from "zod";
import type { EffectiveCommittee } from "./defense-committee";
const id = z.string().trim().min(1).max(36);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const decimal = z.string().regex(/^(?:0|[1-9]\d?)(?:\.\d{1,6})?$/);
const rounding = z
  .object({
    mode: z.enum(["EXACT", "HALF_UP", "HALF_EVEN", "DOWN"]),
    decimalPlaces: z.number().int().min(0).max(6),
  })
  .strict();
export const ResultComponentSchema = z.enum([
  "ADVISOR_UC17",
  "PROCESS_UC16",
  "REVIEWER",
  "COMMITTEE",
]);
export const FinalResultPolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    status: z.literal("APPROVED"),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    reference: z.string().trim().min(1).max(1000),
    formula: z.literal("WEIGHTED_SUM"),
    advisorSource: z.enum([
      "UC17_OFFICIAL_SUMMARY",
      "NOT_USED",
      "PENDING_APPROVAL",
    ]),
    components: z
      .array(
        z.object({ source: ResultComponentSchema, weight: decimal }).strict(),
      )
      .min(1)
      .max(4),
    reviewerAggregate: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("MEAN"), rounding }).strict(),
      z
        .object({
          mode: z.literal("WEIGHTED"),
          rounding,
          weights: z
            .array(z.object({ lecturerId: id, weight: decimal }).strict())
            .min(1)
            .max(20),
        })
        .strict(),
    ]),
    committeeAggregate: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("MEAN"), rounding }).strict(),
      z
        .object({
          mode: z.literal("ROLE_WEIGHTED"),
          rounding,
          weights: z
            .array(
              z
                .object({
                  role: z.enum(["CHAIR", "SECRETARY", "MEMBER"]),
                  weight: decimal,
                })
                .strict(),
            )
            .min(1)
            .max(3),
        })
        .strict(),
    ]),
    finalRounding: rounding,
    finalStep: decimal,
    storageDecimalPlaces: z.number().int().min(0).max(1),
    passRule: z
      .object({
        minimumFinal: decimal,
        minimumComponents: z
          .array(
            z
              .object({ source: ResultComponentSchema, minimum: decimal })
              .strict(),
          )
          .max(4),
      })
      .strict()
      .nullable(),
    classifications: z
      .array(
        z
          .object({
            minimum: decimal,
            label: z.string().trim().min(1).max(100),
          })
          .strict(),
      )
      .max(20),
    confirmation: z
      .object({
        scope: z.literal("STUDENT"),
        rule: z.literal("ONE_PER_ROLE"),
        roles: z.array(z.enum(["CHAIR", "SECRETARY", "MEMBER"])).max(3),
        distinctActors: z.boolean(),
        reasonRequired: z.boolean(),
      })
      .strict(),
    separation: z
      .object({
        finalizerNotConfirmer: z.boolean(),
        publisherNotFinalizer: z.boolean(),
      })
      .strict(),
    finalizeWindow: z
      .object({
        phaseCode: z.literal("DEFENSE"),
        notBefore: z.string().datetime({ offset: true }),
        before: z.string().datetime({ offset: true }),
      })
      .strict(),
    publication: z
      .object({
        phaseCode: z.literal("DEFENSE"),
        notBefore: z.string().datetime({ offset: true }),
        before: z.string().datetime({ offset: true }),
        studentFinal: z.boolean(),
        studentComponents: z.boolean(),
      })
      .strict(),
    sourceChange: z.literal("BLOCK"),
    afterFinalize: z.literal("IMMUTABLE"),
    sourceLock: z.literal("PRESERVE_PRODUCER_LOCKS"),
  })
  .strict();
export type FinalResultPolicy = z.infer<typeof FinalResultPolicySchema>;
export const FinalResultQuerySchema = z
  .object({
    termId: id,
    committeeId: id.optional(),
    search: z.string().trim().max(200).default(""),
    state: z
      .enum([
        "INCOMPLETE",
        "READY",
        "AWAITING_CONFIRMATION",
        "CONFIRMED",
        "FINALIZED",
        "PUBLISHED",
        "STALE",
        "LEGACY_UNVERIFIED",
      ])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const FinalResultScopeSchema = z.object({ termId: id }).strict();
export const FinalResultCommandSchema = z
  .object({
    termId: id,
    expectedRevision: z.number().int().nonnegative(),
    policyHash: hash,
    evidenceHash: hash,
    reason: z.string().trim().max(4000).optional(),
  })
  .strict();
export type FinalResultCommand = z.infer<typeof FinalResultCommandSchema>;
export type FinalResultQuery = z.infer<typeof FinalResultQuerySchema>;
export type ResultComponent = z.infer<typeof ResultComponentSchema>;
export type ResultSource = {
  source: ResultComponent;
  lecturerId: string;
  role: string;
  scoreEntryId: string;
  revision: number;
  totalScore: string;
  evidenceHash: string;
  reportVersionId: string;
  reportChecksum: string;
};
export type ResultCalculation = {
  components: Partial<Record<ResultComponent, string>>;
  committeeScore: string | null;
  reviewerScore: string | null;
  finalScore: string;
  isPassed: boolean | null;
  classification: string | null;
};
export type ResultConfirmation = {
  actor: string;
  lecturerId: string;
  role: "CHAIR" | "SECRETARY" | "MEMBER";
  at: string;
  evidenceHash: string;
  reason: string | null;
};
export type FinalResultState = NonNullable<FinalResultQuery["state"]>;
export type FinalResultView = {
  termId: string;
  termStudentId: string;
  proposalId: string;
  studentCode: string;
  studentName: string;
  title: string;
  committeeId: string | null;
  committeeCode: string | null;
  schedule: { startAt: string; endAt: string; sessionId: string } | null;
  revision: number;
  state: FinalResultState;
  policy: FinalResultPolicy | null;
  policyHash: string;
  evidenceHash: string;
  sources: ResultSource[];
  calculation: ResultCalculation | null;
  savedCalculation: ResultCalculation | null;
  savedPolicy: FinalResultPolicy | null;
  savedSources: ResultSource[];
  lecturerNames: Record<string, string>;
  requiredCount: number | null;
  validCount: number;
  missingCount: number | null;
  confirmations: ResultConfirmation[];
  finalizedBy: string | null;
  finalizedAt: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  history: {
    action: string;
    at: string;
    actor: string | null;
    revision: number;
  }[];
  blockers: string[];
  actions: { confirm: string[]; finalize: string[]; publish: string[] };
  visibility: "INTERNAL" | "STUDENT";
};
export type FinalResultList = {
  items: FinalResultView[];
  total: number;
  page: number;
  limit: number;
};
export type FinalResultOptions = {
  terms: { id: string; code: string; name: string; status: string }[];
  committees: {
    id: string;
    termId: string;
    code: string | null;
    name: string;
  }[];
};
export type EffectiveAdvisorGrade = ResultSource & {
  source: "ADVISOR_UC17";
  termId: string;
  termStudentId: string;
  proposalId: string;
  policyHash: string;
  decisionId: string;
  decisionRevision: number;
  effectiveStatus: "CURRENT";
};
export type EffectiveFinalResult = {
  termId: string;
  termStudentId: string;
  proposalId: string;
  committeeId: string;
  finalResultId: string;
  revision: number;
  committee: EffectiveCommittee;
  sources: ResultSource[];
  policy: FinalResultPolicy;
  policyHash: string;
  calculation: ResultCalculation;
  evidenceHash: string;
  confirmations: ResultConfirmation[];
  finalizedBy: string;
  finalizedAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
  effectiveStatus: "CURRENT";
  publicationStatus: "WITHHELD" | "PUBLISHED";
};
