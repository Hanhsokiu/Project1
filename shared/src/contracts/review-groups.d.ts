import { z } from 'zod';
export declare const GroupCreateSchema: z.ZodObject<{
    name: z.ZodString;
    departmentId: z.ZodString;
    memberLecturerIds: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
}, "strict", z.ZodTypeAny, {
    name: string;
    departmentId: string;
    memberLecturerIds: string[];
}, {
    name: string;
    departmentId: string;
    memberLecturerIds: string[];
}>;
export declare const GroupUpdateSchema: z.ZodEffects<z.ZodObject<{
    expectedRevision: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    memberLecturerIds: z.ZodOptional<z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>>;
    reason: z.ZodString;
}, "strict", z.ZodTypeAny, {
    reason: string;
    expectedRevision: number;
    name?: string | undefined;
    memberLecturerIds?: string[] | undefined;
}, {
    reason: string;
    expectedRevision: number;
    name?: string | undefined;
    memberLecturerIds?: string[] | undefined;
}>, {
    reason: string;
    expectedRevision: number;
    name?: string | undefined;
    memberLecturerIds?: string[] | undefined;
}, {
    reason: string;
    expectedRevision: number;
    name?: string | undefined;
    memberLecturerIds?: string[] | undefined;
}>;
export declare const GroupMutationSchema: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    reason: z.ZodString;
}, "strict", z.ZodTypeAny, {
    reason: string;
    expectedRevision: number;
}, {
    reason: string;
    expectedRevision: number;
}>;
export declare const GroupMemberSchema: z.ZodObject<{
    expectedRevision: z.ZodNumber;
    reason: z.ZodString;
} & {
    lecturerId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    reason: string;
    expectedRevision: number;
    lecturerId: string;
}, {
    reason: string;
    expectedRevision: number;
    lecturerId: string;
}>;
export declare const GroupQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    departmentId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    page: number;
    limit: number;
    departmentId?: string | undefined;
    search?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    departmentId?: string | undefined;
    search?: string | undefined;
}>;
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
    term: {
        id: string;
        name: string;
        status: string;
    };
    canManage: boolean;
    departments: Array<{
        id: string;
        name: string;
    }>;
    lecturers: GroupPage<{
        id: string;
        fullName: string;
        lecturerCode: string;
        departmentId: string;
    }>;
};
