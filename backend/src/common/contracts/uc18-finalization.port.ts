import type { Prisma } from "@prisma/client";

/** A finalized list is distinct from a student's ELIGIBLE assessment. */
export type Uc18Finalization =
  | { state: "OPEN"; scope: "TERM"; termId: string; revision: number }
  | {
      state: "FINALIZED";
      scope: "TERM";
      termId: string;
      revision: number;
      finalizedAt: string;
      finalizedByUserId: string;
      /** Historical integrity only. No roster/PDF freshness inference or private
       * cross-student evidence is exposed through this term-level port. */
      evidence?: {
        finalizationId: string;
        version: number;
        snapshotSchemaVersion: number;
        contentHash: string;
        integrity: "VERIFIED";
        freshness: "NOT_CHECKED";
      };
    }
  | { state: "UNKNOWN"; scope: "TERM"; termId: string; reason: string };

/** Adapters read the authoritative source in the caller's transaction.
 * UC17 writes and UC18 finalization will also need a shared locking protocol.
 * UNKNOWN always blocks writes, including unavailable/unmigrated databases.
 * This port has no dependency on either feature module.
 */
export abstract class Uc18FinalizationReader {
  abstract read(
    termId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<Uc18Finalization>;
}
