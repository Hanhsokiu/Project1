import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/** Read-only: the caller owns transaction, isolation and future write locks. */
@Injectable()
export class Uc18FinalizationRepository {
  list(termId: string, transaction: Prisma.TransactionClient) {
    return transaction.defenseList.findUnique({ where: { termId } });
  }

  finalization(id: string, transaction: Prisma.TransactionClient) {
    // Read the exact pointer, never MAX(version), latest history or live roster.
    return transaction.defenseListFinalization.findUnique({ where: { id } });
  }
}
