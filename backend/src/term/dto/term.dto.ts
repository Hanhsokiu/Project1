import { z } from "zod";

export const basePhaseCodes = [
  "REGISTRATION",
  "ASSIGNMENT",
  "PROPOSAL",
  "WEEKLY",
  "FINAL",
  "DEFENSE",
] as const;
export const phaseCodes = [
  "REGISTRATION",
  "ASSIGNMENT",
  "PROPOSAL",
  "PROPOSAL_REVIEW",
  "WEEKLY",
  "FINAL",
  "DEFENSE",
] as const;
export type PhaseCode = (typeof phaseCodes)[number];
const iso = z.string().datetime({
  offset: true,
  message: "Thời gian phải là ISO8601 kèm múi giờ.",
});
const id = z.string().trim().min(1).max(100);
export const termStatuses = [
  "DRAFT",
  "OPEN_REGISTRATION",
  "CLOSED_REGISTRATION",
  "IN_PROGRESS",
  "DEFENDING",
  "COMPLETED",
  "CANCELLED",
] as const;

export const semesterCreateSchema = z
  .object({
    academicYear: z
      .string()
      .regex(/^\d{4}-\d{4}$/, "Năm học theo định dạng 2026-2027."),
    semester: z.number().int().min(1).max(3),
    name: z.string().trim().min(3).max(200).optional(),
    startDate: iso,
    endDate: iso,
  })
  .strict();
export const semesterPatchSchema = semesterCreateSchema.partial().strict();
export type SemesterCreateDto = z.infer<typeof semesterCreateSchema>;
export type SemesterPatchDto = z.infer<typeof semesterPatchSchema>;

export const termCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(
        /^[A-Za-z0-9._-]+$/,
        "Mã đợt chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch ngang.",
      ),
    name: z.string().trim().min(5).max(250),
    semesterId: id,
    trainingSystemId: id,
    startDate: iso,
    endDate: iso,
    registrationStart: iso.optional(),
    registrationEnd: iso.optional(),
  })
  .strict();
export const termPatchSchema = termCreateSchema.partial().strict();
export type TermCreateDto = z.infer<typeof termCreateSchema>;
export type TermPatchDto = z.infer<typeof termPatchSchema>;

export const termQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(150).optional(),
    status: z.enum(termStatuses).optional(),
    trainingSystemId: id.optional(),
    semesterId: id.optional(),
    academicYear: z.string().max(20).optional(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    pageSize: value.pageSize ?? value.limit ?? 10,
  }));
export type TermQueryDto = z.infer<typeof termQuerySchema>;
export const latestTermQuerySchema = z
  .object({ trainingSystemId: id, semesterId: id })
  .strict();
export const semesterQuerySchema = z
  .object({
    academicYear: z.string().max(20).optional(),
    search: z.string().trim().max(150).optional(),
  })
  .strict();
export const phaseSchema = z
  .object({
    id: id.optional(),
    code: z.enum(phaseCodes),
    name: z.string().trim().min(3).max(200),
    start: iso,
    end: iso,
    locked: z.boolean(),
  })
  .strict();
export const phasePlanSchema = z
  .object({
    phases: z
      .array(phaseSchema)
      .min(6, "Kế hoạch phải có đầy đủ sáu giai đoạn chính.")
      .max(7, "Chỉ được thêm một giai đoạn xét duyệt đề cương."),
  })
  .strict();
export type PhaseInput = z.infer<typeof phaseSchema>;
export const parametersSchema = z
  .object({
    parameters: z.record(
      z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
      z.number().finite(),
    ),
  })
  .strict();
export const rosterSchema = z
  .object({
    studentIds: z.array(id).max(10000),
    lecturers: z
      .array(
        z
          .object({ lecturerId: id, quota: z.number().int().min(0).max(500) })
          .strict(),
      )
      .max(2000),
  })
  .strict();
export type RosterDto = z.infer<typeof rosterSchema>;
export const termStatusSchema = z
  .object({ status: z.enum(termStatuses) })
  .strict();
export const termLockSchema = z.object({ locked: z.boolean() }).strict();
export const operationQuerySchema = z
  .object({ phaseCode: z.enum(phaseCodes) })
  .strict();
