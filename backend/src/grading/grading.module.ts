import { Module } from "@nestjs/common";
import { ScoreController } from "./controller/score.controller";
import { ScoreService } from "./service/score.service";
import { ScoreAggregatorService } from "./service/score-aggregator.service";
import { GradingWorkflowModule } from "./workflow/grading-workflow.module";

@Module({
  imports: [GradingWorkflowModule],
  controllers: [ScoreController],
  providers: [ScoreService, ScoreAggregatorService],
  exports: [ScoreService, ScoreAggregatorService],
})
export class GradingModule {}
