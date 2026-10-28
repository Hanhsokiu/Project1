import { Module } from "@nestjs/common";
import { Uc18FinalizationModule } from "../../common/uc18-finalization/uc18-finalization.module";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import {
  AdvisorGradeReader,
  CouncilResultConfirmationReader,
  UnknownAdvisorGradeReader,
  UnknownCouncilResultConfirmationReader,
} from "./advisor-grade.port";
import { GradingController } from "./grading.controller";
import { GradingRepository } from "./grading.repository";
import { GradingService } from "./grading.service";
import { GradingSourceReader } from "./grading-source.reader";
@Module({
  imports: [Uc18FinalizationModule],
  controllers: [GradingController],
  providers: [
    GradingRepository,
    GradingService,
    GradingSourceReader,
    DefenseConfirmationValidator,
    ProposalReviewValidator,
    FinalReportValidator,
    SubmissionValidator,
    { provide: AdvisorGradeReader, useClass: UnknownAdvisorGradeReader },
    {
      provide: CouncilResultConfirmationReader,
      useClass: UnknownCouncilResultConfirmationReader,
    },
  ],
  exports: [GradingRepository, GradingService, GradingSourceReader],
})
export class GradingWorkflowModule {}
