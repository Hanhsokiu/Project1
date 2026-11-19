import { Module } from "@nestjs/common";
import {
  FinalDefenseController,
  FinalPdfInterceptor,
} from "./final-defense/final-defense.controller";
import { FinalDefenseService } from "./final-defense/final-defense.service";
import { FinalDefenseRepository } from "./final-defense/final-defense.repository";
import { FinalDefenseValidator } from "./final-defense/final-defense.validator";
import { WeeklyController } from "./weekly/weekly.controller";
import { WeeklyService } from "./weekly/weekly.service";
import { WeeklyRepository } from "./weekly/weekly.repository";
import { WeeklyNotificationWorker } from "./weekly/weekly-notification.worker";
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
  controllers: [
    FinalDefenseController,
    WeeklyController,
    TaskController,
    GuidanceController,
    SubmissionController,
    ProgressReviewController,
  ],
  providers: [
    FinalDefenseService,
    FinalDefenseRepository,
    FinalDefenseValidator,
    FinalPdfInterceptor,
    WeeklyService,
    WeeklyRepository,
    WeeklyNotificationWorker,
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
  exports: [TaskService],
})
export class GuidanceModule {}
