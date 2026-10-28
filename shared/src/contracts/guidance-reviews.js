"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuidanceMeetingAmendSchema = exports.GuidanceMeetingCreateSchema = exports.GuidanceMonitorQuerySchema = exports.ProgressReviewAmendSchema = exports.ProgressReviewCreateSchema = exports.ProgressDecisionSchema = void 0;
const zod_1 = require("zod");
const revision = zod_1.z.number().int().nonnegative(), text = zod_1.z.string().trim().min(1).max(20000), id = zod_1.z.string().trim().min(1).max(100);
exports.ProgressDecisionSchema = zod_1.z.enum([
    "PASS",
    "FAIL",
    "REVISION_REQUIRED",
]);
const reviewFields = {
    expectedTaskRevision: revision,
    expectedSubmissionRevision: revision,
    decision: exports.ProgressDecisionSchema,
    comment: zod_1.z.string().trim().max(20000).optional(),
};
const comment = (v) => v.decision === "PASS" || !!v.comment?.trim();
exports.ProgressReviewCreateSchema = zod_1.z
    .object(reviewFields)
    .strict()
    .refine(comment, {
    message: "Không đạt/Cần sửa bắt buộc nhận xét.",
    path: ["comment"],
});
exports.ProgressReviewAmendSchema = zod_1.z
    .object({
    ...reviewFields,
    expectedReviewRevision: revision,
    reason: zod_1.z.string().trim().min(1).max(2000),
})
    .strict()
    .refine(comment, {
    message: "Không đạt/Cần sửa bắt buộc nhận xét.",
    path: ["comment"],
});
exports.GuidanceMonitorQuerySchema = zod_1.z
    .object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    advisorId: id.optional(),
    studentId: id.optional(),
    periodId: id.optional(),
    status: zod_1.z
        .enum([
        "TODO",
        "IN_PROGRESS",
        "SUBMITTED",
        "REVISION_REQUESTED",
        "COMPLETED",
        "CANCELLED",
    ])
        .optional(),
    decision: exports.ProgressDecisionSchema.optional(),
    pending: zod_1.z.enum(["true", "false"]).optional(),
    search: zod_1.z.string().trim().max(255).optional(),
})
    .strict();
const meetingFields = {
    occurredAt: zod_1.z.string().datetime({ offset: true }),
    mode: zod_1.z.enum(["IN_PERSON", "ONLINE"]),
    location: zod_1.z.string().trim().max(1000).nullable().optional(),
    discussion: text,
    conclusion: text,
};
exports.GuidanceMeetingCreateSchema = zod_1.z
    .object({ expectedPlanRevision: revision, ...meetingFields })
    .strict();
exports.GuidanceMeetingAmendSchema = zod_1.z
    .object(meetingFields)
    .partial()
    .extend({
    expectedRevision: revision,
    reason: zod_1.z.string().trim().min(1).max(2000),
})
    .strict()
    .refine((v) => Object.keys(meetingFields).some((k) => v[k] !== undefined), "Cần ít nhất một nội dung thay đổi.");
//# sourceMappingURL=guidance-reviews.js.map