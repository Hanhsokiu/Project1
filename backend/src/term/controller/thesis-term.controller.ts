import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TermLifecycleService } from '../service/term-lifecycle.service';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { RequirePermission } from '../../common/security/require-permission.decorator';

@ApiTags('term')
@ApiBearerAuth()
@Controller('terms')
export class ThesisTermController {
  constructor(private readonly termService: TermLifecycleService) {}

  @Get()
  @RequirePermission('term', 'read')
  @ApiOperation({ summary: 'UC07: Danh sách đợt đồ án' })
  async getTerms() {
    const terms = await this.termService.findAll();
    return ApiResponse.ok(terms);
  }

  @Get(':id')
  @RequirePermission('term', 'read')
  @ApiOperation({ summary: 'Chi tiết đợt đồ án' })
  async getTermDetail(@Param('id') id: string) {
    const term = await this.termService.findById(id);
    return ApiResponse.ok(term);
  }
}
