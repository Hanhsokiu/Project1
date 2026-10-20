import { Module } from '@nestjs/common';
import { TopicController } from './controller/topic.controller';
import { TopicService } from './service/topic.service';

@Module({
  controllers: [TopicController],
  providers: [TopicService],
  exports: [TopicService],
})
export class TopicModule {}
