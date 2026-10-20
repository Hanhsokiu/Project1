import { Module } from '@nestjs/common';
import { CommitteeController } from './controller/committee.controller';
import { CommitteeService } from './service/committee.service';

@Module({
  controllers: [CommitteeController],
  providers: [CommitteeService],
  exports: [CommitteeService],
})
export class DefenseModule {}
