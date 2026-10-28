import { Module } from "@nestjs/common";
import { Uc18FinalizationModule } from "../../common/uc18-finalization/uc18-finalization.module";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../final-reports/final-report.validator";
import { SubmissionValidator } from "../submissions/submission.validator";
import { DefenseConfirmationContextService } from "./defense-confirmation-context.service";
import { DefenseConfirmationRepository } from "./defense-confirmation.repository";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import { DefenseConfirmationProgressValidator } from "./defense-confirmation-progress.validator";
import { DefenseConfirmationController } from "./defense-confirmation.controller";
import { DefenseConfirmationCommandService } from "./defense-confirmation-command.service";
import { DefenseConfirmationCommandRepository } from "./defense-confirmation-command.repository";
import { DefenseConfirmationCommandValidator } from "./defense-confirmation-command.validator";
import { DefenseConfirmationReadController } from "./defense-confirmation-read.controller";
import { DefenseConfirmationReadService } from "./defense-confirmation-read.service";
import { DefenseConfirmationReadValidator } from "./defense-confirmation-read.validator";
import { DefenseConfirmationReportController } from "./defense-confirmation-report.controller";
import { DefenseConfirmationReportService } from "./defense-confirmation-report.service";
import { DefenseConfirmationReportRepository } from "./defense-confirmation-report.repository";
import { DefenseConfirmationReportValidator } from "./defense-confirmation-report.validator";

@Module({
  imports: [Uc18FinalizationModule],
  controllers: [
    DefenseConfirmationController,
    DefenseConfirmationReadController,
    DefenseConfirmationReportController,
  ],
  providers: [
    DefenseConfirmationReportService,
    DefenseConfirmationReportRepository,
    DefenseConfirmationReportValidator,
    DefenseConfirmationReadService,
    DefenseConfirmationReadValidator,
    DefenseConfirmationCommandService,
    DefenseConfirmationCommandRepository,
    DefenseConfirmationCommandValidator,
    DefenseConfirmationContextService,
    DefenseConfirmationRepository,
    DefenseConfirmationValidator,
    DefenseConfirmationProgressValidator,
    ProposalReviewValidator,
    FinalReportValidator,
    SubmissionValidator,
  ],
  exports: [DefenseConfirmationContextService, DefenseConfirmationValidator],
})
export class DefenseConfirmationModule {}
