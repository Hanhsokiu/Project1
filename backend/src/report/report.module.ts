import { Module } from "@nestjs/common";
import { ExportController } from "./controller/export.controller";
import { ExportService } from "./service/export.service";
import { GradingWorkflowModule } from "../grading/workflow/grading-workflow.module";
import { OfficialReportController } from "./official/official-report.controller";
import { OfficialReportService } from "./official/official-report.service";

@Module({
  imports: [GradingWorkflowModule],
  controllers: [ExportController, OfficialReportController],
  providers: [ExportService, OfficialReportService],
  exports: [ExportService],
})
export class ReportModule {}
