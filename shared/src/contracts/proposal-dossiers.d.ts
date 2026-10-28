import { z } from "zod";
import type { ProposalContent } from "./proposal-versions";
export declare const DOSSIER_TEMPLATE_VERSION = "project1-docx-individual-v1";
export declare const DossierFinalizeSchema: z.ZodObject<{
    expectedProposalRevision: z.ZodNumber;
    expectedDossierRevision: z.ZodNumber;
    approvedVersionId: z.ZodString;
    templateVersion: z.ZodDefault<z.ZodLiteral<"project1-docx-individual-v1">>;
}, "strict", z.ZodTypeAny, {
    templateVersion: "project1-docx-individual-v1";
    expectedDossierRevision: number;
    expectedProposalRevision: number;
    approvedVersionId: string;
}, {
    expectedDossierRevision: number;
    expectedProposalRevision: number;
    approvedVersionId: string;
    templateVersion?: "project1-docx-individual-v1" | undefined;
}>;
export declare const DossierReceiptSchema: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    finalizationId: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    finalizationId: string;
    expectedRevision: number;
    note?: string | undefined;
}, {
    finalizationId: string;
    expectedRevision: number;
    note?: string | undefined;
}>;
export declare const DossierPdfQuerySchema: z.ZodObject<{
    finalizationId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    finalizationId?: string | undefined;
}, {
    finalizationId?: string | undefined;
}>;
export declare const DossierPdfGenerateSchema: z.ZodObject<{
    finalizationId: z.ZodString;
    expectedRevision: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    finalizationId: string;
    expectedRevision: number;
}, {
    finalizationId: string;
    expectedRevision: number;
}>;
export type DossierFinalize = z.infer<typeof DossierFinalizeSchema>;
export type DossierReceiptInput = z.infer<typeof DossierReceiptSchema>;
export type DossierPrintSnapshot = {
    schemaVersion: 1;
    title: string;
    termName: string;
    student: {
        id: string;
        name: string;
        code: string;
        className: string;
        majorName: string;
        trainingSystem: string;
    };
    advisor: {
        id: string;
        name: string;
        department: string;
    };
    academicProfileRevision: number;
    assignmentId: string;
    assignmentRevision: number;
    topicRevision: number;
    content: ProposalContent;
};
export type DossierView = {
    proposalId: string;
    title: string;
    proposalStatus: string;
    proposalRevision: number;
    submittedVersionId: string | null;
    submittedVersionNumber: number | null;
    state: "DRAFT" | "FINALIZED" | "RECEIVED" | "REOPENED" | null;
    revision: number;
    readiness: string[];
    previewSnapshot: DossierPrintSnapshot | null;
    allowedActions: Array<"finalize" | "receive" | "download">;
    currentFinalization: null | {
        id: string;
        approvedVersionId: string;
        versionNumber: number;
        finalizedAt: string;
        finalizedByUserId: string;
        templateVersion: string;
        pdfGeneratedAt: string | null;
        pdfChecksum: string | null;
        snapshot: DossierPrintSnapshot;
    };
    receipt: null | {
        id: string;
        finalizationId: string;
        receivedAt: string;
        receivedByUserId: string;
        note: string | null;
    };
    history: Array<{
        id: string;
        action: string;
        actorId: string;
        createdAt: string;
    }>;
};
