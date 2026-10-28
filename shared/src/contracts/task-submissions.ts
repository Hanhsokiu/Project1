import { z } from "zod";
import type { GroupPage } from "./review-groups";
export const SubmissionFileKindSchema = z.enum([
  "REPORT",
  "SOURCE",
  "EVIDENCE",
]);
export const SubmissionUploadPolicySchema = z
  .object({
    policyId: z.string().trim().min(1).max(100),
    maxFileBytes: z
      .number()
      .int()
      .positive()
      .max(100 * 1024 * 1024),
    maxSubmissionBytes: z
      .number()
      .int()
      .positive()
      .max(500 * 1024 * 1024),
    stagingTtlHours: z.number().int().min(1).max(168),
    maxPendingFilesPerStudent: z.number().int().min(2).max(100),
    zipMaxEntries: z.number().int().min(1).max(10000),
    zipMaxExpandedBytes: z
      .number()
      .int()
      .positive()
      .max(1024 * 1024 * 1024),
    roles: z
      .object({
        REPORT: z
          .object({
            extensions: z.array(z.literal("pdf")).min(1),
            maxFiles: z.literal(1),
          })
          .strict(),
        SOURCE: z
          .object({
            extensions: z.array(z.literal("zip")).min(1),
            maxFiles: z.literal(1),
          })
          .strict(),
        EVIDENCE: z
          .object({
            extensions: z.array(z.enum(["pdf", "png", "jpg", "jpeg"])),
            maxFiles: z.number().int().min(0).max(10),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (p) => p.maxSubmissionBytes >= p.maxFileBytes,
    "Total limit must cover one file",
  );
export const TaskSubmissionCreateSchema = z
  .object({
    expectedTaskRevision: z.number().int().nonnegative(),
    uploadIds: z
      .array(z.string().uuid())
      .min(2)
      .max(12)
      .refine((v) => new Set(v).size === v.length, "Duplicate upload"),
    content: z.string().trim().max(20000).optional(),
  })
  .strict();
export const TaskSubmissionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type SubmissionUploadPolicy = z.infer<
  typeof SubmissionUploadPolicySchema
>;
export type SubmissionFileKind = z.infer<typeof SubmissionFileKindSchema>;
export type TaskSubmissionCreate = z.infer<typeof TaskSubmissionCreateSchema>;
export type SubmissionFileView = {
  id: string;
  kind: SubmissionFileKind;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  checksum: string;
};
export type SubmissionUploadView = {
  id: string;
  expiresAt: string;
  file: SubmissionFileView;
};
export type TaskSubmissionView = {
  id: string;
  taskId: string;
  versionNumber: number | null;
  state: "SUBMITTED" | "REVIEWED" | "SUPERSEDED" | null;
  submittedBy: string | null;
  submittedAt: string | null;
  deadlineSnapshot: string | null;
  isLate: boolean | null;
  revision: number;
  content: string | null;
  files: SubmissionFileView[];
  contextSnapshot: unknown;
};
export type TaskSubmissionPage = GroupPage<TaskSubmissionView> & {
  currentSubmissionId: string | null;
};
export type TaskSubmissionContext = {
  taskId: string;
  taskRevision: number;
  canSubmit: boolean;
  readiness: string[];
  policy: SubmissionUploadPolicy | null;
  latePolicy: "ACCEPT_WHILE_PHASE_OPEN";
  dueDate: string;
  currentSubmissionId: string | null;
};
