import { z } from "zod";
import { workflowCommandSchema } from "./defense-workflow";

const id = z.string().trim().min(1).max(36);
const instant = z.string().datetime({ offset: true });
export const gradingKindSchema = z.enum(["REVIEWER", "COMMITTEE"]);
export type GradingKind = z.infer<typeof gradingKindSchema>;
export const criterionSchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/),
    label: z.string().trim().min(1).max(200),
    maxScore: z.number().positive().max(10).multipleOf(0.01),
  })
  .strict();
export const gradingRubricSchema = z
  .array(criterionSchema)
  .min(1)
  .max(30)
  .superRefine((r, c) => {
    if (
      new Set(r.map((x) => x.code)).size !== r.length ||
      r.reduce((n, x) => n + Math.round(x.maxScore * 100), 0) !== 1000
    )
      c.addIssue({
        code: "custom",
        message: "Rubric phải có mã duy nhất và tổng tối đa 10 điểm.",
      });
  });
// docs/spec/dac-ta-use-case.md, biểu mẫu GVPB. This is not a committee rubric.
export const reviewerRubric = [
  { code: "LAYOUT", label: "Bố cục, hình thức", maxScore: 2 },
  { code: "CONTENT", label: "Nội dung báo cáo", maxScore: 3 },
  { code: "RELEVANCE", label: "Ý nghĩa thực tiễn", maxScore: 1 },
  { code: "COMPLETENESS", label: "Tính hoàn thiện sản phẩm", maxScore: 2 },
  { code: "MASTERY", label: "Khả năng làm chủ sản phẩm", maxScore: 2 },
] as const;
const window = z
  .object({ opensAt: instant, closesAt: instant, isLocked: z.boolean() })
  .strict()
  .refine(
    (w) => Date.parse(w.opensAt) < Date.parse(w.closesAt),
    "Mốc mở phải trước mốc đóng.",
  );
export const calculationPolicySchema = z
  .object({
    scheme: z.literal("UTC_40_60_V1"),
    approvalReference: z.string().trim().min(1).max(2000),
    quorum: z.literal("ALL_OFFICIAL_MEMBERS"),
    rounding: z
      .object({
        mode: z.literal("HALF_UP"),
        processDecimals: z.number().int().min(0).max(6),
        committeeDecimals: z.number().int().min(0).max(6),
        finalDecimals: z.number().int().min(0).max(6),
        passOn: z.enum(["RAW", "ROUNDED"]),
      })
      .strict(),
    minimum: z
      .object({
        process: z.number().min(0).max(10),
        committee: z.number().min(0).max(10),
        final: z.number().min(0).max(10),
      })
      .strict(),
  })
  .strict();
export const gradingPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    windows: z
      .object({ REVIEWER: window, COMMITTEE: window, PUBLICATION: window })
      .strict(),
    committeeRubric: gradingRubricSchema.nullable(),
    calculation: z.discriminatedUnion("state", [
      z.object({ state: z.literal("NEEDS_APPROVAL") }).strict(),
      z
        .object({
          state: z.literal("CONFIRMED"),
          policy: calculationPolicySchema,
          confirmedByUserId: id,
          confirmedAt: instant,
        })
        .strict(),
    ]),
  })
  .strict();
// Quorum, rounding and the authoritative advisor-grade source are NOT approved
// by package F. This command cannot manufacture a CONFIRMED calculation policy.
export const gradingPolicyInputSchema = workflowCommandSchema
  .extend({
    config: gradingPolicySchema.refine(
      (p) => p.calculation.state === "NEEDS_APPROVAL",
      "NEEDS_APPROVAL: chưa có command duyệt quorum/làm tròn.",
    ),
  })
  .strict();
const score = z.number().min(0).max(10).multipleOf(0.01);
export const gradingDraftSchema = z
  .object({
    values: z.record(z.string(), score),
    comment: z.string().max(12000),
    questions: z.array(z.string().trim().min(1).max(2000)).max(20),
  })
  .strict();
export const gradingSaveSchema = workflowCommandSchema
  .extend({ draft: gradingDraftSchema })
  .strict();
export const gradingParamsSchema = z
  .object({ termId: id, proposalId: id, kind: gradingKindSchema })
  .strict();
export const gradingHistoryQuerySchema = z
  .object({
    afterRevision: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const gradingPdfIdentitySchema = z
  .object({
    finalReportId: id,
    revision: z.coerce.number().int().positive(),
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export type GradingPolicy = z.infer<typeof gradingPolicySchema>;
export type GradingPolicyInput = z.infer<typeof gradingPolicyInputSchema>;
export type GradingDraft = z.infer<typeof gradingDraftSchema>;
export type GradingSave = z.infer<typeof gradingSaveSchema>;
export type CalculationPolicy = z.infer<typeof calculationPolicySchema>;
export type GradingCommand = z.infer<typeof workflowCommandSchema>;
export type GradeView = {
  configured: boolean;
  revision: number;
  state: "ABSENT" | "DRAFT" | "SEALED" | "INVALID";
  draft: GradingDraft | null;
  total: number | null;
  at: string | null;
};
export type GradeContext = {
  termId: string;
  proposalId: string;
  kind: GradingKind;
  title: string;
  studentName: string;
  expectedContext: string;
  expectedRevision: number;
  policyRevision: number;
  grade: GradeView;
  rubric: z.infer<typeof criterionSchema>[] | null;
  blockers: string[];
  canSave: boolean;
  canSeal: boolean;
  window: { opensAt: string; closesAt: string; isLocked: boolean } | null;
  pdf:
    | (z.infer<typeof gradingPdfIdentitySchema> & { originalName: string })
    | null;
  source: {
    uc18Id: string;
    committeeId: string;
    reviewerId: string;
    scheduleId: string | null;
  } | null;
};
export type GradingInbox = {
  termId: string;
  kind: GradingKind;
  items: {
    proposalId: string;
    studentName: string;
    title: string;
    state: string;
    revision: number;
  }[];
  blockers: string[];
};
export type AggregateView = {
  proposalId: string;
  studentName: string;
  title: string;
  state: "ABSENT" | "SEALED" | "PUBLISHED" | "INVALID";
  revision: number;
  expectedContext: string;
  blockers: string[];
  process: number | null;
  committee: number | null;
  final: number | null;
  passed: boolean | null;
  canSeal: boolean;
  canPublish: boolean;
};
export type PublishedGrade = {
  configured: boolean;
  state: "NOT_PUBLISHED" | "PUBLISHED";
  proposalId: string;
  revision: number;
  publishedAt: string | null;
  result: {
    process: number;
    committee: number;
    final: number;
    passed: boolean;
    policyVersion: number;
  } | null;
};
