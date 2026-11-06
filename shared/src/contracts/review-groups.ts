import { z } from 'zod';

const id = z.string().trim().min(1).max(100);
const reason = z.string().trim().min(1, 'Vui lòng nhập lý do.').max(2000);
const members = z
  .array(id)
  .refine(
    (v) => new Set(v).size === v.length,
    'Danh sách thành viên bị trùng.',
  );
export const GroupCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Vui lòng nhập tên nhóm.').max(255),
    departmentId: id,
    memberLecturerIds: members,
  })
  .strict();
export const GroupUpdateSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(255).optional(),
    memberLecturerIds: members.optional(),
    reason,
  })
  .strict()
  .refine(
    (v) => v.name !== undefined || v.memberLecturerIds !== undefined,
    'Chưa có thay đổi.',
  );
export const GroupMutationSchema = z
  .object({ expectedRevision: z.number().int().nonnegative(), reason })
  .strict();
export const GroupMemberSchema = GroupMutationSchema.extend({ lecturerId: id });
export const GroupQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    departmentId: id.optional(),
  })
  .strict();
export type GroupCreate = z.infer<typeof GroupCreateSchema>;
export type GroupUpdate = z.infer<typeof GroupUpdateSchema>;
export type GroupMutation = z.infer<typeof GroupMutationSchema>;
export type GroupQuery = z.infer<typeof GroupQuerySchema>;
export type ReviewGroupView = {
  id: string;
  termId: string;
  departmentId: string;
  departmentName: string;
  name: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  activeReviewCount: number;
  canManage: boolean;
  members: Array<{
    lecturerId: string;
    fullName: string;
    lecturerCode: string;
    role: 'MEMBER';
  }>;
};
export type GroupPage<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
export type GroupOptions = {
  term: { id: string; name: string; status: string };
  canManage: boolean;
  departments: Array<{ id: string; name: string }>;
  lecturers: GroupPage<{
    id: string;
    fullName: string;
    lecturerCode: string;
    departmentId: string;
  }>;
};
