import { Module } from '@nestjs/common';
import { ExportController } from './controller/export.controller';
import { ExportService } from './service/export.service';
import { DefenseModule } from '../defense/defense.module';
import { ReportController } from './defense-reporting/report.controller';
import { ReportService } from './defense-reporting/report.service';
import { ReportRepository } from './defense-reporting/report.repository';
import { ReportReader } from './defense-reporting/report.reader';
import { ReportRenderer } from './defense-reporting/report-renderer';
import { ReportTemplates } from './defense-reporting/report-templates';
import { ProposalReviewValidator } from '../topic/proposal-reviews/proposal-review.validator';
import { GuidanceValidator } from '../guidance/tasks/guidance.validator';
import { DossierValidator } from '../topic/proposal-dossiers/dossier.validator';
import { DossierPdfService } from '../topic/proposal-dossiers/dossier-pdf.service';

@Module({
  imports: [DefenseModule],
  controllers: [ExportController, ReportController],
  providers: [ExportService, ReportService, ReportRepository, ReportReader, ReportRenderer, ReportTemplates, ProposalReviewValidator, GuidanceValidator, DossierValidator, DossierPdfService],
  exports: [ExportService],
})
export class ReportModule {}
