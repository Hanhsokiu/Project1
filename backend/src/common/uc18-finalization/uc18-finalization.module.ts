import { Module } from "@nestjs/common";
import { Uc18FinalizationReader } from "../contracts/uc18-finalization.port";
import { PrismaUc18FinalizationReader } from "./prisma-uc18-finalization.reader";
import { Uc18FinalizationRepository } from "./uc18-finalization.repository";
import { Uc18FinalizationValidator } from "./uc18-finalization.validator";

/** Neutral infrastructure: neither guidance nor defense depends on the other. */
@Module({
  providers: [
    Uc18FinalizationRepository,
    Uc18FinalizationValidator,
    { provide: Uc18FinalizationReader, useClass: PrismaUc18FinalizationReader },
  ],
  exports: [Uc18FinalizationReader],
})
export class Uc18FinalizationModule {}
