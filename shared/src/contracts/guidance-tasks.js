"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyCoverageQuerySchema = exports.GuidanceTaskQuerySchema = exports.GuidanceTaskStateSchema = exports.WeeklyObligationConfigSchema = exports.WeeklyTaskEnsureSchema = exports.GuidanceTaskCancelSchema = exports.GuidanceTaskProgressSchema = exports.GuidanceTaskUpdateSchema = exports.GuidanceTaskCreateSchema = exports.GuidancePlanResumeSchema = exports.GuidancePlanUpdateSchema = exports.GuidancePlanCreateSchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().trim().min(1).max(100), revision = zod_1.z.number().int().nonnegative(), date = zod_1.z.string().datetime({ offset: true });
exports.GuidancePlanCreateSchema = zod_1.z
    .object({
    finalizationId: id,
    expectedDossierRevision: revision,
    description: zod_1.z.string().trim().max(20000).optional(),
})
    .strict();
exports.GuidancePlanUpdateSchema = zod_1.z
    .object({
    expectedRevision: revision,
    description: zod_1.z.string().trim().max(20000),
    reason: zod_1.z.string().trim().min(1).max(2000),
})
    .strict();
exports.GuidancePlanResumeSchema = zod_1.z
    .object({
    expectedRevision: revision,
    finalizationId: id,
    expectedDossierRevision: revision,
    acknowledgeRebase: zod_1.z.literal(true),
})
    .strict();
exports.GuidanceTaskCreateSchema = zod_1.z
    .object({
    expectedPlanRevision: revision,
    title: zod_1.z.string().trim().min(1).max(255),
    description: zod_1.z.string().trim().max(20000).optional(),
    expectedDeliverables: zod_1.z.string().trim().min(1).max(20000),
    periodId: id,
    startDate: date,
    dueDate: date,
})
    .strict()
    .refine((v) => Date.parse(v.startDate) < Date.parse(v.dueDate), {
    message: "Ngày bắt đầu phải trước hạn hoàn thành.",
    path: ["dueDate"],
});
exports.GuidanceTaskUpdateSchema = zod_1.z
    .object({
    expectedRevision: revision,
    title: zod_1.z.string().trim().min(1).max(255).optional(),
    description: zod_1.z.string().trim().max(20000).optional(),
    expectedDeliverables: zod_1.z.string().trim().min(1).max(20000).optional(),
    startDate: date.optional(),
    dueDate: date.optional(),
    reason: zod_1.z.string().trim().min(1).max(2000),
    acknowledgeExistingSubmissions: zod_1.z.boolean().optional(),
})
    .strict()
    .refine((v) => [
    "title",
    "description",
    "expectedDeliverables",
    "startDate",
    "dueDate",
].some((k) => v[k] !== undefined), "Cần ít nhất một trường thay đổi.");
exports.GuidanceTaskProgressSchema = zod_1.z
    .object({
    expectedRevision: revision,
    note: zod_1.z.string().trim().min(1).max(20000),
})
    .strict();
exports.GuidanceTaskCancelSchema = zod_1.z
    .object({
    expectedRevision: revision,
    reason: zod_1.z.string().trim().min(1).max(2000),
    acknowledgeExistingSubmissions: zod_1.z.boolean().optional(),
})
    .strict();
exports.WeeklyTaskEnsureSchema = zod_1.z
    .object({
    expectedObligationRevision: revision,
    expectedPlanRevision: revision,
})
    .strict();
exports.WeeklyObligationConfigSchema = zod_1.z
    .object({
    schemaVersion: zod_1.z.literal(1),
    periodId: id,
    termStudentId: id,
    termId: id,
    periodRevision: revision,
    startsAt: date,
    reportDueAt: date,
    expectedDeliverables: zod_1.z.string().trim().min(1).max(20000),
})
    .strict();
exports.GuidanceTaskStateSchema = zod_1.z.enum([
    "TODO",
    "IN_PROGRESS",
    "SUBMITTED",
    "REVISION_REQUESTED",
    "COMPLETED",
    "CANCELLED",
]);
exports.GuidanceTaskQuerySchema = zod_1.z
    .object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    periodId: id.optional(),
    status: exports.GuidanceTaskStateSchema.optional(),
    isOverdue: zod_1.z.enum(["true", "false"]).optional(),
    search: zod_1.z.string().trim().max(255).optional(),
})
    .strict();
exports.WeeklyCoverageQuerySchema = exports.GuidanceTaskQuerySchema.omit({
    status: true,
});
//# sourceMappingURL=guidance-tasks.js.map