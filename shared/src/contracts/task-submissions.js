"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskSubmissionQuerySchema = exports.TaskSubmissionCreateSchema = exports.SubmissionUploadPolicySchema = exports.SubmissionFileKindSchema = void 0;
const zod_1 = require("zod");
exports.SubmissionFileKindSchema = zod_1.z.enum([
    "REPORT",
    "SOURCE",
    "EVIDENCE",
]);
exports.SubmissionUploadPolicySchema = zod_1.z
    .object({
    policyId: zod_1.z.string().trim().min(1).max(100),
    maxFileBytes: zod_1.z
        .number()
        .int()
        .positive()
        .max(100 * 1024 * 1024),
    maxSubmissionBytes: zod_1.z
        .number()
        .int()
        .positive()
        .max(500 * 1024 * 1024),
    stagingTtlHours: zod_1.z.number().int().min(1).max(168),
    maxPendingFilesPerStudent: zod_1.z.number().int().min(2).max(100),
    zipMaxEntries: zod_1.z.number().int().min(1).max(10000),
    zipMaxExpandedBytes: zod_1.z
        .number()
        .int()
        .positive()
        .max(1024 * 1024 * 1024),
    roles: zod_1.z
        .object({
        REPORT: zod_1.z
            .object({
            extensions: zod_1.z.array(zod_1.z.literal("pdf")).min(1),
            maxFiles: zod_1.z.literal(1),
        })
            .strict(),
        SOURCE: zod_1.z
            .object({
            extensions: zod_1.z.array(zod_1.z.literal("zip")).min(1),
            maxFiles: zod_1.z.literal(1),
        })
            .strict(),
        EVIDENCE: zod_1.z
            .object({
            extensions: zod_1.z.array(zod_1.z.enum(["pdf", "png", "jpg", "jpeg"])),
            maxFiles: zod_1.z.number().int().min(0).max(10),
        })
            .strict(),
    })
        .strict(),
})
    .strict()
    .refine((p) => p.maxSubmissionBytes >= p.maxFileBytes, "Total limit must cover one file");
exports.TaskSubmissionCreateSchema = zod_1.z
    .object({
    expectedTaskRevision: zod_1.z.number().int().nonnegative(),
    uploadIds: zod_1.z
        .array(zod_1.z.string().uuid())
        .min(2)
        .max(12)
        .refine((v) => new Set(v).size === v.length, "Duplicate upload"),
    content: zod_1.z.string().trim().max(20000).optional(),
})
    .strict();
exports.TaskSubmissionQuerySchema = zod_1.z
    .object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
})
    .strict();
//# sourceMappingURL=task-submissions.js.map