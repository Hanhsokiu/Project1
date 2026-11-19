import { z } from "zod";
import { CommitteeRoleSchema } from "./defense-committee";
import type { EffectiveCommittee } from "./defense-committee";
import { ReviewGradeDecimalSchema } from "./defense-reviewer-grading";
import {
  addScoreFraction,
  scoreFraction,
  weightedScoreFraction,
  formatScoreFraction,
} from "./rubric-arithmetic";
const id = z.string().trim().min(1).max(36),
  hash = z.string().regex(/^[a-f0-9]{64}$/),
  decimal = ReviewGradeDecimalSchema;
export const CommitteeGradeCriterionSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(255),
    description: z.string().max(4000).nullable(),
    minScore: decimal,
    maxScore: decimal,
    step: decimal,
    weight: decimal,
    required: z.boolean(),
  })
  .strict();
export const CommitteeGradePolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    status: z.literal("APPROVED"),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    reference: z.string().trim().min(1).max(4000),
    effectiveFrom: z.string().datetime({ offset: true }),
    effectiveScope: z.literal("GRADING_WINDOW"),
    effectiveUntil: z.string().datetime({ offset: true }).nullable(),
    phaseCode: z.literal("DEFENSE"),
    gradingRoles: z.array(CommitteeRoleSchema).min(1).max(3),
    draftAllowed: z.boolean(),
    commentRequired: z.boolean(),
    sourceChange: z.literal("BLOCK"),
    afterFinalize: z.literal("IMMUTABLE"),
    studentRelease: z.literal("WITHHELD"),
    schedule: z
      .object({
        required: z.literal(true),
        requirePublished: z.boolean(),
        anchor: z.enum(["SESSION", "SLOT"]),
      })
      .strict(),
    defenseEvidence: z.enum(["NOT_REQUIRED", "REQUIRED"]),
    rubric: z
      .object({
        version: z.string().trim().min(1).max(100),
        calculation: z.literal("WEIGHTED_NORMALIZED_10"),
        missingOptional: z.enum(["ZERO", "BLOCK"]),
        rounding: z
          .object({
            mode: z.enum(["EXACT", "HALF_UP", "HALF_EVEN", "DOWN"]),
            decimalPlaces: z.number().int().min(0).max(6),
          })
          .strict(),
        totalStep: decimal,
        criteria: z.array(CommitteeGradeCriterionSchema).min(1).max(100),
      })
      .strict(),
  })
  .strict();
export type CommitteeGradePolicy = z.infer<typeof CommitteeGradePolicySchema>;
export const CommitteeGradeCommandSchema = z
  .object({
    termId: id,
    committeeId: id,
    expectedRevision: z.number().int().nonnegative(),
    committeeRevision: z.number().int().positive(),
    committeeEvidenceHash: hash,
    assignmentRevision: z.number().int().positive(),
    membershipHash: hash,
    reportVersionId: id,
    reportChecksum: hash,
    policyHash: hash,
    rubricHash: hash,
    scheduleHash: hash,
    criterionScores: z
      .array(z.object({ criterionId: id, score: decimal }).strict())
      .max(100),
    comment: z.string().trim().max(12000),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.criterionScores.map((c) => c.criterionId)).size ===
      b.criterionScores.length,
    { message: "Không nhập trùng tiêu chí." },
  );
export type CommitteeGradeCommand = z.infer<typeof CommitteeGradeCommandSchema>;
export const CommitteeGradeTermQuerySchema = z
  .object({ termId: id, committeeId: id, lecturerId: id.optional() })
  .strict();
