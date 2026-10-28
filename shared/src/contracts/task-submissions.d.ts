import { z } from "zod";
import type { GroupPage } from "./review-groups";
export declare const SubmissionFileKindSchema: z.ZodEnum<["REPORT", "SOURCE", "EVIDENCE"]>;
export declare const SubmissionUploadPolicySchema: z.ZodEffects<z.ZodObject<{
    policyId: z.ZodString;
    maxFileBytes: z.ZodNumber;
    maxSubmissionBytes: z.ZodNumber;
    stagingTtlHours: z.ZodNumber;
    maxPendingFilesPerStudent: z.ZodNumber;
    zipMaxEntries: z.ZodNumber;
    zipMaxExpandedBytes: z.ZodNumber;
    roles: z.ZodObject<{
        REPORT: z.ZodObject<{
            extensions: z.ZodArray<z.ZodLiteral<"pdf">, "many">;
            maxFiles: z.ZodLiteral<1>;
        }, "strict", z.ZodTypeAny, {
            extensions: "pdf"[];
            maxFiles: 1;
        }, {
            extensions: "pdf"[];
            maxFiles: 1;
        }>;
        SOURCE: z.ZodObject<{
            extensions: z.ZodArray<z.ZodLiteral<"zip">, "many">;
            maxFiles: z.ZodLiteral<1>;
        }, "strict", z.ZodTypeAny, {
            extensions: "zip"[];
            maxFiles: 1;
        }, {
            extensions: "zip"[];
            maxFiles: 1;
        }>;
        EVIDENCE: z.ZodObject<{
            extensions: z.ZodArray<z.ZodEnum<["pdf", "png", "jpg", "jpeg"]>, "many">;
            maxFiles: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            extensions: ("pdf" | "png" | "jpg" | "jpeg")[];
            maxFiles: number;
        }, {
            extensions: ("pdf" | "png" | "jpg" | "jpeg")[];
            maxFiles: number;
        }>;
    }, "strict", z.ZodTypeAny, {
        REPORT: {
            extensions: "pdf"[];
            maxFiles: 1;
        };
        SOURCE: {
            extensions: "zip"[];
            maxFiles: 1;
        };
        EVIDENCE: {
            extensions: ("pdf" | "png" | "jpg" | "jpeg")[];
            maxFiles: number;
        };
    }, {
        REPORT: {
            extensions: "pdf"[];
            maxFiles: 1;
        };
        SOURCE: {
            extensions: "zip"[];
            maxFiles: 1;
        };
        EVIDENCE: {
            extensions: ("pdf" | "png" | "jpg" | "jpeg")[];
            maxFiles: number;
        };
    }>;
}, "strict", z.ZodTypeAny, {
    policyId: string;
    maxFileBytes: number;
    maxSubmissionBytes: number;
    stagingTtlHours: number;
    maxPendingFilesPerStudent: number;
    zipMaxEntries: number;
    zipMaxExpandedBytes: number;
    roles: {
        REPORT: {
            extensions: "pdf"[];
            maxFiles: 1;
        };
        SOURCE: {
            extensions: "zip"[];
            maxFiles: 1;
        };
        EVIDENCE: {
            extensions: ("pdf" | "png" | "jpg" | "jpeg")[];
            maxFiles: number;
        };
    };
}, {
    policyId: string;
    maxFileBytes: number;
    maxSubmissionBytes: number;
    stagingTtlHours: number;
    maxPendingFilesPerStudent: number;
    zipMaxEntries: number;
    zipMaxExpandedBytes: number;
    roles: {
        REPORT: {
            extensions: "pdf"[];
            maxFiles: 1;
        };
        SOURCE: {
            extensions: "zip"[];
            maxFiles: 1;
        };
        EVIDENCE: {
            extensions: ("pdf" | "png" | "jpg" | "jpeg")[];
            maxFiles: number;
        };
    };
}>, {
    policyId: string;
    maxFileBytes: number;
    maxSubmissionBytes: number;
    stagingTtlHours: number;
    maxPendingFilesPerStudent: number;
    zipMaxEntries: number;
    zipMaxExpandedBytes: number;
    roles: {
        REPORT: {
            extensions: "pdf"[];
            maxFiles: 1;
        };
        SOURCE: {
            extensions: "zip"[];
            maxFiles: 1;
        };
        EVIDENCE: {
            extensions: ("pdf" | "png" | "jpg" | "jpeg")[];
            maxFiles: number;
        };
    };
}, {
    policyId: string;
    maxFileBytes: number;
    maxSubmissionBytes: number;
    stagingTtlHours: number;
    maxPendingFilesPerStudent: number;
    zipMaxEntries: number;
    zipMaxExpandedBytes: number;
    roles: {
        REPORT: {
            extensions: "pdf"[];
            maxFiles: 1;
        };
        SOURCE: {
            extensions: "zip"[];
            maxFiles: 1;
        };
        EVIDENCE: {
            extensions: ("pdf" | "png" | "jpg" | "jpeg")[];
            maxFiles: number;
        };
    };
}>;
export declare const TaskSubmissionCreateSchema: z.ZodObject<{
    expectedTaskRevision: z.ZodNumber;
    uploadIds: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
    content: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    expectedTaskRevision: number;
    uploadIds: string[];
    content?: string | undefined;
}, {
    expectedTaskRevision: number;
    uploadIds: string[];
    content?: string | undefined;
}>;
export declare const TaskSubmissionQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type SubmissionUploadPolicy = z.infer<typeof SubmissionUploadPolicySchema>;
export type SubmissionFileKind = z.infer<typeof SubmissionFileKindSchema>;
export type TaskSubmissionCreate = z.infer<typeof TaskSubmissionCreateSchema>;
export type SubmissionFileView = {
    id: string;
    kind: SubmissionFileKind;
    originalName: string;
    sizeBytes: number;
    mimeType: string;
    checksum: string;
};
export type SubmissionUploadView = {
    id: string;
    expiresAt: string;
    file: SubmissionFileView;
};
export type TaskSubmissionView = {
    id: string;
    taskId: string;
    versionNumber: number | null;
    state: "SUBMITTED" | "REVIEWED" | "SUPERSEDED" | null;
    submittedBy: string | null;
    submittedAt: string | null;
    deadlineSnapshot: string | null;
    isLate: boolean | null;
    revision: number;
    content: string | null;
    files: SubmissionFileView[];
    contextSnapshot: unknown;
};
export type TaskSubmissionPage = GroupPage<TaskSubmissionView> & {
    currentSubmissionId: string | null;
};
export type TaskSubmissionContext = {
    taskId: string;
    taskRevision: number;
    canSubmit: boolean;
    readiness: string[];
    policy: SubmissionUploadPolicy | null;
    latePolicy: "ACCEPT_WHILE_PHASE_OPEN";
    dueDate: string;
    currentSubmissionId: string | null;
};
