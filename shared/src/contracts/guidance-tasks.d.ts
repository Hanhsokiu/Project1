import { z } from "zod";
import type { GroupPage } from "./review-groups";
export declare const GuidancePlanCreateSchema: z.ZodObject<{
    finalizationId: z.ZodString;
    expectedDossierRevision: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    finalizationId: string;
    expectedDossierRevision: number;
    description?: string | undefined;
}, {
    finalizationId: string;
    expectedDossierRevision: number;
    description?: string | undefined;
}>;
export declare const GuidancePlanUpdateSchema: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    description: z.ZodString;
    reason: z.ZodString;
}, "strict", z.ZodTypeAny, {
    description: string;
    reason: string;
    expectedRevision: number;
}, {
    description: string;
    reason: string;
    expectedRevision: number;
}>;
export declare const GuidancePlanResumeSchema: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    finalizationId: z.ZodString;
    expectedDossierRevision: z.ZodNumber;
    acknowledgeRebase: z.ZodLiteral<true>;
}, "strict", z.ZodTypeAny, {
    finalizationId: string;
    expectedRevision: number;
    expectedDossierRevision: number;
    acknowledgeRebase: true;
}, {
    finalizationId: string;
    expectedRevision: number;
    expectedDossierRevision: number;
    acknowledgeRebase: true;
}>;
export declare const GuidanceTaskCreateSchema: z.ZodEffects<z.ZodObject<{
    expectedPlanRevision: z.ZodNumber;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    expectedDeliverables: z.ZodString;
    periodId: z.ZodString;
    startDate: z.ZodString;
    dueDate: z.ZodString;
}, "strict", z.ZodTypeAny, {
    title: string;
    periodId: string;
    startDate: string;
    expectedPlanRevision: number;
    expectedDeliverables: string;
    dueDate: string;
    description?: string | undefined;
}, {
    title: string;
    periodId: string;
    startDate: string;
    expectedPlanRevision: number;
    expectedDeliverables: string;
    dueDate: string;
    description?: string | undefined;
}>, {
    title: string;
    periodId: string;
    startDate: string;
    expectedPlanRevision: number;
    expectedDeliverables: string;
    dueDate: string;
    description?: string | undefined;
}, {
    title: string;
    periodId: string;
    startDate: string;
    expectedPlanRevision: number;
    expectedDeliverables: string;
    dueDate: string;
    description?: string | undefined;
}>;
export declare const GuidanceTaskUpdateSchema: z.ZodEffects<z.ZodObject<{
    expectedRevision: z.ZodNumber;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    expectedDeliverables: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
    acknowledgeExistingSubmissions: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    reason: string;
    expectedRevision: number;
    title?: string | undefined;
    description?: string | undefined;
    startDate?: string | undefined;
    expectedDeliverables?: string | undefined;
    dueDate?: string | undefined;
    acknowledgeExistingSubmissions?: boolean | undefined;
}, {
    reason: string;
    expectedRevision: number;
    title?: string | undefined;
    description?: string | undefined;
    startDate?: string | undefined;
    expectedDeliverables?: string | undefined;
    dueDate?: string | undefined;
    acknowledgeExistingSubmissions?: boolean | undefined;
}>, {
    reason: string;
    expectedRevision: number;
    title?: string | undefined;
    description?: string | undefined;
    startDate?: string | undefined;
    expectedDeliverables?: string | undefined;
    dueDate?: string | undefined;
    acknowledgeExistingSubmissions?: boolean | undefined;
}, {
    reason: string;
    expectedRevision: number;
    title?: string | undefined;
    description?: string | undefined;
    startDate?: string | undefined;
    expectedDeliverables?: string | undefined;
    dueDate?: string | undefined;
    acknowledgeExistingSubmissions?: boolean | undefined;
}>;
export declare const GuidanceTaskProgressSchema: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    note: z.ZodString;
}, "strict", z.ZodTypeAny, {
    expectedRevision: number;
    note: string;
}, {
    expectedRevision: number;
    note: string;
}>;
export declare const GuidanceTaskCancelSchema: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    reason: z.ZodString;
    acknowledgeExistingSubmissions: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    reason: string;
    expectedRevision: number;
    acknowledgeExistingSubmissions?: boolean | undefined;
}, {
    reason: string;
    expectedRevision: number;
    acknowledgeExistingSubmissions?: boolean | undefined;
}>;
export declare const WeeklyTaskEnsureSchema: z.ZodObject<{
    expectedObligationRevision: z.ZodNumber;
    expectedPlanRevision: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    expectedPlanRevision: number;
    expectedObligationRevision: number;
}, {
    expectedPlanRevision: number;
    expectedObligationRevision: number;
}>;
export declare const WeeklyObligationConfigSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    periodId: z.ZodString;
    termStudentId: z.ZodString;
    termId: z.ZodString;
    periodRevision: z.ZodNumber;
    startsAt: z.ZodString;
    reportDueAt: z.ZodString;
    expectedDeliverables: z.ZodString;
}, "strict", z.ZodTypeAny, {
    termId: string;
    periodId: string;
    termStudentId: string;
    startsAt: string;
    reportDueAt: string;
    schemaVersion: 1;
    periodRevision: number;
    expectedDeliverables: string;
}, {
    termId: string;
    periodId: string;
    termStudentId: string;
    startsAt: string;
    reportDueAt: string;
    schemaVersion: 1;
    periodRevision: number;
    expectedDeliverables: string;
}>;
export declare const GuidanceTaskStateSchema: z.ZodEnum<["TODO", "IN_PROGRESS", "SUBMITTED", "REVISION_REQUESTED", "COMPLETED", "CANCELLED"]>;
export declare const GuidanceTaskQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    periodId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["TODO", "IN_PROGRESS", "SUBMITTED", "REVISION_REQUESTED", "COMPLETED", "CANCELLED"]>>;
    isOverdue: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "SUBMITTED" | "TODO" | "IN_PROGRESS" | "REVISION_REQUESTED" | "COMPLETED" | "CANCELLED" | undefined;
    periodId?: string | undefined;
    search?: string | undefined;
    isOverdue?: "true" | "false" | undefined;
}, {
    status?: "SUBMITTED" | "TODO" | "IN_PROGRESS" | "REVISION_REQUESTED" | "COMPLETED" | "CANCELLED" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    periodId?: string | undefined;
    search?: string | undefined;
    isOverdue?: "true" | "false" | undefined;
}>;
export declare const WeeklyCoverageQuerySchema: z.ZodObject<Omit<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    periodId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["TODO", "IN_PROGRESS", "SUBMITTED", "REVISION_REQUESTED", "COMPLETED", "CANCELLED"]>>;
    isOverdue: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "status">, "strict", z.ZodTypeAny, {
    page: number;
    limit: number;
    periodId?: string | undefined;
    search?: string | undefined;
    isOverdue?: "true" | "false" | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    periodId?: string | undefined;
    search?: string | undefined;
    isOverdue?: "true" | "false" | undefined;
}>;
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
    phase: {
        startsAt: string;
        endsAt: string;
        isLocked: boolean;
    } | null;
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
