import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  Uc18FinalizationReader,
  type Uc18Finalization,
} from "../contracts/uc18-finalization.port";
import { Uc18FinalizationRepository } from "./uc18-finalization.repository";
import { Uc18FinalizationValidator } from "./uc18-finalization.validator";

@Injectable()
export class PrismaUc18FinalizationReader extends Uc18FinalizationReader {
  constructor(
    @Inject(Uc18FinalizationRepository)
    private readonly repo: Uc18FinalizationRepository,
    @Inject(Uc18FinalizationValidator)
    private readonly validator: Uc18FinalizationValidator,
  ) {
    super();
  }

  async read(
    termId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<Uc18Finalization> {
    const unknown = (reason: string): Uc18Finalization => ({
      state: "UNKNOWN",
      scope: "TERM",
      termId,
      reason,
    });
    try {
      const list = await this.repo.list(termId, transaction);
      if (!list) return unknown("UC18_NOT_CONFIGURED");
      if (list.state === "DRAFT") return unknown("UC18_DRAFT");
      const invalidList = this.validator.list(termId, list);
      if (invalidList) return unknown(invalidList);
      if (list.state === "OPEN")
        return {
          state: "OPEN",
          scope: "TERM",
          termId,
          revision: list.revision,
        };
      if (list.state !== "FINALIZED" || !list.currentFinalizationId)
        return unknown("UC18_LIST_METADATA_INVALID");
      const row = await this.repo.finalization(
        list.currentFinalizationId,
        transaction,
      );
      if (!row) return unknown("UC18_FINALIZATION_MISSING");
      const invalidSnapshot = this.validator.snapshot(list, row);
      if (invalidSnapshot) return unknown(invalidSnapshot);
      return {
        state: "FINALIZED",
        scope: "TERM",
        termId,
        revision: list.revision,
        finalizedAt: row.finalizedAt.toISOString(),
        finalizedByUserId: row.finalizedByUserId,
        evidence: {
          finalizationId: row.id,
          version: row.version,
          snapshotSchemaVersion: row.snapshotSchemaVersion,
          contentHash: row.contentHash,
          integrity: "VERIFIED",
          freshness: "NOT_CHECKED",
        },
      };
    } catch {
      // Includes absent tables/columns (P2021/P2022), query and verification errors.
      // Never expose SQL, credentials or snapshot contents; never fall back OPEN.
      // A SQL error may abort the caller's transaction: it must roll back rather
      // than attempt writes after UNKNOWN. This reader does not recover/retry it.
      return unknown("UC18_SOURCE_OR_VERIFICATION_UNAVAILABLE");
    }
  }
}
