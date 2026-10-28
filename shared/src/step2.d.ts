import { z } from "zod";
export declare const RegistrationStatusSchema: z.ZodEnum<["DRAFT", "SUBMITTED"]>;
export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>;
export declare const RegistrationWriteSchema: z.ZodObject<{
    directionId: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    preferences: z.ZodDefault<z.ZodArray<z.ZodObject<{
        lecturerId: z.ZodString;
        preferenceOrder: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        lecturerId: string;
        preferenceOrder: number;
    }, {
        lecturerId: string;
        preferenceOrder: number;
    }>, "many">>;
    note: z.ZodDefault<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    directionId: string | null;
    note: string;
    preferences: {
        lecturerId: string;
        preferenceOrder: number;
    }[];
    email?: string | undefined;
    phone?: string | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    directionId?: string | null | undefined;
    note?: string | undefined;
    preferences?: {
        lecturerId: string;
        preferenceOrder: number;
    }[] | undefined;
}>;
export type RegistrationWrite = z.infer<typeof RegistrationWriteSchema>;
export interface RegistrationResponse {
    id: string;
    termId: string;
    studentId: string;
    directionId: string | null;
    preferences: {
        lecturerId: string;
        preferenceOrder: number;
    }[];
    status: RegistrationStatus;
    legacyStatus: string | null;
    note: string;
    submittedAt: string | null;
    updatedAt: string;
}
