import { Module } from "@nestjs/common";
import { Uc18FinalizationModule } from "../../common/uc18-finalization/uc18-finalization.module";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import { DefensePlanningController } from "./defense-planning.controller";
import { DefensePlanningService } from "./defense-planning.service";
import { DefensePlanningRepository } from "./defense-planning.repository";
@Module({
  imports: [Uc18FinalizationModule],
  controllers: [DefensePlanningController],
  providers: [
    DefensePlanningService,
    DefensePlanningRepository,
    DefenseConfirmationValidator,
    ProposalReviewValidator,
    FinalReportValidator,
    SubmissionValidator,
  ],
})
export class DefensePlanningModule {}
