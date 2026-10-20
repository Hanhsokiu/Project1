import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExportService } from '../service/export.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@ApiTags('report')
@Controller('reports')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('stats')
  async getStats() {
    const stats = await this.exportService.getGeneralStats();
    return ApiResponse.ok(stats);
  }
}
