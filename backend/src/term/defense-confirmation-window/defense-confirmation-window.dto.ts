import { z } from "zod";
import type { DefenseConfirmationWindow } from "@prisma/client";

export const DEFENSE_CONFIRMATION = "DEFENSE_CONFIRMATION";
export const defenseConfirmationWindowParamsSchema = z
  .object({ termId: z.string().trim().min(1).max(100) })
  .strict();
const instant = z
  .string()
  .datetime({ offset: true })
  .refine(
    (value) => Number.isFinite(new Date(value).getTime()),
    "Thời điểm không hợp lệ.",
  );
export const defenseConfirmationWindowPutSchema = z
  .object({
    opensAt: instant,
    closesAt: instant,
    locked: z.boolean(),
    expectedRevision: z.number().int().min(0).max(2147483646),
  })
  .strict();
export type DefenseConfirmationWindowPut = z.infer<
  typeof defenseConfirmationWindowPutSchema
>;
export type DefenseConfirmationWindowParams = z.infer<
  typeof defenseConfirmationWindowParamsSchema
>;
export type DefenseConfirmationWindowResponse = {
  code: typeof DEFENSE_CONFIRMATION;
  termId: string;
  configured: boolean;
  revision: number;
  window: {
    opensAt: string;
    closesAt: string;
    locked: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};
export function defenseConfirmationWindowResponse(
  termId: string,
  row: DefenseConfirmationWindow | null,
): DefenseConfirmationWindowResponse {
  return {
    code: DEFENSE_CONFIRMATION,
    termId,
    configured: row !== null,
    revision: row?.revision ?? 0,
    window: row
      ? {
          opensAt: row.opensAt.toISOString(),
          closesAt: row.closesAt.toISOString(),
          locked: row.isLocked,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }
      : null,
  };
}
