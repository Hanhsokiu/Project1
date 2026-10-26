import { z } from "zod";
const contactEmail = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().trim().email("Email không hợp lệ").nullable().optional(),
);
const phone = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{9,10}$/, "Số điện thoại không hợp lệ")
    .nullable()
    .optional(),
);
const gpa = z.preprocess(
  (v) => (v === null || (typeof v === "string" && !v.trim()) ? undefined : v),
  z.coerce.number().min(0, "GPA phải từ 0 đến 4").max(4, "GPA phải từ 0 đến 4"),
);
export const studentSchema = z.object({
  studentCode: z.string().trim().min(3).max(50),
  fullName: z.string().trim().min(3).max(200),
  className: z.string().trim().min(1).max(100),
  cohort: z.string().trim().max(50).optional().default(""),
  trainingSystemId: z.string().uuid(),
  gpa,
  academicEligible: z.boolean().optional().default(true),
  email: contactEmail,
  phone,
  isActive: z.boolean().optional().default(true),
});
export const studentPatchSchema = studentSchema.partial();
export const lecturerSchema = z.object({
  lecturerCode: z.string().trim().min(2).max(50),
  fullName: z.string().trim().min(3).max(200),
  departmentId: z.string().uuid(),
  titleId: z.string().uuid().nullable().optional(),
  email: contactEmail,
  phone,
  maxStudents: z.coerce.number().int().min(0).max(100).default(5),
  researchAreaIds: z
    .array(z.string().uuid())
    .min(1)
    .refine((v) => new Set(v).size === v.length, "Hướng chuyên môn bị trùng"),
  isActive: z.boolean().default(true),
});
export const lecturerPatchSchema = lecturerSchema.partial();
export const namedCatalogSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(200),
});
export const areaSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(3000).nullable().optional(),
});
export type StudentInput = z.infer<typeof studentSchema>;
export type LecturerInput = z.infer<typeof lecturerSchema>;
export interface CatalogQuery {
  page: number;
  pageSize: number;
  search?: string;
  termId?: string;
  trainingSystemId?: string;
  className?: string;
  academicEligible?: boolean;
  departmentId?: string;
  researchAreaId?: string;
  isActive?: boolean;
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
export interface ImportRowError {
  field: string;
  code: string;
  message: string;
}
export interface StudentImportRow {
  rowNumber: number;
  values: ImportValues;
  action: "CREATE" | "UPDATE" | "SKIP" | "ERROR";
  status: "VALID" | "ERROR" | "IMPORTED" | "SKIPPED";
  errors: ImportRowError[];
  studentId?: string;
  numericCode?: boolean;
  invalidAcademicFlag?: boolean;
}
export interface ImportFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
export type ConfirmMode = "STRICT" | "VALID_ONLY";
export type ReferenceKind =
  "departments" | "training-systems" | "research-areas";
