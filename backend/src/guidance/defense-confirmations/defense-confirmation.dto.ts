import { HttpException } from "@nestjs/common";
import { z } from "zod";

export function confirmationError(
  status: number,
  code: string,
  message: string,
): never {
  throw new HttpException({ error: { code, message } }, status);
}
const id = z.string().trim().min(1).max(36);
const revision = z.number().int().min(0).max(2147483647);
export const defenseConfirmationParamsSchema = z
  .object({ proposalId: id })
  .strict();
export const defenseConfirmationExpectedContextSchema = z
  .object({
    revision,
    assignment: z.object({ assignmentId: id, revision }).strict(),
    pdf: z
      .object({
        finalReportId: id,
        revision,
        checksum: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict()
      .nullable(),
  })
  .strict();
const queryInteger = (min: number, max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)
        ? Number(value)
        : value,
    z.number().int().min(min).max(max),
  );
export const defenseConfirmationHistoryQuerySchema = z
  .object({
    afterRevision: queryInteger(0, 2147483647).optional(),
    limit: queryInteger(1, 100).default(50),
  })
  .strict();
export type DefenseConfirmationHistoryQuery = z.infer<
  typeof defenseConfirmationHistoryQuerySchema
>;
export const defenseConfirmationPutSchema = z
  .object({
    status: z.enum(["CONFIRMED", "REJECTED"]),
    note: z.string().trim().max(10000).nullable().optional(),
    expectedRevision: revision.max(2147483646),
    // These are concurrency assertions only. Full snapshots/actors are forbidden.
    expectedContext: defenseConfirmationExpectedContextSchema,
    changeReason: z.string().trim().min(1).max(10000).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.status === "REJECTED" && !input.note?.trim())
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Từ chối phải có lý do.",
      });
    if (input.expectedRevision !== input.expectedContext.revision)
      ctx.addIssue({
        code: "custom",
        path: ["expectedContext", "revision"],
        message: "Revision context phải khớp expectedRevision.",
      });
  });
export type DefenseConfirmationPut = z.infer<
  typeof defenseConfirmationPutSchema
>;
export type DefenseConfirmationParams = z.infer<
  typeof defenseConfirmationParamsSchema
>;
