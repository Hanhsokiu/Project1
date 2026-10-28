"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyProposalContent = exports.VersionCompareSchema = exports.VersionPageQuerySchema = exports.ProposalVersionSubmitSchema = exports.ProposalVersionSaveSchema = exports.RevisionResponseSchema = exports.SubmittedProposalContentSchema = exports.ProposalContentSchema = void 0;
exports.compareProposalData = compareProposalData;
const zod_1 = require("zod");
const id = zod_1.z.string().trim().min(1).max(100);
const date = zod_1.z
    .string()
    .refine((v) => v === '' || zod_1.z.string().datetime({ offset: true }).safeParse(v).success, 'Thời gian phải có timezone ISO-8601.');
const text = zod_1.z.string().max(20000);
exports.ProposalContentSchema = zod_1.z
    .object({
    schemaVersion: zod_1.z.literal(1),
    objectives: text,
    scope: text,
    mainContents: text,
    tools: text,
    expectedResults: text,
    startsAt: date,
    endsAt: date,
    schedule: zod_1.z
        .array(zod_1.z
        .object({
        label: zod_1.z.string().max(255),
        startsAt: date,
        endsAt: date,
        deliverables: text,
    })
        .strict())
        .max(100),
})
    .strict();
exports.SubmittedProposalContentSchema = exports.ProposalContentSchema.superRefine((v, c) => {
    for (const key of [
        'objectives',
        'scope',
        'mainContents',
        'tools',
        'expectedResults',
        'startsAt',
        'endsAt',
    ])
        if (!v[key].trim())
            c.addIssue({
                code: 'custom',
                path: [key],
                message: 'Nội dung bắt buộc khi gửi duyệt.',
            });
    const start = Date.parse(v.startsAt), end = Date.parse(v.endsAt);
    if (!Number.isNaN(start) && !Number.isNaN(end) && start >= end)
        c.addIssue({
            code: 'custom',
            path: ['endsAt'],
            message: 'Ngày kết thúc phải sau ngày bắt đầu.',
        });
    if (!v.schedule.length)
        c.addIssue({
            code: 'custom',
            path: ['schedule'],
            message: 'Cần có kế hoạch thực hiện khi gửi duyệt.',
        });
    v.schedule.forEach((s, i) => {
        const a = Date.parse(s.startsAt), b = Date.parse(s.endsAt);
        if (!s.label.trim() ||
            !s.deliverables.trim() ||
            !s.startsAt ||
            !s.endsAt ||
            a >= b ||
            a < start ||
            b > end)
            c.addIssue({
                code: 'custom',
                path: ['schedule', i],
                message: 'Mốc cần tên, sản phẩm và thời gian hợp lệ trong khoảng thực hiện.',
            });
    });
});
exports.RevisionResponseSchema = zod_1.z
    .object({
    targetType: zod_1.z.enum(['COMMENT', 'DECISION']),
    targetId: id,
    text: zod_1.z.string().trim().min(1).max(10000),
})
    .strict();
exports.ProposalVersionSaveSchema = zod_1.z
    .object({
    expectedRevision: zod_1.z.number().int().nonnegative(),
    basedOnVersionId: id.optional(),
    content: exports.ProposalContentSchema,
    changeSummary: zod_1.z.string().trim().max(2000).optional(),
    responses: zod_1.z.array(exports.RevisionResponseSchema).max(200).optional(),
})
    .strict()
    .superRefine((v, c) => {
    if (v.responses &&
        new Set(v.responses.map((r) => `${r.targetType}:${r.targetId}`)).size !==
            v.responses.length)
        c.addIssue({
            code: 'custom',
            path: ['responses'],
            message: 'Một góp ý chỉ có một phản hồi trong mỗi snapshot.',
        });
});
exports.ProposalVersionSubmitSchema = zod_1.z
    .object({ expectedRevision: zod_1.z.number().int().nonnegative(), versionId: id })
    .strict();
exports.VersionPageQuerySchema = zod_1.z
    .object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
})
    .strict();
exports.VersionCompareSchema = zod_1.z
    .object({ fromVersionId: id, toVersionId: id })
    .strict();
function compareProposalData(before, after) {
    const changes = [];
    function visit(a, b, path, aExists = true, bExists = true) {
        if (aExists === bExists && JSON.stringify(a) === JSON.stringify(b))
            return;
        if (aExists &&
            bExists &&
            a !== null &&
            b !== null &&
            typeof a === 'object' &&
            typeof b === 'object' &&
            Array.isArray(a) === Array.isArray(b)) {
            for (const key of [
                ...new Set([...Object.keys(a), ...Object.keys(b)]),
            ].sort())
                visit(a[key], b[key], `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, Object.prototype.hasOwnProperty.call(a, key), Object.prototype.hasOwnProperty.call(b, key));
        }
        else
            changes.push({
                path: path || '/',
                before: aExists ? a : null,
                after: bExists ? b : null,
                beforeExists: aExists,
                afterExists: bExists,
            });
    }
    visit(before, after, '');
    return changes;
}
exports.emptyProposalContent = {
    schemaVersion: 1,
    objectives: '',
    scope: '',
    mainContents: '',
    tools: '',
    expectedResults: '',
    startsAt: '',
    endsAt: '',
    schedule: [],
};
//# sourceMappingURL=proposal-versions.js.map