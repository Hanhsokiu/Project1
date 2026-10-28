import { Module } from "@nestjs/common";
import { Uc18FinalizationModule } from "../../common/uc18-finalization/uc18-finalization.module";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { DefenseConfirmationReadValidator } from "../../guidance/defense-confirmations/defense-confirmation-read.validator";
import { DefenseConfirmationProgressValidator } from "../../guidance/defense-confirmations/defense-confirmation-progress.validator";
import { DefenseReviewController } from "./defense-review.controller";
import { DefenseReviewRepository } from "./defense-review.repository";
import { DefenseReviewService } from "./defense-review.service";
@Module({
  imports: [Uc18FinalizationModule],
  controllers: [DefenseReviewController],
  providers: [
    DefenseReviewRepository,
    DefenseReviewService,
    ProposalReviewValidator,
    FinalReportValidator,
    SubmissionValidator,
    DefenseConfirmationValidator,
    DefenseConfirmationReadValidator,
    DefenseConfirmationProgressValidator,
  ],
})
export class DefenseReviewModule {}
