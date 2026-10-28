import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('defense')
@Controller('committees')
export class CommitteeController {
  @Get('term/:termId')
  @ApiForbiddenResponse({ description: 'Chức năng đọc hội đồng chưa được mở.' })
  getCommittees(): never {
    // Keep this legacy reader closed until the UC19 access policy is approved.
    // The existing global authentication guards still run before this handler.
    throw new ForbiddenException({
      error: {
        code: 'COMMITTEE_READING_NOT_ENABLED',
        message: 'Chức năng đọc hội đồng chưa được mở.',
      },
    });
  }
}
