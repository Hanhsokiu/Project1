import { z } from "zod";
export declare const PhaseCodeSchema: z.ZodEnum<["REGISTRATION", "ASSIGNMENT", "PROPOSAL", "WEEKLY", "FINAL", "DEFENSE"]>;
export declare const SemesterInputSchema: z.ZodObject<{
    academicYear: z.ZodString;
    semester: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    startDate: z.ZodString;
    endDate: z.ZodString;
}, "strict", z.ZodTypeAny, {
    academicYear: string;
    semester: number;
    startDate: string;
    endDate: string;
    name?: string | undefined;
}, {
    academicYear: string;
    semester: number;
    startDate: string;
    endDate: string;
    name?: string | undefined;
}>;
export declare const TermInputSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    semesterId: z.ZodString;
    trainingSystemId: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodString;
    registrationStart: z.ZodOptional<z.ZodString>;
    registrationEnd: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    code: string;
    name: string;
    semesterId: string;
    trainingSystemId: string;
    startDate: string;
    endDate: string;
    registrationStart?: string | undefined;
    registrationEnd?: string | undefined;
}, {
    code: string;
    name: string;
    semesterId: string;
    trainingSystemId: string;
    startDate: string;
    endDate: string;
    registrationStart?: string | undefined;
    registrationEnd?: string | undefined;
}>;
export declare const TermPhaseInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    code: z.ZodEnum<["REGISTRATION", "ASSIGNMENT", "PROPOSAL", "WEEKLY", "FINAL", "DEFENSE"]>;
    name: z.ZodString;
    start: z.ZodString;
    end: z.ZodString;
    locked: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    code: "REGISTRATION" | "ASSIGNMENT" | "PROPOSAL" | "WEEKLY" | "FINAL" | "DEFENSE";
    name: string;
    start: string;
    end: string;
    locked: boolean;
    id?: string | undefined;
}, {
    code: "REGISTRATION" | "ASSIGNMENT" | "PROPOSAL" | "WEEKLY" | "FINAL" | "DEFENSE";
    name: string;
    start: string;
    end: string;
    locked: boolean;
    id?: string | undefined;
}>;
export declare const TermRosterInputSchema: z.ZodObject<{
    studentIds: z.ZodArray<z.ZodString, "many">;
    lecturers: z.ZodArray<z.ZodObject<{
        lecturerId: z.ZodString;
        quota: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        lecturerId: string;
        quota: number;
    }, {
        lecturerId: string;
        quota: number;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    lecturers: {
        lecturerId: string;
        quota: number;
    }[];
    studentIds: string[];
}, {
    lecturers: {
        lecturerId: string;
        quota: number;
    }[];
    studentIds: string[];
}>;
export declare const ImportConfirmSchema: z.ZodObject<{
    mode: z.ZodEnum<["STRICT", "VALID_ONLY"]>;
}, "strict", z.ZodTypeAny, {
    mode: "STRICT" | "VALID_ONLY";
}, {
    mode: "STRICT" | "VALID_ONLY";
}>;
export type PhaseCode = z.infer<typeof PhaseCodeSchema>;
export type SemesterInput = z.infer<typeof SemesterInputSchema>;
export type CreateTermInput = z.infer<typeof TermInputSchema>;
export type TermPhaseInput = z.infer<typeof TermPhaseInputSchema>;
export type TermRosterInput = z.infer<typeof TermRosterInputSchema>;
export interface PageResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
export interface ApiResult<T> {
    success: true;
    data: T;
    message?: string;
    timestamp: string;
}
export interface ApiFailure {
    success: false;
    data: null;
    error: {
        code: string;
        message: string;
        fields?: {
            path: string;
            message: string;
        }[];
        details?: Record<string, unknown>;
    };
    message: string;
    timestamp: string;
    path: string;
}
export interface SemesterResponse extends SemesterInput {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}
export interface OperationWindowResponse {
    phaseCode: PhaseCode;
    status: string;
    serverNow: string;
    startAt: string | null;
    endAt: string | null;
    locked: boolean;
    canWrite: boolean;
    reason: string | null;
}
export interface TermResponse {
    id: string;
    code: string;
    name: string;
    semesterId: string | null;
    academicYear: string;
    semester: string;
    semesterNumber: number;
    trainingSystemId: string | null;
    program: string;
    start: string;
    end: string;
    startDate: string;
    endDate: string;
    status: string;
    locked: boolean;
    registrationStart: string;
    registrationEnd: string;
    phases: (TermPhaseInput & {
        id: string;
    })[];
    parameters: Record<string, number>;
    studentIds: string[];
    lecturers: {
        lecturerId: string;
        quota: number;
        officialCount: number;
    }[];
    assignmentPublished: boolean;
    resultsPublished: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ImportValues {
    studentCode: string;
    fullName: string;
    className: string;
    cohort: string;
    trainingSystemCode: string;
    gpa: number | null;
    email: string | null;
    phone: string | null;
    academicEligible: boolean;
}
export interface ImportRowResponse {
    rowNumber: number;
    values: ImportValues;
    action: "CREATE" | "UPDATE" | "SKIP" | "ERROR";
    status: "VALID" | "ERROR" | "IMPORTED" | "SKIPPED";
    errors: {
        field: string;
        code: string;
        message: string;
    }[];
    studentId?: string;
}
export interface ImportJobResponse {
    id: string;
    termId: string | null;
    fileName: string;
    status: "VALIDATED" | "DONE" | "PARTIAL" | "FAILED" | "QUEUED" | "PROCESSING";
    totalRows: number;
    validRows: number;
    invalidRows: number;
    successRows: number;
    errorRows: number;
    skippedRows: number;
    createdAt: string;
    confirmedAt: string | null;
    mode: "STRICT" | "VALID_ONLY" | null;
    rows: ImportRowResponse[];
    canConfirm: boolean;
}
