import { z } from "zod";

// These are assertions copied from context.expectedContext.pdf, never paths or
// authority to choose a different asset. All three are required, even on retry.
export const defenseConfirmationReportQuerySchema = z
  .object({
    finalReportId: z.string().trim().min(1).max(36),
    revision: z.preprocess(
      (value) =>
        typeof value === "string" && /^[1-9]\d*$/.test(value)
          ? Number(value)
          : value,
      z.number().int().min(1).max(2147483647),
    ),
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type DefenseConfirmationReportIdentity = z.infer<
  typeof defenseConfirmationReportQuerySchema
>;
