import { Module } from "@nestjs/common";
import { CommitteeController } from "./controller/committee.controller";
import { CommitteeService } from "./service/committee.service";
import { DefenseListModule } from "./defense-lists/defense-list.module";
import { DefenseReviewModule } from "./reviews/defense-review.module";
import { DefensePlanningModule } from "./planning/defense-planning.module";
import { DefenseWorkflowModule } from "./workflow/defense-workflow.module";

@Module({
  imports: [
    DefenseListModule,
    DefenseReviewModule,
    DefensePlanningModule,
    DefenseWorkflowModule,
  ],
  controllers: [CommitteeController],
  providers: [CommitteeService],
  exports: [CommitteeService],
})
export class DefenseModule {}
