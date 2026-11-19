import { z } from "zod";
import type { EffectiveReviewerAssignment } from "./defense-reviewers";
const id = z.string().trim().min(1).max(36);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const ReviewGradeDecimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)
  .max(20);
const decimal = ReviewGradeDecimalSchema;
const text = z.string().trim().max(12000);
export const ReviewerGradePolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    status: z.literal("APPROVED"),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    reference: z.string().trim().min(1).max(4000),
    phaseCode: z.enum(["FINAL", "DEFENSE"]),
    scoreStep: decimal,
    draftAllowed: z.boolean(),
    requiredFeedback: z.array(
      z.enum(["comment", "strengths", "weaknesses", "questions"]),
    ),
    // Optional for existing approved policies; new project acceptance policies use 2.
    minimumQuestions: z.number().int().min(0).max(20).optional(),
    sourceChange: z.literal("BLOCK"),
    afterFinalize: z.literal("IMMUTABLE"),
    studentRelease: z.literal("WITHHELD"),
    schedule: z
      .object({
        required: z.boolean(),
        requirePublished: z.boolean(),
        window: z
          .object({
            opensMinutesBefore: z.number().int().nonnegative().max(525600),
            closesMinutesAfter: z.number().int().nonnegative().max(525600),
          })
          .strict()
          .nullable(),
      })
      .strict()
      .refine((p) => p.required || (!p.requirePublished && p.window === null)),
    rubric: z
      .object({
        version: z.string().trim().min(1).max(100),
        calculation: z.literal("WEIGHTED_NORMALIZED_10_EXACT"),
        criteria: z
          .array(
            z
              .object({
                id,
                name: z.string().trim().min(1).max(500),
                maxScore: decimal,
                weight: decimal,
                step: decimal,
              })
              .strict(),
          )
          .min(1)
          .max(100),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type ReviewerGradePolicy = z.infer<typeof ReviewerGradePolicySchema>;
export const ReviewerGradeCommandSchema = z
  .object({
    termId: id,
    expectedRevision: z.number().int().nonnegative(),
    assignmentId: id,
    assignmentRevision: z.number().int().positive(),
    assignmentEvidenceHash: hash,
    reportVersionId: id,
    reportChecksum: hash,
    policyHash: hash,
    rubricHash: hash,
    scheduleHash: hash.nullable(),
    totalScore: decimal.nullable(),
    criterionScores: z.record(id, decimal),
    comment: text,
    strengths: text,
    weaknesses: text,
    questions: text,
  })
  .strict();
export type ReviewerGradeCommand = z.infer<typeof ReviewerGradeCommandSchema>;
export const ReviewerGradeTermQuerySchema = z
  .object({ termId: id, reviewerId: id.optional() })
  .strict();
export const ReviewerGradeQuerySchema = ReviewerGradeTermQuerySchema.extend({
  search: z.string().trim().max(200).default(""),
  state: z
    .enum(["NONE", "DRAFT", "FINALIZED", "STALE", "LEGACY_UNVERIFIED"])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
}).strict();
export type ReviewerGradeQuery = z.infer<typeof ReviewerGradeQuerySchema>;
export type EffectiveReviewerGrade = {
  termId: string;
  termStudentId: string;
  proposalId: string;
  reviewerId: string;
  assignment: EffectiveReviewerAssignment;
  scoreEntryId: string;
  revision: number;
  reportVersionId: string;
  reportChecksum: string;
  totalScore: string;
  criterionScores: Record<string, string>;
  rubricVersion: string | null;
  rubricHash: string;
  policyVersion: string;
  policyHash: string;
  finalizedBy: string;
  finalizedAt: string;
  evidenceHash: string;
  effectiveStatus: "CURRENT";
  locked: true;
  releaseStatus: "WITHHELD";
};
export type ReviewerGradeView = {
  termId: string;
  termStudentId: string;
  proposalId: string;
  reviewerId: string;
  studentCode: string;
  studentName: string;
  title: string;
  proposalSummary: {
    objectives: string;
    scope: string;
    mainContents: string;
    tools: string;
    expectedResults: string;
  } | null;
  advisorName: string | null;
  committeeId: string | null;
  revision: number;
  state: "NONE" | "DRAFT" | "FINALIZED" | "STALE" | "LEGACY_UNVERIFIED";
  policy: ReviewerGradePolicy | null;
  policyHash: string;
  rubricHash: string;
  assignment: Pick<
    EffectiveReviewerAssignment,
    "assignmentId" | "revision" | "evidenceHash"
  > | null;
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
    hash: string;
  } | null;
  score: {
    totalScore: string | null;
    criterionScores: Record<string, string>;
  } | null;
  feedback: {
    comment: string;
    strengths: string;
    weaknesses: string;
    questions: string;
  } | null;
  history: {
    revision: number;
    action: string;
    at: string;
    actor: string | null;
  }[];
  blockers: string[];
  permissions: { save: boolean; finalize: boolean; download: boolean };
};
export type ReviewerGradeList = {
  blockers?: string[];
  items: ReviewerGradeView[];
  total: number;
  page: number;
  limit: number;
};