export const CommitteeGradeQuerySchema = z
  .object({
    termId: id,
    committeeId: id.optional(),
    lecturerId: id.optional(),
    search: z.string().trim().max(200).default(""),
    state: z
      .enum(["NONE", "DRAFT", "FINALIZED", "STALE", "LEGACY_UNVERIFIED"])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();
export type CommitteeGradeQuery = z.infer<typeof CommitteeGradeQuerySchema>;
// Shared UI preview and backend scoring use the same exact rational engine.
// Input validation and academic authorization remain backend responsibilities.
export function committeeRubricTotal(
  policy: CommitteeGradePolicy,
  scores: Record<string, string>,
  final: boolean,
) {
  let total = scoreFraction("0");
  const normalized: Record<string, string> = {};
  for (const c of policy.rubric.criteria) {
    let v = scores[c.id];
    if (v === undefined) {
      if (!final) return { totalScore: null, normalized: scores };
      if (c.required || policy.rubric.missingOptional === "BLOCK")
        throw Error("RUBRIC_INCOMPLETE");
      v = "0";
    }
    normalized[c.id] = v;
    total = addScoreFraction(
      total,
      weightedScoreFraction(v, c.maxScore, c.weight),
    );
  }
  return {
    totalScore: formatScoreFraction(total, policy.rubric.rounding),
    normalized,
  };
}
export type CommitteeGradeState =
  "NONE" | "DRAFT" | "FINALIZED" | "STALE" | "LEGACY_UNVERIFIED";
export type CommitteeGradeView = {
  termId: string;
  termStudentId: string;
  proposalId: string;
  committeeId: string;
  committeeCode: string;
  lecturerId: string;
  lecturerName: string;
  memberRole: z.infer<typeof CommitteeRoleSchema>;
  studentCode: string;
  studentName: string;
  title: string;
  revision: number;
  state: CommitteeGradeState;
  committeeRevision: number;
  committeeEvidenceHash: string;
  assignmentRevision: number;
  membershipHash: string;
  policy: CommitteeGradePolicy | null;
  policyHash: string;
  rubricHash: string;
  gradedPolicyVersion: string | null;
  gradedRubric: CommitteeGradePolicy["rubric"] | null;
  report: {
    id: string;
    sequence: number;
    checksum: string;
    name: string;
  } | null;
  schedule: {
    id: string;
    revision: number;
    date: string;
    period: string;
    startAt: string;
    endAt: string;
    order: number;
    hash: string;
  } | null;
  score: {
    totalScore: string | null;
    criterionScores: Record<string, string>;
  } | null;
  comment: string | null;
  history: {
    revision: number;
    action: string;
    at: string;
    actor: string | null;
  }[];
  blockers: string[];
  finalizeBlockers: string[];
  permissions: { save: boolean; finalize: boolean; download: boolean };
};
export type CommitteeGradeList = {
  items: CommitteeGradeView[];
  total: number;
  page: number;
  limit: number;
  blockers: string[];
};
export type CommitteeGradeOptions = {
  terms: { id: string; code: string; name: string; status: string }[];
  committees: {
    termId: string;
    id: string;
    code: string;
    name: string;
    role: string | null;
  }[];
};
export type CommitteeGradeProgress = {
  termId: string;
  committeeId: string;
  committeeCode: string;
  termStudentId: string;
  studentCode: string;
  studentName: string;
  requiredCount: number | null;
  none: number;
  draft: number;
  finalized: number;
  stale: number;
  blocked: number;
  missingRequired: number | null;
  blockers: string[];
};
// Contract for a future approved producer; UC23 never fabricates this evidence.
export const DefensePerformanceEvidenceSchema = z
  .object({
    id,
    termId: id,
    termStudentId: id,
    proposalId: id,
    committeeId: id,
    sessionId: id,
    revision: z.number().int().positive(),
    performedAt: z.string().datetime({ offset: true }),
    recordedBy: id,
    evidenceHash: hash,
    effectiveStatus: z.literal("CURRENT"),
  })
  .strict();
export type EffectiveCommitteeGrade = {
  termId: string;
  termStudentId: string;
  proposalId: string;
  committeeId: string;
  committeeRevision: number;
  committeeEvidenceHash: string;
  assignmentRevision: number;
  membershipHash: string;
  lecturerId: string;
  memberRole: z.infer<typeof CommitteeRoleSchema>;
  scoreEntryId: string;
  revision: number;
  rubricVersion: string;
  rubricHash: string;
  criterionScores: Record<string, string>;
  totalScore: string;
  reportVersionId: string;
  reportChecksum: string;
  schedule: { sessionId: string; hash: string };
  policyVersion: string;
  policyHash: string;
  finalizedBy: string;
  finalizedAt: string;
  evidenceHash: string;
  locked: true;
  effectiveStatus: "CURRENT";
  releaseStatus: "WITHHELD";
  committee: Pick<
    EffectiveCommittee,
    "finalizedBy" | "finalizedAt" | "policyHash"
  >;
};
