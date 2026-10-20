import { Module } from '@nestjs/common';
import { ScoreController } from './controller/score.controller';
import { ScoreService } from './service/score.service';
import { ScoreAggregatorService } from './service/score-aggregator.service';

@Module({
  controllers: [ScoreController],
  providers: [ScoreService, ScoreAggregatorService],
  exports: [ScoreService, ScoreAggregatorService],
})
export class GradingModule {}
