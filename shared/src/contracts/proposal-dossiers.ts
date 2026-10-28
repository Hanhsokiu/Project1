import { z } from "zod";
import type { ProposalContent } from "./proposal-versions";
const id = z.string().trim().min(1).max(100);
const revision = z.number().int().nonnegative();
export const DOSSIER_TEMPLATE_VERSION = "project1-docx-individual-v1";
export const DossierFinalizeSchema = z
  .object({
    expectedProposalRevision: revision,
    expectedDossierRevision: revision,
    approvedVersionId: id,
    templateVersion: z
      .literal(DOSSIER_TEMPLATE_VERSION)
      .default(DOSSIER_TEMPLATE_VERSION),
  })
  .strict();
export const DossierReceiptSchema = z
  .object({
    expectedRevision: revision,
    finalizationId: id,
    note: z.string().trim().max(2000).optional(),
  })
  .strict();
export const DossierPdfQuerySchema = z
  .object({ finalizationId: id.optional() })
  .strict();
export const DossierPdfGenerateSchema = z
  .object({ finalizationId: id, expectedRevision: revision })
  .strict();
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
  advisor: { id: string; name: string; department: string };
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
