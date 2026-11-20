import { z } from "zod";

// An additive read contract. Existing /students and write payloads stay intact.
export const StudentDirectoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(8),
  search: z.string().trim().max(200).default(""),
  trainingSystemId: z.string().uuid().optional(),
  className: z.string().max(100).optional(),
  termId: z.string().uuid().optional(),
  academicCondition: z.enum(["eligible", "ineligible"]).optional(),
  sortBy: z.enum(["code", "name", "gpa"]).default("code"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});
export type StudentDirectoryQuery = z.infer<typeof StudentDirectoryQuerySchema>;

export const StudentDirectoryItemSchema = z.object({
  id: z.string().min(1),
  studentCode: z.string(),
  fullName: z.string(),
  className: z.string(),
  majorName: z.string(),
  gpa: z.number().nullable(),
  academicEligible: z.boolean(),
  trainingSystemId: z.string().min(1),
  trainingSystem: z.object({ id: z.string(), code: z.string(), name: z.string() }),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export type StudentDirectoryItem = z.infer<typeof StudentDirectoryItemSchema>;

export const StudentDirectoryPageSchema = z.object({
  items: z.array(StudentDirectoryItemSchema),
  total: z.number().int().nonnegative().safe(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  totalPages: z.number().int().nonnegative(),
}).refine(value => value.items.length === Math.min(value.pageSize, Math.max(0, value.total - (value.page - 1) * value.pageSize)) &&
  value.totalPages === Math.ceil(value.total / value.pageSize), "Invalid directory page");
export type StudentDirectoryPage = z.infer<typeof StudentDirectoryPageSchema>;

export const StudentDirectoryOptionsSchema = z.object({
  total: z.number().int().nonnegative().safe(),
  eligible: z.number().int().nonnegative().safe(),
  ineligible: z.number().int().nonnegative().safe(),
  classes: z.array(z.string().min(1)),
}).refine(value => value.total === value.eligible + value.ineligible &&
  new Set(value.classes).size === value.classes.length, "Invalid directory statistics");
export type StudentDirectoryOptions = z.infer<typeof StudentDirectoryOptionsSchema>;
