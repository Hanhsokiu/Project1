import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const revision = z.number().int().min(0).max(2147483647);
const instant = z.string().datetime({ offset: true });
const file = z.object({
  originalName: z.string().min(1).max(180),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024),
  mimeType: z.literal("application/pdf"),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
});
const base = { proposalId: id, revision };
export const finalReportSchema = z.discriminatedUnion("state", [
  z.object({
    ...base,
    state: z.literal("SUBMITTED"),
    submittedAt: instant,
    file,
  }),
  z.object({
    ...base,
    state: z.literal("NOT_SUBMITTED"),
    submittedAt: instant.nullable(),
    file: z.null(),
  }),
  z.object({
    ...base,
    state: z.literal("LEGACY_REQUIRES_RECONCILIATION"),
    submittedAt: instant.nullable(),
    file: z.null(),
  }),
]);
export const finalReportContextSchema = z.object({
  proposalId: id,
  termId: id,
  code: z.literal("FINAL_REPORT_SUBMISSION"),
  canSubmit: z.boolean(),
  readiness: z.array(z.string()),
  serverNow: instant,
  expectedRevision: revision,
  window: z
    .object({
      opensAt: instant,
      closesAt: instant,
      locked: z.boolean(),
      revision,
    })
    .nullable(),
  maxFileBytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024),
  allowedExtensions: z
    .array(z.string())
    .refine((values) => values.includes("pdf")),
  temporarySizeLimit: z.boolean(),
  report: finalReportSchema,
});
export const expectedRevisionSchema = revision.max(2147483646);
export const proposalIdSchema = id;
export type FinalReport = z.infer<typeof finalReportSchema>;
export type FinalReportContext = z.infer<typeof finalReportContextSchema>;
