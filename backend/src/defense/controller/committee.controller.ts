import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommitteeService } from '../service/committee.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@ApiTags('defense')
@Controller('committees')
export class CommitteeController {
  constructor(private readonly committeeService: CommitteeService) {}

  @Get('term/:termId')
  async getCommittees(@Param('termId') termId: string) {
    const list = await this.committeeService.findByTerm(termId);
    return ApiResponse.ok(list);
  }
}
