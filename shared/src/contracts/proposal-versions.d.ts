import { z } from 'zod';
import type { GroupPage } from './review-groups';
export declare const ProposalContentSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    objectives: z.ZodString;
    scope: z.ZodString;
    mainContents: z.ZodString;
    tools: z.ZodString;
    expectedResults: z.ZodString;
    startsAt: z.ZodEffects<z.ZodString, string, string>;
    endsAt: z.ZodEffects<z.ZodString, string, string>;
    schedule: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        startsAt: z.ZodEffects<z.ZodString, string, string>;
        endsAt: z.ZodEffects<z.ZodString, string, string>;
        deliverables: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }, {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    startsAt: string;
    endsAt: string;
    schemaVersion: 1;
    objectives: string;
    scope: string;
    mainContents: string;
    tools: string;
    expectedResults: string;
    schedule: {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }[];
}, {
    startsAt: string;
    endsAt: string;
    schemaVersion: 1;
    objectives: string;
    scope: string;
    mainContents: string;
    tools: string;
    expectedResults: string;
    schedule: {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }[];
}>;
export declare const SubmittedProposalContentSchema: z.ZodEffects<z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    objectives: z.ZodString;
    scope: z.ZodString;
    mainContents: z.ZodString;
    tools: z.ZodString;
    expectedResults: z.ZodString;
    startsAt: z.ZodEffects<z.ZodString, string, string>;
    endsAt: z.ZodEffects<z.ZodString, string, string>;
    schedule: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        startsAt: z.ZodEffects<z.ZodString, string, string>;
        endsAt: z.ZodEffects<z.ZodString, string, string>;
        deliverables: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }, {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    startsAt: string;
    endsAt: string;
    schemaVersion: 1;
    objectives: string;
    scope: string;
    mainContents: string;
    tools: string;
    expectedResults: string;
    schedule: {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }[];
}, {
    startsAt: string;
    endsAt: string;
    schemaVersion: 1;
    objectives: string;
    scope: string;
    mainContents: string;
    tools: string;
    expectedResults: string;
    schedule: {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }[];
}>, {
    startsAt: string;
    endsAt: string;
    schemaVersion: 1;
    objectives: string;
    scope: string;
    mainContents: string;
    tools: string;
    expectedResults: string;
    schedule: {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }[];
}, {
    startsAt: string;
    endsAt: string;
    schemaVersion: 1;
    objectives: string;
    scope: string;
    mainContents: string;
    tools: string;
    expectedResults: string;
    schedule: {
        label: string;
        startsAt: string;
        endsAt: string;
        deliverables: string;
    }[];
}>;
export declare const RevisionResponseSchema: z.ZodObject<{
    targetType: z.ZodEnum<["COMMENT", "DECISION"]>;
    targetId: z.ZodString;
    text: z.ZodString;
}, "strict", z.ZodTypeAny, {
    text: string;
    targetType: "COMMENT" | "DECISION";
    targetId: string;
}, {
    text: string;
    targetType: "COMMENT" | "DECISION";
    targetId: string;
}>;
export declare const ProposalVersionSaveSchema: z.ZodEffects<z.ZodObject<{
    expectedRevision: z.ZodNumber;
    basedOnVersionId: z.ZodOptional<z.ZodString>;
    content: z.ZodObject<{
        schemaVersion: z.ZodLiteral<1>;
        objectives: z.ZodString;
        scope: z.ZodString;
        mainContents: z.ZodString;
        tools: z.ZodString;
        expectedResults: z.ZodString;
        startsAt: z.ZodEffects<z.ZodString, string, string>;
        endsAt: z.ZodEffects<z.ZodString, string, string>;
        schedule: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            startsAt: z.ZodEffects<z.ZodString, string, string>;
            endsAt: z.ZodEffects<z.ZodString, string, string>;
            deliverables: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            label: string;
            startsAt: string;
            endsAt: string;
            deliverables: string;
        }, {
            label: string;
            startsAt: string;
            endsAt: string;
            deliverables: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        startsAt: string;
        endsAt: string;
        schemaVersion: 1;
        objectives: string;
        scope: string;
        mainContents: string;
        tools: string;
        expectedResults: string;
        schedule: {
            label: string;
            startsAt: string;
            endsAt: string;
            deliverables: string;
        }[];
    }, {
        startsAt: string;
        endsAt: string;
        schemaVersion: 1;
        objectives: string;
        scope: string;
        mainContents: string;
        tools: string;
        expectedResults: string;
        schedule: {
            label: string;
            startsAt: string;
            endsAt: string;
            deliverables: string;
        }[];
    }>;
    changeSummary: z.ZodOptional<z.ZodString>;
    responses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        targetType: z.ZodEnum<["COMMENT", "DECISION"]>;
        targetId: z.ZodString;
        text: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        text: string;
        targetType: "COMMENT" | "DECISION";
        targetId: string;
    }, {
        text: string;
        targetType: "COMMENT" | "DECISION";
        targetId: string;
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    content: {
        startsAt: string;
        endsAt: string;
        schemaVersion: 1;
        objectives: string;
        scope: string;
        mainContents: string;
        tools: string;
        expectedResults: string;
        schedule: {
            label: string;
            startsAt: string;
            endsAt: string;
            deliverables: string;
        }[];
    };
    expectedRevision: number;
    basedOnVersionId?: string | undefined;
    responses?: {
        text: string;
        targetType: "COMMENT" | "DECISION";
        targetId: string;
    }[] | undefined;
    changeSummary?: string | undefined;
}, {
    content: {
        startsAt: string;
        endsAt: string;
        schemaVersion: 1;
        objectives: string;
        scope: string;
        mainContents: string;
        tools: string;
        expectedResults: string;
        schedule: {
            label: string;
            startsAt: string;
            endsAt: string;
            deliverables: string;
        }[];
    };
    expectedRevision: number;
    basedOnVersionId?: string | undefined;
    responses?: {
        text: string;
        targetType: "COMMENT" | "DECISION";
        targetId: string;
    }[] | undefined;
    changeSummary?: string | undefined;
}>, {
    content: {
        startsAt: string;
        endsAt: string;
        schemaVersion: 1;
        objectives: string;
        scope: string;
        mainContents: string;
        tools: string;
        expectedResults: string;
        schedule: {
            label: string;
            startsAt: string;
            endsAt: string;
            deliverables: string;
        }[];
    };
    expectedRevision: number;
    basedOnVersionId?: string | undefined;
    responses?: {
        text: string;
        targetType: "COMMENT" | "DECISION";
        targetId: string;
    }[] | undefined;
    changeSummary?: string | undefined;
}, {
    content: {
        startsAt: string;
        endsAt: string;
        schemaVersion: 1;
        objectives: string;
        scope: string;
        mainContents: string;
        tools: string;
        expectedResults: string;
        schedule: {
            label: string;
            startsAt: string;
            endsAt: string;
            deliverables: string;
        }[];
    };
    expectedRevision: number;
    basedOnVersionId?: string | undefined;
    responses?: {
        text: string;
        targetType: "COMMENT" | "DECISION";
        targetId: string;
    }[] | undefined;
    changeSummary?: string | undefined;
}>;
export declare const ProposalVersionSubmitSchema: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    versionId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    expectedRevision: number;
    versionId: string;
}, {
    expectedRevision: number;
    versionId: string;
}>;
export declare const VersionPageQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export declare const VersionCompareSchema: z.ZodObject<{
    fromVersionId: z.ZodString;
    toVersionId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    fromVersionId: string;
    toVersionId: string;
}, {
    fromVersionId: string;
    toVersionId: string;
}>;
export type ProposalContent = z.infer<typeof ProposalContentSchema>;
export type RevisionResponse = z.infer<typeof RevisionResponseSchema>;
export type ProposalVersionSave = z.infer<typeof ProposalVersionSaveSchema>;
export type ProposalVersionSubmit = z.infer<typeof ProposalVersionSubmitSchema>;
export type VersionPageQuery = z.infer<typeof VersionPageQuerySchema>;
export type ProposalFeedback = {
    targetType: 'COMMENT' | 'DECISION';
    targetId: string;
    reviewId: string;
    sourceVersionId: string;
    versionNumber: number;
    roundNumber: number | null;
    authorUserId: string;
    authorName: string;
    text: string;
    createdAt: string;
};
export type ProposalVersionView = {
    id: string;
    proposalId: string;
    versionNumber: number;
    state: 'DRAFT' | 'SEALED' | null;
    content: unknown;
    contentHash: string | null;
    createdAt: string;
    createdByUserId: string | null;
    authorName: string | null;
    submittedAt: string | null;
    submittedByUserId: string | null;
    basedOnVersionId: string | null;
    changeSummary: string | null;
    responses: RevisionResponse[];
    provenance: unknown;
};
export type ProposalEditorContext = {
    proposalId: string;
    topicId: string;
    termId: string;
    termStudentId: string;
    title: string;
    studentName: string;
    status: string;
    revision: number;
    workingVersionId: string | null;
    submittedVersionId: string | null;
    workingVersion: ProposalVersionView | null;
    submittedVersion: ProposalVersionView | null;
    feedback: ProposalFeedback[];
    allowedActions: Array<'save' | 'submit'>;
    readiness: string[];
    phase: {
        startsAt: string;
        endsAt: string;
        isLocked: boolean;
    } | null;
};
export type ProposalVersionPage = GroupPage<ProposalVersionView>;
export type ProposalVersionMutationView = ProposalVersionView & {
    proposalRevision: number;
};
export type DataChange = {
    path: string;
    before: unknown;
    after: unknown;
    beforeExists: boolean;
    afterExists: boolean;
};
export declare function compareProposalData(before: unknown, after: unknown): DataChange[];
export declare const emptyProposalContent: ProposalContent;
