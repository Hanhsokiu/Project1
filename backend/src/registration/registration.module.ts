import { Module } from '@nestjs/common';
import { RegistrationController } from './controller/registration.controller';
import { RegistrationService } from './service/registration.service';
import { AssignmentPlanService } from './service/assignment-plan.service';

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService, AssignmentPlanService],
  exports: [RegistrationService, AssignmentPlanService],
})
export class RegistrationModule {}
