import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('grading')
@Controller('scores')
export class ScoreController {
  @Get('proposal/:proposalId')
  @ApiForbiddenResponse({ description: 'Chức năng đọc điểm chưa được mở.' })
  getScores(): never {
    // Keep this legacy route closed until the score-reading policy is approved.
    // Authentication still runs through the existing global guards first.
    throw new ForbiddenException({
      error: {
        code: 'SCORE_READING_NOT_ENABLED',
        message: 'Chức năng đọc điểm chưa được mở.',
      },
    });
  }
}
