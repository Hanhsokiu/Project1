import { Module } from "@nestjs/common";
import { FinalReportModule } from "./final-reports/final-report.module";
import { DefenseConfirmationModule } from "./defense-confirmations/defense-confirmation.module";
import { ProgressReviewController } from "./reviews/progress-review.controller";
import { ProgressReviewService } from "./reviews/progress-review.service";
import { ProgressRepository } from "./reviews/progress-review.repository";
import { ProgressReviewValidator } from "./reviews/progress-review.validator";
import {
  SubmissionController,
  SubmissionUploadInterceptor,
} from "./submissions/submission.controller";
import { SubmissionService } from "./submissions/submission.service";
import { SubmissionRepository } from "./submissions/submission.repository";
import { SubmissionValidator } from "./submissions/submission.validator";
import { TaskController } from "./controller/task.controller";
import { TaskService } from "./service/task.service";
import { GuidanceController } from "./tasks/guidance.controller";
import { GuidanceService } from "./tasks/guidance.service";
import { GuidanceRepository } from "./tasks/guidance.repository";
import { GuidanceValidator } from "./tasks/guidance.validator";
import { ProposalReviewValidator } from "../topic/proposal-reviews/proposal-review.validator";

@Module({
  imports: [FinalReportModule, DefenseConfirmationModule],
  controllers: [
    TaskController,
    GuidanceController,
    SubmissionController,
    ProgressReviewController,
  ],
  providers: [
    ProgressReviewService,
    ProgressRepository,
    ProgressReviewValidator,
    SubmissionService,
    SubmissionRepository,
    SubmissionValidator,
    SubmissionUploadInterceptor,
    TaskService,
    GuidanceService,
    GuidanceRepository,
    GuidanceValidator,
    ProposalReviewValidator,
  ],
  exports: [TaskService, DefenseConfirmationModule],
})
export class GuidanceModule {}
