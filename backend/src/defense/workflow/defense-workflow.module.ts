import { Module } from "@nestjs/common";
import { Uc18FinalizationModule } from "../../common/uc18-finalization/uc18-finalization.module";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import { DefenseWorkflowController } from "./defense-workflow.controller";
import { DefenseWorkflowRepository } from "./defense-workflow.repository";
import { DefenseWorkflowService } from "./defense-workflow.service";
@Module({
  imports: [Uc18FinalizationModule],
  controllers: [DefenseWorkflowController],
  providers: [
    DefenseWorkflowService,
    DefenseWorkflowRepository,
    DefenseConfirmationValidator,
    ProposalReviewValidator,
    FinalReportValidator,
    SubmissionValidator,
  ],
})
export class DefenseWorkflowModule {}
