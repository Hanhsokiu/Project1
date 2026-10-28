import { z } from 'zod';
import type { GroupPage } from './review-groups';
export declare const ReviewQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    departmentId: z.ZodOptional<z.ZodString>;
    groupId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED", "REJECTED"]>>;
    unassigned: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strict", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "SUBMITTED" | "DRAFT" | "UNDER_REVIEW" | "REVISION_REQUESTED" | "APPROVED" | "REJECTED" | undefined;
    departmentId?: string | undefined;
    search?: string | undefined;
    groupId?: string | undefined;
    unassigned?: "true" | "false" | undefined;
}, {
    status?: "SUBMITTED" | "DRAFT" | "UNDER_REVIEW" | "REVISION_REQUESTED" | "APPROVED" | "REJECTED" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    departmentId?: string | undefined;
    search?: string | undefined;
    groupId?: string | undefined;
    unassigned?: "true" | "false" | undefined;
}>;
export declare const AssignReviewSchema: z.ZodEffects<z.ZodObject<{
    groupId: z.ZodString;
    proposalVersionId: z.ZodString;
    expectedProposalRevision: z.ZodNumber;
    replacesReviewId: z.ZodOptional<z.ZodString>;
    expectedReviewRevision: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    groupId: string;
    proposalVersionId: string;
    expectedProposalRevision: number;
    expectedReviewRevision?: number | undefined;
    reason?: string | undefined;
    replacesReviewId?: string | undefined;
}, {
    groupId: string;
    proposalVersionId: string;
    expectedProposalRevision: number;
    expectedReviewRevision?: number | undefined;
    reason?: string | undefined;
    replacesReviewId?: string | undefined;
}>, {
    groupId: string;
    proposalVersionId: string;
    expectedProposalRevision: number;
    expectedReviewRevision?: number | undefined;
    reason?: string | undefined;
    replacesReviewId?: string | undefined;
}, {
    groupId: string;
    proposalVersionId: string;
    expectedProposalRevision: number;
    expectedReviewRevision?: number | undefined;
    reason?: string | undefined;
    replacesReviewId?: string | undefined;
}>;
export declare const ReviewStartSchema: z.ZodObject<{
    expectedProposalRevision: z.ZodNumber;
    expectedReviewRevision: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    expectedReviewRevision: number;
    expectedProposalRevision: number;
}, {
    expectedReviewRevision: number;
    expectedProposalRevision: number;
}>;
export declare const ReviewCommentSchema: z.ZodObject<{
    expectedReviewRevision: z.ZodNumber;
    versionId: z.ZodString;
    text: z.ZodString;
}, "strict", z.ZodTypeAny, {
    expectedReviewRevision: number;
    versionId: string;
    text: string;
}, {
    expectedReviewRevision: number;
    versionId: string;
    text: string;
}>;
export declare const ReviewDecisionSchema: z.ZodEffects<z.ZodObject<{
    expectedProposalRevision: z.ZodNumber;
    expectedReviewRevision: z.ZodNumber;
} & {
    versionId: z.ZodString;
    decision: z.ZodEnum<["APPROVED", "REVISION_REQUIRED"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    decision: "APPROVED" | "REVISION_REQUIRED";
    expectedReviewRevision: number;
    versionId: string;
    expectedProposalRevision: number;
    comment?: string | undefined;
}, {
    decision: "APPROVED" | "REVISION_REQUIRED";
    expectedReviewRevision: number;
    versionId: string;
    expectedProposalRevision: number;
    comment?: string | undefined;
}>, {
    decision: "APPROVED" | "REVISION_REQUIRED";
    expectedReviewRevision: number;
    versionId: string;
    expectedProposalRevision: number;
    comment?: string | undefined;
}, {
    decision: "APPROVED" | "REVISION_REQUIRED";
    expectedReviewRevision: number;
    versionId: string;
    expectedProposalRevision: number;
    comment?: string | undefined;
}>;
export type ReviewQuery = z.infer<typeof ReviewQuerySchema>;
export type AssignReview = z.infer<typeof AssignReviewSchema>;
export type ReviewStart = z.infer<typeof ReviewStartSchema>;
export type ReviewCommentInput = z.infer<typeof ReviewCommentSchema>;
export type ReviewDecisionInput = z.infer<typeof ReviewDecisionSchema>;
export type ProposalReviewSummary = {
    id: string;
    termId: string;
    title: string;
    studentName: string;
    studentCode: string;
    departmentId: string | null;
    departmentName: string | null;
    researchAreaName: string | null;
    status: string;
    revision: number | null;
    submittedVersionId: string | null;
    versionNumber: number | null;
    activeReviewId: string | null;
    groupName: string | null;
    readiness: string[];
    canAssign: boolean;
};
export type ReviewCandidate = {
    id: string;
    name: string;
    memberCount: number;
    eligibleReviewerCount: number;
    specialtyMatchCount: number;
    activeReviewCount: number;
    explanation: string;
};
export type ProposalReviewView = {
    id: string;
    proposalId: string;
    termId: string;
    title: string;
    studentName: string;
    studentCode: string;
    proposalStatus: string;
    proposalRevision: number;
    revision: number;
    state: string;
    roundNumber: number;
    groupId: string;
    groupName: string;
    versionId: string;
    versionNumber: number;
    version: {
        content: unknown;
        contentHash: string | null;
        submittedAt: string | null;
        submittedByUserId: string | null;
    };
    assignedByUserId: string | null;
    assignedAt: string | null;
    startedByUserId: string | null;
    startedAt: string | null;
    routingSnapshot: unknown;
    phaseSnapshot: unknown;
    supersededByReviewId: string | null;
    comments: Array<{
        id: string;
        versionId: string;
        authorUserId: string;
        authorName: string;
        createdAt: string;
        text: string;
    }>;
    decision: {
        id: string;
        versionId: string;
        decision: 'APPROVED' | 'REVISION_REQUIRED';
        comment: string | null;
        decidedByUserId: string;
        deciderName: string;
        decidedAt: string;
    } | null;
    allowedActions: Array<'start' | 'comment' | 'decide' | 'assign'>;
};
export type ProposalReviewPage = GroupPage<ProposalReviewSummary>;
