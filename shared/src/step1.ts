import { z } from "zod";
/** Public contracts for the implemented Step 1 API; no later-step business is activated. */
export const PhaseCodeSchema = z.enum([
  "REGISTRATION",
  "ASSIGNMENT",
  "PROPOSAL",
  "WEEKLY",
  "FINAL",
  "DEFENSE",
]);
export const SemesterInputSchema = z
  .object({
    academicYear: z.string().regex(/^\d{4}-\d{4}$/),
    semester: z.number().int().min(1).max(3),
    name: z.string().min(3).optional(),
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }),
  })
  .strict();
export const TermInputSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[A-Za-z0-9._-]+$/),
    name: z.string().min(5).max(250),
    semesterId: z.string().min(1),
    trainingSystemId: z.string().min(1),
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }),
    registrationStart: z.string().datetime({ offset: true }).optional(),
    registrationEnd: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export const TermPhaseInputSchema = z
  .object({
    id: z.string().optional(),
    code: PhaseCodeSchema,
    name: z.string().min(3),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    locked: z.boolean(),
  })
  .strict();
export const TermRosterInputSchema = z
  .object({
    studentIds: z.array(z.string()),
    lecturers: z.array(
      z
        .object({
          lecturerId: z.string(),
          quota: z.number().int().min(0).max(500),
        })
        .strict(),
    ),
  })
  .strict();
export const ImportConfirmSchema = z
  .object({ mode: z.enum(["STRICT", "VALID_ONLY"]) })
  .strict();
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
    fields?: { path: string; message: string }[];
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
  phases: (TermPhaseInput & { id: string })[];
  parameters: Record<string, number>;
  studentIds: string[];
  lecturers: { lecturerId: string; quota: number; officialCount: number }[];
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
  errors: { field: string; code: string; message: string }[];
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
