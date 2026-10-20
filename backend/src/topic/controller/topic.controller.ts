import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TopicService } from '../service/topic.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@ApiTags('topic')
@Controller('topics')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Get('term/:termId')
  async getByTerm(@Param('termId') termId: string) {
    const list = await this.topicService.findByTerm(termId);
    return ApiResponse.ok(list);
  }
}
