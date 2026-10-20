import { Module } from '@nestjs/common';
import { ExportController } from './controller/export.controller';
import { ExportService } from './service/export.service';

@Module({
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ReportModule {}
