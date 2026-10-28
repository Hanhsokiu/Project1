"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DossierPdfGenerateSchema = exports.DossierPdfQuerySchema = exports.DossierReceiptSchema = exports.DossierFinalizeSchema = exports.DOSSIER_TEMPLATE_VERSION = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().trim().min(1).max(100);
const revision = zod_1.z.number().int().nonnegative();
exports.DOSSIER_TEMPLATE_VERSION = "project1-docx-individual-v1";
exports.DossierFinalizeSchema = zod_1.z
    .object({
    expectedProposalRevision: revision,
    expectedDossierRevision: revision,
    approvedVersionId: id,
    templateVersion: zod_1.z
        .literal(exports.DOSSIER_TEMPLATE_VERSION)
        .default(exports.DOSSIER_TEMPLATE_VERSION),
})
    .strict();
exports.DossierReceiptSchema = zod_1.z
    .object({
    expectedRevision: revision,
    finalizationId: id,
    note: zod_1.z.string().trim().max(2000).optional(),
})
    .strict();
exports.DossierPdfQuerySchema = zod_1.z
    .object({ finalizationId: id.optional() })
    .strict();
exports.DossierPdfGenerateSchema = zod_1.z
    .object({ finalizationId: id, expectedRevision: revision })
    .strict();
//# sourceMappingURL=proposal-dossiers.js.map