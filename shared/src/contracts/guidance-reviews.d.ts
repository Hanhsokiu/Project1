import { z } from "zod";
import type { GroupPage } from "./review-groups";
import type { TaskSubmissionView } from "./task-submissions";
export declare const ProgressDecisionSchema: z.ZodEnum<["PASS", "FAIL", "REVISION_REQUIRED"]>;
export declare const ProgressReviewCreateSchema: z.ZodEffects<z.ZodObject<{
    expectedTaskRevision: z.ZodNumber;
    expectedSubmissionRevision: z.ZodNumber;
    decision: z.ZodEnum<["PASS", "FAIL", "REVISION_REQUIRED"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    expectedTaskRevision: number;
    decision: "PASS" | "FAIL" | "REVISION_REQUIRED";
    expectedSubmissionRevision: number;
    comment?: string | undefined;
}, {
    expectedTaskRevision: number;
    decision: "PASS" | "FAIL" | "REVISION_REQUIRED";
    expectedSubmissionRevision: number;
    comment?: string | undefined;
}>, {
    expectedTaskRevision: number;
    decision: "PASS" | "FAIL" | "REVISION_REQUIRED";
    expectedSubmissionRevision: number;
    comment?: string | undefined;
}, {
    expectedTaskRevision: number;
    decision: "PASS" | "FAIL" | "REVISION_REQUIRED";
    expectedSubmissionRevision: number;
    comment?: string | undefined;
}>;
export declare const ProgressReviewAmendSchema: z.ZodEffects<z.ZodObject<{
    expectedReviewRevision: z.ZodNumber;
    reason: z.ZodString;
    expectedTaskRevision: z.ZodNumber;
    expectedSubmissionRevision: z.ZodNumber;
    decision: z.ZodEnum<["PASS", "FAIL", "REVISION_REQUIRED"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    expectedTaskRevision: number;
    decision: "PASS" | "FAIL" | "REVISION_REQUIRED";
    expectedSubmissionRevision: number;
    expectedReviewRevision: number;
    reason: string;
    comment?: string | undefined;
}, {
    expectedTaskRevision: number;
    decision: "PASS" | "FAIL" | "REVISION_REQUIRED";
    expectedSubmissionRevision: number;
    expectedReviewRevision: number;
    reason: string;
    comment?: string | undefined;
}>, {
    expectedTaskRevision: number;
    decision: "PASS" | "FAIL" | "REVISION_REQUIRED";
    expectedSubmissionRevision: number;
    expectedReviewRevision: number;
    reason: string;
    comment?: string | undefined;
}, {
    expectedTaskRevision: number;
    decision: "PASS" | "FAIL" | "REVISION_REQUIRED";
    expectedSubmissionRevision: number;
    expectedReviewRevision: number;
    reason: string;
    comment?: string | undefined;
}>;
export declare const GuidanceMonitorQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    advisorId: z.ZodOptional<z.ZodString>;
    studentId: z.ZodOptional<z.ZodString>;
    periodId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["TODO", "IN_PROGRESS", "SUBMITTED", "REVISION_REQUESTED", "COMPLETED", "CANCELLED"]>>;
    decision: z.ZodOptional<z.ZodEnum<["PASS", "FAIL", "REVISION_REQUIRED"]>>;
    pending: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "SUBMITTED" | "TODO" | "IN_PROGRESS" | "REVISION_REQUESTED" | "COMPLETED" | "CANCELLED" | undefined;
    studentId?: string | undefined;
    advisorId?: string | undefined;
    periodId?: string | undefined;
    decision?: "PASS" | "FAIL" | "REVISION_REQUIRED" | undefined;
    pending?: "true" | "false" | undefined;
    search?: string | undefined;
}, {
    status?: "SUBMITTED" | "TODO" | "IN_PROGRESS" | "REVISION_REQUESTED" | "COMPLETED" | "CANCELLED" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    studentId?: string | undefined;
    advisorId?: string | undefined;
    periodId?: string | undefined;
    decision?: "PASS" | "FAIL" | "REVISION_REQUIRED" | undefined;
    pending?: "true" | "false" | undefined;
    search?: string | undefined;
}>;
export declare const GuidanceMeetingCreateSchema: z.ZodObject<{
    occurredAt: z.ZodString;
    mode: z.ZodEnum<["IN_PERSON", "ONLINE"]>;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discussion: z.ZodString;
    conclusion: z.ZodString;
    expectedPlanRevision: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    mode: "IN_PERSON" | "ONLINE";
    discussion: string;
    conclusion: string;
    expectedPlanRevision: number;
    occurredAt: string;
    location?: string | null | undefined;
}, {
    mode: "IN_PERSON" | "ONLINE";
    discussion: string;
    conclusion: string;
    expectedPlanRevision: number;
    occurredAt: string;
    location?: string | null | undefined;
}>;
export declare const GuidanceMeetingAmendSchema: z.ZodEffects<z.ZodObject<{
    occurredAt: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<["IN_PERSON", "ONLINE"]>>;
    location: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    discussion: z.ZodOptional<z.ZodString>;
    conclusion: z.ZodOptional<z.ZodString>;
} & {
    expectedRevision: z.ZodNumber;
    reason: z.ZodString;
}, "strict", z.ZodTypeAny, {
    reason: string;
    expectedRevision: number;
    location?: string | null | undefined;
    mode?: "IN_PERSON" | "ONLINE" | undefined;
    discussion?: string | undefined;
    conclusion?: string | undefined;
    occurredAt?: string | undefined;
}, {
    reason: string;
    expectedRevision: number;
    location?: string | null | undefined;
    mode?: "IN_PERSON" | "ONLINE" | undefined;
    discussion?: string | undefined;
    conclusion?: string | undefined;
    occurredAt?: string | undefined;
}>, {
    reason: string;
    expectedRevision: number;
    location?: string | null | undefined;
    mode?: "IN_PERSON" | "ONLINE" | undefined;
    discussion?: string | undefined;
    conclusion?: string | undefined;
    occurredAt?: string | undefined;
}, {
    reason: string;
    expectedRevision: number;
    location?: string | null | undefined;
    mode?: "IN_PERSON" | "ONLINE" | undefined;
    discussion?: string | undefined;
    conclusion?: string | undefined;
    occurredAt?: string | undefined;
}>;
export type ProgressReviewCreate = z.infer<typeof ProgressReviewCreateSchema>;
export type ProgressReviewAmend = z.infer<typeof ProgressReviewAmendSchema>;
export type GuidanceMonitorQuery = z.infer<typeof GuidanceMonitorQuerySchema>;
export type GuidanceMeetingCreate = z.infer<typeof GuidanceMeetingCreateSchema>;
export type GuidanceMeetingAmend = z.infer<typeof GuidanceMeetingAmendSchema>;
export type ProgressReviewView = {
    id: string;
    submissionId: string;
    decision: z.infer<typeof ProgressDecisionSchema>;
    comment: string | null;
    state: "RECORDED" | "SUPERSEDED";
    reviewerUserId: string;
    reviewerName: string;
    assignmentRevision: number;
    recordedAt: string;
    revision: number;
    supersedesReviewId: string | null;
    amendmentReason: string | null;
};
export type ProgressReviewContext = {
    submission: TaskSubmissionView;
    taskId: string;
    taskTitle: string;
    proposalId: string;
    termId: string;
    studentName: string;
    studentCode: string;
    periodLabel: string | null;
    taskStatus: string | null;
    taskRevision: number;
    currentSubmissionId: string | null;
    effectiveReview: ProgressReviewView | null;
    history: ProgressReviewView[];
    allowedActions: Array<"review" | "amend">;
    readiness: string[];
};
export type GuidanceMonitorRow = {
    legacyUnknown: boolean;
    taskId: string;
    planId: string;
    proposalId: string;
    termId: string;
    studentId: string;
    studentName: string;
    studentCode: string;
    advisorId: string | null;
    advisorName: string | null;
    title: string;
    periodId: string | null;
    periodLabel: string | null;
    status: string | null;
    dueDate: string;
    isOverdue: boolean;
    hasSubmission: boolean;
    submissionId: string | null;
    versionNumber: number | null;
    decision: z.infer<typeof ProgressDecisionSchema> | null;
    pendingReview: boolean;
};
export type GuidanceMonitorPage = GroupPage<GuidanceMonitorRow>;
export type GuidanceDashboard = {
    asOf: string;
    termId: string;
    metrics: {
        totalTasks: number;
        completed: number;
        notSubmitted: number;
        overdue: number;
        needsResubmission: number;
        failed: number;
        revisionRequired: number;
        pendingReview: number;
        cancelled: number;
        legacyUnknown: number;
    };
    weekly: {
        coverageState: "READY" | "NOT_CONFIGURED";
        required: number;
        submitted: number;
        missing: number;
        notDue: number;
        overdue: number;
        missingPlan: number;
        missingTask: number;
        warnings: string[];
    };
    tasks: GuidanceMonitorPage;
    advisors: Array<{
        id: string;
        name: string;
    }>;
    students: Array<{
        id: string;
        name: string;
        code: string;
    }>;
};
export type GuidanceMeetingView = {
    id: string;
    planId: string;
    occurredAt: string;
    mode: "IN_PERSON" | "ONLINE" | null;
    location: string | null;
    discussion: string | null;
    conclusion: string | null;
    authorUserId: string | null;
    revision: number;
    canAmend: boolean;
    history: Array<{
        id: string;
        actorId: string;
        createdAt: string;
        reason: string;
        snapshot: unknown;
    }>;
};
export type GuidanceMeetingPage = GroupPage<GuidanceMeetingView> & {
    planId: string;
    planRevision: number;
    proposalId: string;
    studentName: string;
    canCreate: boolean;
    readiness: string[];
};
export type GuidanceNotificationView = {
    id: string;
    title: string;
    body: string;
    link: string | null;
    status: "UNREAD" | "READ";
    createdAt: string;
    readAt: string | null;
};
