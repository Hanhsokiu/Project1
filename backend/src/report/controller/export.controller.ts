import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('report')
@Controller('reports')
export class ExportController {
  @Get('stats')
  @ApiForbiddenResponse({
    description: 'Chức năng thống kê toàn hệ thống chưa được mở.',
  })
  getStats(): never {
    // Keep the legacy global reader closed until its scope policy is approved.
    // Existing global authentication guards still run before this handler.
    throw new ForbiddenException({
      error: {
        code: 'REPORT_STATS_NOT_ENABLED',
        message: 'Chức năng thống kê toàn hệ thống chưa được mở.',
      },
    });
  }
}
