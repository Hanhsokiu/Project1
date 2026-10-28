import { Module } from "@nestjs/common";
import {
  FinalReportController,
  FinalReportUploadInterceptor,
} from "./final-report.controller";
import { FinalReportService } from "./final-report.service";
import { FinalReportRepository } from "./final-report.repository";
import { FinalReportValidator } from "./final-report.validator";
import { SubmissionValidator } from "../submissions/submission.validator";

@Module({
  controllers: [FinalReportController],
  providers: [
    FinalReportService,
    FinalReportRepository,
    FinalReportValidator,
    SubmissionValidator,
    FinalReportUploadInterceptor,
  ],
})
export class FinalReportModule {}
