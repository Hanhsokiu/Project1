import { Injectable } from "@nestjs/common";
import type { DefenseList, DefenseListFinalization } from "@prisma/client";
import { z } from "zod";
import {
  defenseListSnapshotSchema,
  defenseListSnapshotHash,
} from "./defense-list-snapshot";

const id = z
  .string()
  .min(1)
  .max(36)
  .refine((v) => v.trim() === v);
const revision = z.number().int().min(0).max(2147483647);
const coordinator = z.object({
  termId: id,
  state: z.enum(["DRAFT", "OPEN", "FINALIZED"]),
  revision,
  openedAt: z.date(),
  openedByUserId: id,
  currentFinalizationId: id.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
const finalization = z.object({
  id,
  termId: id,
  version: revision.refine((v) => v > 0),
  listRevision: revision.refine((v) => v > 0),
  snapshotSchemaVersion: revision.refine((v) => v > 0),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  finalizedAt: z.date(),
  finalizedByUserId: id,
});

@Injectable()
export class Uc18FinalizationValidator {
  list(termId: string, row: DefenseList): string | null {
    if (
      !coordinator.safeParse(row).success ||
      row.termId !== termId ||
      row.createdAt > row.updatedAt ||
      row.openedAt! > row.updatedAt
    )
      return "UC18_LIST_METADATA_INVALID";
    if (row.state === "OPEN" && row.currentFinalizationId !== null)
      return "UC18_LIST_METADATA_INVALID";
    if (row.state === "FINALIZED" && row.currentFinalizationId === null)
      return "UC18_LIST_METADATA_INVALID";
    return null;
  }

  snapshot(list: DefenseList, row: DefenseListFinalization): string | null {
    if (!finalization.safeParse(row).success)
      return "UC18_FINALIZATION_METADATA_INVALID";
    if (
      row.id !== list.currentFinalizationId ||
      row.termId !== list.termId ||
      row.listRevision !== list.revision
    )
      return "UC18_FINALIZATION_POINTER_INVALID";
    if (row.finalizedAt < list.openedAt! || row.finalizedAt > list.updatedAt)
      return "UC18_FINALIZATION_METADATA_INVALID";
    if (![1, 2].includes(row.snapshotSchemaVersion))
      return "UC18_SNAPSHOT_VERSION_UNSUPPORTED";
    const result = defenseListSnapshotSchema.safeParse(row.snapshot);
    if (!result.success) return "UC18_SNAPSHOT_INVALID";
    const snapshot = result.data;
    if (
      snapshot.schemaVersion !== row.snapshotSchemaVersion ||
      snapshot.termId !== row.termId ||
      snapshot.listRevision !== row.listRevision ||
      snapshot.finalizationVersion !== row.version ||
      Date.parse(snapshot.finalizedAt) !== row.finalizedAt.getTime() ||
      snapshot.finalizedByUserId !== row.finalizedByUserId
    )
      return "UC18_SNAPSHOT_CONTEXT_INVALID";
    if (defenseListSnapshotHash(row.snapshot) !== row.contentHash)
      return "UC18_SNAPSHOT_HASH_MISMATCH";
    return null;
  }
}
