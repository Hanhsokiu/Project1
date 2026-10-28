"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupQuerySchema = exports.GroupMemberSchema = exports.GroupMutationSchema = exports.GroupUpdateSchema = exports.GroupCreateSchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().trim().min(1).max(100);
const reason = zod_1.z.string().trim().min(1, 'Vui lòng nhập lý do.').max(2000);
const members = zod_1.z
    .array(id)
    .refine((v) => new Set(v).size === v.length, 'Danh sách thành viên bị trùng.');
exports.GroupCreateSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1, 'Vui lòng nhập tên nhóm.').max(255),
    departmentId: id,
    memberLecturerIds: members,
})
    .strict();
exports.GroupUpdateSchema = zod_1.z
    .object({
    expectedRevision: zod_1.z.number().int().nonnegative(),
    name: zod_1.z.string().trim().min(1).max(255).optional(),
    memberLecturerIds: members.optional(),
    reason,
})
    .strict()
    .refine((v) => v.name !== undefined || v.memberLecturerIds !== undefined, 'Chưa có thay đổi.');
exports.GroupMutationSchema = zod_1.z
    .object({ expectedRevision: zod_1.z.number().int().nonnegative(), reason })
    .strict();
exports.GroupMemberSchema = exports.GroupMutationSchema.extend({ lecturerId: id });
exports.GroupQuerySchema = zod_1.z
    .object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().max(255).optional(),
    departmentId: id.optional(),
})
    .strict();
//# sourceMappingURL=review-groups.js.map