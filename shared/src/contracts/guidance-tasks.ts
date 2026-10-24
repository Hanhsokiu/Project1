import { z } from "zod";
import type { GroupPage } from "./review-groups";
const id = z.string().trim().min(1).max(100),
  revision = z.number().int().nonnegative(),
  date = z.string().datetime({ offset: true });
export const GuidancePlanCreateSchema = z
  .object({
    finalizationId: id,
    expectedDossierRevision: revision,
    description: z.string().trim().max(20000).optional(),
  })
  .strict();
export const GuidancePlanUpdateSchema = z
  .object({
    expectedRevision: revision,
    description: z.string().trim().max(20000),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export const GuidancePlanResumeSchema = z
  .object({
    expectedRevision: revision,
    finalizationId: id,
    expectedDossierRevision: revision,
    acknowledgeRebase: z.literal(true),
  })
  .strict();
export const GuidanceTaskCreateSchema = z
  .object({
    expectedPlanRevision: revision,
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(20000).optional(),
    expectedDeliverables: z.string().trim().min(1).max(20000),
    periodId: id,
    startDate: date,
    dueDate: date,
  })
  .strict()
  .refine((v) => Date.parse(v.startDate) < Date.parse(v.dueDate), {
    message: "Ngày bắt đầu phải trước hạn hoàn thành.",
    path: ["dueDate"],
  });
export const GuidanceTaskUpdateSchema = z
  .object({
    expectedRevision: revision,
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(20000).optional(),
    expectedDeliverables: z.string().trim().min(1).max(20000).optional(),
    startDate: date.optional(),
    dueDate: date.optional(),
    reason: z.string().trim().min(1).max(2000),
    acknowledgeExistingSubmissions: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      [
        "title",
        "description",
        "expectedDeliverables",
        "startDate",
        "dueDate",
      ].some((k) => v[k as keyof typeof v] !== undefined),
    "Cần ít nhất một trường thay đổi.",
  );
export const GuidanceTaskProgressSchema = z
  .object({
    expectedRevision: revision,
    note: z.string().trim().min(1).max(20000),
  })
  .strict();
export const GuidanceTaskCancelSchema = z
  .object({
    expectedRevision: revision,
    reason: z.string().trim().min(1).max(2000),
    acknowledgeExistingSubmissions: z.boolean().optional(),
  })
  .strict();
export const WeeklyTaskEnsureSchema = z
  .object({
    expectedObligationRevision: revision,
    expectedPlanRevision: revision,
  })
  .strict();
export const WeeklyObligationConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    periodId: id,
    termStudentId: id,
    termId: id,
    periodRevision: revision,
    startsAt: date,
    reportDueAt: date,
    expectedDeliverables: z.string().trim().min(1).max(20000),
  })
  .strict();
export const GuidanceTaskStateSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "SUBMITTED",
  "REVISION_REQUESTED",
  "COMPLETED",
  "CANCELLED",
]);
export const GuidanceTaskQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    periodId: id.optional(),
    status: GuidanceTaskStateSchema.optional(),
    isOverdue: z.enum(["true", "false"]).optional(),
    search: z.string().trim().max(255).optional(),
  })
  .strict();
export const WeeklyCoverageQuerySchema = GuidanceTaskQuerySchema.omit({
  status: true,
});
export type GuidancePlanCreate = z.infer<typeof GuidancePlanCreateSchema>;
export type GuidancePlanUpdate = z.infer<typeof GuidancePlanUpdateSchema>;
export type GuidancePlanResume = z.infer<typeof GuidancePlanResumeSchema>;
export type GuidanceTaskCreate = z.infer<typeof GuidanceTaskCreateSchema>;
export type GuidanceTaskUpdate = z.infer<typeof GuidanceTaskUpdateSchema>;
export type GuidanceTaskProgress = z.infer<typeof GuidanceTaskProgressSchema>;
export type GuidanceTaskCancel = z.infer<typeof GuidanceTaskCancelSchema>;
export type GuidanceTaskQuery = z.infer<typeof GuidanceTaskQuerySchema>;
export type GuidancePeriodView = {
  id: string;
  termId: string;
  ordinal: number;
  label: string;
  type: "WEEK" | "MILESTONE";
  startsAt: string;
  endsAt: string;
  reportDueAt: string | null;
  revision: number;
};
export type GuidancePlanView = {
  id: string;
  proposalId: string;
  termId: string;
  termStudentId: string;
  studentName: string;
  studentCode: string;
  topicTitle: string;
  advisorId: string;
  currentAdvisorId: string | null;
  state: "ACTIVE" | "PAUSED" | "ARCHIVED" | null;
  revision: number;
  description: string | null;
  finalizationId: string | null;
  assignmentId: string | null;
  assignmentRevision: number | null;
  allowedActions: Array<"create-task" | "update" | "resume">;
  readiness: string[];
};
export type GuidanceContext = {
  proposalId: string;
  termId: string;
  title: string;
  studentName: string;
  studentCode: string;
  plan: GuidancePlanView | null;
  currentFinalizationId: string | null;
  dossierRevision: number;
  phase: { startsAt: string; endsAt: string; isLocked: boolean } | null;
  periods: GuidancePeriodView[];
  canCreate: boolean;
  readiness: string[];
};
export type GuidanceTaskView = {
  id: string;
  planId: string;
  proposalId: string;
  termId: string;
  termStudentId: string;
  studentName: string;
  studentCode: string;
  topicTitle: string;
  advisorId: string;
  periodId: string | null;
  periodLabel: string | null;
  kind: "WEEKLY_REPORT" | "AD_HOC" | null;
  title: string;
  description: string | null;
  expectedDeliverables: string | null;
  startDate: string | null;
  dueDate: string;
  status: z.infer<typeof GuidanceTaskStateSchema> | null;
  revision: number;
  isOverdue: boolean;
  hasSubmissions: boolean;
  allowedActions: Array<"update" | "cancel" | "progress">;
  progress: Array<{
    id: string;
    note: string;
    actorId: string;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    reason: string;
    actorId: string;
    createdAt: string;
  }>;
};
export type GuidanceTaskPage = GroupPage<GuidanceTaskView> & {
  overdueTotal: number;
};
export type WeeklyCoverageRow = {
  reviewResult?: "PASS" | "FAIL" | "REVISION_REQUIRED" | null;
  termStudentId: string;
  studentName: string;
  studentCode: string;
  proposalId: string | null;
  periodId: string;
  periodLabel: string;
  startsAt: string;
  reportDueAt: string | null;
  obligationId: string | null;
  obligationRevision: number | null;
  planId: string | null;
  planRevision: number | null;
  currentTaskId: string | null;
  missingPlan: boolean;
  missingTask: boolean;
  missingObligationRecord: boolean;
  isOverdue: boolean | null;
  submissionState: "NOT_DUE" | "MISSING" | "SUBMITTED";
  canEnsure: boolean;
  readiness: string[];
};
export type WeeklyCoveragePage = GroupPage<WeeklyCoverageRow> & {
  coverageState: "READY" | "NOT_CONFIGURED";
  warnings: string[];
};
