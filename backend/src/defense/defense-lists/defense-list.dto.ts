import { z } from "zod";
import type { DefenseList } from "@prisma/client";
import type { Uc18Finalization } from "../../common/contracts/uc18-finalization.port";

export const defenseListParamsSchema = z
  .object({
    termId: z.string().trim().min(1).max(36),
  })
  .strict();
export const defenseListCreateSchema = z.object({}).strict().default({});
export const defenseListOpenSchema = z
  .object({
    expectedRevision: z.number().int().min(0).max(2147483646),
  })
  .strict();
export type DefenseListParams = z.infer<typeof defenseListParamsSchema>;
export type DefenseListOpen = z.infer<typeof defenseListOpenSchema>;

const iso = (value: Date | null | undefined) =>
  value instanceof Date && Number.isFinite(value.getTime())
    ? value.toISOString()
    : null;

/** Explicit allowlist: no roster, snapshots, student data or storage references. */
export function defenseListResponse(
  termId: string,
  row: DefenseList | null,
  uc18: Uc18Finalization,
) {
  return {
    code: "DEFENSE_LIST" as const,
    termId,
    configured: row !== null,
    state: row?.state ?? null,
    revision: row?.revision ?? null,
    openedAt: iso(row?.openedAt),
    openedByUserId: row?.openedByUserId ?? null,
    createdAt: iso(row?.createdAt),
    updatedAt: iso(row?.updatedAt),
    uc18,
  };
}
