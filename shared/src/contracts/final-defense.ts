import { z } from "zod";

const revision = z.number().int().nonnegative();
// B1–B8 imports contain VARCHAR identifiers as well as generated UUIDs.
const id = z.string().trim().min(1).max(36);
export const FinalDefensePolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    status: z.literal("APPROVED"),
    scoreStep: z
      .number()
      .positive()
      .max(10)
      .refine(
        (v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-8,
        "SCORE_ENTRY chỉ hỗ trợ một chữ số thập phân.",
      ),
    maxPdfBytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
    replacementAfterDecision: z.enum(["BLOCK", "INVALIDATE"]),
    rubric: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-zA-Z][\w-]{0,49}$/),
            label: z.string().trim().min(1).max(300),
            maxScore: z.number().positive().max(10),
            weight: z.number().positive().max(1),
          })
          .strict(),
      )
      .max(50)
      .nullable(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.rubric &&
      (!p.rubric.length ||
        new Set(p.rubric.map((r) => r.key)).size !== p.rubric.length ||
        Math.abs(p.rubric.reduce((n, r) => n + r.weight, 0) - 1) > 1e-8)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rubric"],
        message: "Rubric cần tiêu chí duy nhất và tổng trọng số bằng 1.",
      });
  });
export type FinalDefensePolicy = z.infer<typeof FinalDefensePolicySchema>;
export const FinalDefenseQuerySchema = z
  .object({
    termId: id,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const FinalPdfUploadSchema = z
  .object({ expectedRevision: z.coerce.number().int().nonnegative() })
  .strict();
export const AdvisorSummarySchema = z
  .object({
    expectedRevision: revision,
    reportVersionId: id,
    comment: z.string().trim().min(1).max(20000),
    score: z.number().finite().min(0).max(10),
    criterionScores: z
      .record(z.string(), z.number().finite().nonnegative())
      .default({}),
  })
  .strict();
export const AdvisorConfirmationSchema = z
  .object({
    expectedRevision: revision,
    reportVersionId: id,
    status: z.enum(["CONFIRMED", "REJECTED"]),
    reason: z.string().trim().max(4000).optional(),
  })
  .strict()
  .refine((v) => v.status !== "REJECTED" || !!v.reason, {
    path: ["reason"],
    message: "Không đồng ý bắt buộc ghi lý do.",
  });
export type AdvisorSummary = z.infer<typeof AdvisorSummarySchema>;
export type AdvisorConfirmation = z.infer<typeof AdvisorConfirmationSchema>;
export type FinalDefenseQuery = z.infer<typeof FinalDefenseQuerySchema>;
export type FinalDefenseRow = {
  proposalId: string;
  termId: string;
  studentCode: string;
  studentName: string;
  title: string;
  status: string;
};
export type FinalPdfVersion = {
  id: string;
  sequence: number;
  name: string;
  sizeBytes: number;
  checksum: string;
  submittedAt: string;
};
export type FinalDefenseView = FinalDefenseRow & {
  revision: number;
  versions: FinalPdfVersion[];
  policy: FinalDefensePolicy | null;
  blockers: string[];
  actionBlockers: {
    upload: string[];
    review: string[];
    decide: string[];
    download: string[];
  };
  writeWindow: {
    canWrite: boolean;
    reason: string | null;
    startAt: string | null;
    endAt: string | null;
  } | null;
  progress: {
    currentAssignment: boolean;
    activeTasks: number;
    completed: number;
    overdue: number;
    pendingReviews: number;
    unknownTasks: number;
    pass: number;
    fail: number;
    revisionRequired: number;
  } | null;
  progressBlocker: "GUIDANCE_READ_PERMISSION_REQUIRED" | "PLAN_MISSING" | null;
  permissions: {
    upload: boolean;
    review: boolean;
    decide: boolean;
    download: boolean;
  };
  summary: {
    score?: number;
    comment?: string;
    criterionScores?: Record<string, number>;
    current: boolean;
  } | null;
  decision: { status: string; reason?: string; current: boolean } | null;
  history: { id: string; action: string; at: string; snapshot: unknown }[];
};
