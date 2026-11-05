import { z } from "zod";
const text = z.string().trim().max(5000);
const date = z.string().datetime({ offset: true });
export const WeeklyReportContentSchema = z
  .object({
    assignedWork: text,
    completedWork: text,
    results: text,
    unfinishedWork: text,
    unfinishedReason: text,
    difficulties: text,
    solutions: text,
    nextWork: text,
    notes: text,
  })
  .strict();
export const WeeklyReportDraftSchema = z
  .object({
    expectedDraftRevision: z.number().int().nonnegative(),
    report: WeeklyReportContentSchema.partial(),
    changeExplanation: text.optional(),
    content: z.string().trim().max(20000).optional(),
  })
  .strict();
export const WeeklyReportSubmitSchema = WeeklyReportContentSchema.superRefine(
  (v, ctx) => {
    for (const key of [
      "assignedWork",
      "completedWork",
      "results",
      "nextWork",
    ] as const)
      if (!v[key])
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Nhập nội dung trước khi nộp chính thức.",
        });
    if (v.unfinishedWork && !v.unfinishedReason)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unfinishedReason"],
        message: "Nêu nguyên nhân công việc chưa hoàn thành.",
      });
  },
);
const plan = {
  ordinal: z.number().int().min(1).max(520),
  label: z.string().trim().min(1).max(255),
  description: z.string().trim().max(20000),
  startsAt: date,
  endsAt: date,
  reportDueAt: date,
  expectedDeliverables: z.string().trim().min(1).max(20000),
  allowLate: z.boolean(),
};
export const WeeklyPlanCreateSchema = z.object(plan).strict();
export const WeeklyPlanUpdateSchema = z
  .object({
    ...plan,
    expectedRevision: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export const WeeklyPlanStateSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    state: z.enum(["OPEN", "LOCKED"]),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export const WeeklyReopenSchema = z
  .object({
    expectedTaskRevision: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(2000),
    revisionDueAt: date,
  })
  .strict();
export const WeeklyQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    periodId: z.string().max(100).optional(),
    studentId: z.string().max(100).optional(),
    advisorId: z.string().max(100).optional(),
    studentSearch: z.string().trim().max(100).optional(),
    advisorSearch: z.string().trim().max(100).optional(),
    isLate: z.enum(["true", "false"]).optional(),
    status: z
      .enum(["NOT_SUBMITTED", "PENDING", "PASS", "FAIL", "REVISION_REQUIRED"])
      .optional(),
  })
  .strict();
export type WeeklyReportContent = z.infer<typeof WeeklyReportContentSchema>;
export type WeeklyReportDraft = z.infer<typeof WeeklyReportDraftSchema>;
export type WeeklyPlanCreate = z.infer<typeof WeeklyPlanCreateSchema>;
export type WeeklyPlanUpdate = z.infer<typeof WeeklyPlanUpdateSchema>;
export type WeeklyPlanState = z.infer<typeof WeeklyPlanStateSchema>;
export type WeeklyReopen = z.infer<typeof WeeklyReopenSchema>;
export type WeeklyQuery = z.infer<typeof WeeklyQuerySchema>;
export type WeeklyPlanView = WeeklyPlanCreate & {
  id: string;
  termId: string;
  revision: number;
  state: string | null;
  publishedAt: string | null;
  canManage: boolean;
};
export type WeeklyStudentRow = {
  periodId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  dueAt: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  advisorId: string | null;
  advisorName: string | null;
  topicTitle: string | null;
  proposalId: string | null;
  obligationId: string | null;
  taskId: string | null;
  submissionId: string | null;
  versionNumber: number;
  taskCount: number;
  status: "NOT_SUBMITTED" | "PENDING" | "PASS" | "FAIL" | "REVISION_REQUIRED";
  isLate: boolean | null;
  submittedAt: string | null;
  revisionDueAt: string | null;
};
export type WeeklySummary = {
  data: WeeklyStudentRow[];
  total: number;
  page: number;
  totalPages: number;
  metrics: Record<WeeklyStudentRow["status"] | "LATE", number>;
};
