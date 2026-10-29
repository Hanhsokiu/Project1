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
export const ProposalPreviewPdfQuerySchema = z
  .object({ versionId: id })
  .strict();
export const DossierPdfGenerateSchema = z
  .object({ finalizationId: id, expectedRevision: revision })
  .strict();
export const DossierStudentProfileSchema = z
  .object({
    className: z.string().trim().min(1, "Cần xác nhận lớp sinh viên.").max(100),
    majorName: z.string().trim().min(1, "Cần xác nhận ngành đào tạo.").max(200),
    expectedRevision: revision.nullable(),
  })
  .strict();
export type DossierStudentProfileInput = z.infer<
  typeof DossierStudentProfileSchema
>;
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
    // Optional for snapshots finalized before contact fields were introduced.
    cohort?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  advisor: {
    id: string;
    name: string;
    department: string;
    phone?: string | null;
    email?: string | null;
  };
  academicProfileRevision: number;
  assignmentId: string;
  assignmentRevision: number;
  topicRevision: number;
  content: ProposalContent;
};
export type DossierHistoricalFinalization = {
  id: string;
  sequence: number;
  versionNumber: number;
  finalizedAt: string;
  supersededAt: string | null;
  templateVersion: string;
  snapshot: DossierPrintSnapshot | null;
  canDownload: boolean;
  receipt: DossierView["receipt"];
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
  studentProfile?: {
    className: string | null;
    majorName: string | null;
    revision: number | null;
    suggestedClassName: string | null;
    suggestedMajorName?: string | null;
    canManage: boolean;
  };
  previewSnapshot: DossierPrintSnapshot | null;
  previewVersionId: string | null;
  finalizations: DossierHistoricalFinalization[];
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
