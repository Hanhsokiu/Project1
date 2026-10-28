"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewDecisionSchema = exports.ReviewCommentSchema = exports.ReviewStartSchema = exports.AssignReviewSchema = exports.ReviewQuerySchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().trim().min(1).max(100);
const revision = zod_1.z.number().int().nonnegative();
exports.ReviewQuerySchema = zod_1.z
    .object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().max(255).optional(),
    departmentId: id.optional(),
    groupId: id.optional(),
    status: zod_1.z
        .enum([
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'REVISION_REQUESTED',
        'APPROVED',
        'REJECTED',
    ])
        .optional(),
    unassigned: zod_1.z.enum(['true', 'false']).optional(),
})
    .strict();
exports.AssignReviewSchema = zod_1.z
    .object({
    groupId: id,
    proposalVersionId: id,
    expectedProposalRevision: revision,
    replacesReviewId: id.optional(),
    expectedReviewRevision: revision.optional(),
    reason: zod_1.z.string().trim().min(1).max(2000).optional(),
})
    .strict()
    .superRefine((v, c) => {
    if ((v.replacesReviewId !== undefined ||
        v.expectedReviewRevision !== undefined ||
        v.reason !== undefined) &&
        (!v.replacesReviewId ||
            v.expectedReviewRevision === undefined ||
            !v.reason))
        c.addIssue({
            code: 'custom',
            message: 'Phân lại cần vòng cũ, revision và lý do.',
        });
});
exports.ReviewStartSchema = zod_1.z
    .object({
    expectedProposalRevision: revision,
    expectedReviewRevision: revision,
})
    .strict();
exports.ReviewCommentSchema = zod_1.z
    .object({
    expectedReviewRevision: revision,
    versionId: id,
    text: zod_1.z.string().trim().min(1).max(10000),
})
    .strict();
exports.ReviewDecisionSchema = exports.ReviewStartSchema.extend({
    versionId: id,
    decision: zod_1.z.enum(['APPROVED', 'REVISION_REQUIRED']),
    comment: zod_1.z.string().trim().max(10000).optional(),
}).superRefine((v, c) => {
    if (v.decision === 'REVISION_REQUIRED' && !v.comment)
        c.addIssue({
            code: 'custom',
            path: ['comment'],
            message: 'Yêu cầu sửa phải có nhận xét.',
        });
});
//# sourceMappingURL=proposal-reviews.js.map