import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScoreService } from '../service/score.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@ApiTags('grading')
@Controller('scores')
export class ScoreController {
  constructor(private readonly scoreService: ScoreService) {}

  @Get('proposal/:proposalId')
  async getScores(@Param('proposalId') proposalId: string) {
    const res = await this.scoreService.getScoresByProposal(proposalId);
    return ApiResponse.ok(res);
  }
}
