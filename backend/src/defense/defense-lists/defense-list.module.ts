import { Module } from "@nestjs/common";
import { Uc18FinalizationModule } from "../../common/uc18-finalization/uc18-finalization.module";
import { DefenseListController } from "./defense-list.controller";
import { DefenseListRepository } from "./defense-list.repository";
import { DefenseListService } from "./defense-list.service";
import { DefenseListValidator } from "./defense-list.validator";

@Module({
  imports: [Uc18FinalizationModule],
  controllers: [DefenseListController],
  providers: [DefenseListRepository, DefenseListService, DefenseListValidator],
})
export class DefenseListModule {}
