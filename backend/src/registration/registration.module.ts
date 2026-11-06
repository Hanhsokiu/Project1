import { Module } from "@nestjs/common";
import { RegistrationController } from "./controller/registration.controller";
import { RegistrationService } from "./service/registration.service";
import { RegistrationRepository } from "./repository/registration.repository";
import { TermModule } from "../term/term.module";
import { AssignmentController } from "./controller/assignment.controller";
import { AssignmentRepository } from "./repository/assignment.repository";
import { AssignmentPlanService } from "./service/assignment-plan.service";
import { AssignmentSchedulerService } from "./service/assignment-scheduler.service";

@Module({
  imports: [TermModule],
  controllers: [RegistrationController, AssignmentController],
  providers: [
    RegistrationService,
    RegistrationRepository,
    AssignmentRepository,
    AssignmentPlanService,
    AssignmentSchedulerService,
  ],
  exports: [RegistrationService, AssignmentRepository],
})
export class RegistrationModule {}
