import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  Uc18FinalizationReader,
  type Uc18Finalization,
} from "./uc18-finalization.port";

@Injectable()
export class UnknownUc18FinalizationReader extends Uc18FinalizationReader {
  async read(
    termId: string,
    _transaction: Prisma.TransactionClient,
  ): Promise<Uc18Finalization> {
    // No database query and no fallback to eligibility, term status or windows.
    return {
      state: "UNKNOWN",
      scope: "TERM",
      termId,
      reason: "UC18_SOURCE_NOT_IMPLEMENTED",
    };
  }
}
