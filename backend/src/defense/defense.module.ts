import { Module } from "@nestjs/common";
import { FinalResultController } from "./final-results/final-result.controller";
import { FinalResultService } from "./final-results/final-result.service";
import { FinalResultRepository } from "./final-results/final-result.repository";
import { FinalResultSources } from "./final-results/final-result.sources";
import { AdvisorGradeReader } from "./final-results/advisor-grade.reader";
import { CommitteeGradeController } from "./committee-grading/committee-grade.controller";
import { CommitteeGradeService } from "./committee-grading/committee-grade.service";
import { CommitteeGradeRepository } from "./committee-grading/committee-grade.repository";
import { CommitteeGradeValidator } from "./committee-grading/committee-grade.validator";
import { ReviewerGradeController } from "./reviewer-grading/reviewer-grade.controller";
import { ReviewerGradeService } from "./reviewer-grading/reviewer-grade.service";
import { ReviewerGradeRepository } from "./reviewer-grading/reviewer-grade.repository";
import { ReviewerGradeValidator } from "./reviewer-grading/reviewer-grade.validator";
import { ScheduleController } from "./scheduling/schedule.controller";
import { ScheduleService } from "./scheduling/schedule.service";
import { ScheduleRepository } from "./scheduling/schedule.repository";
import { ScheduleValidator } from "./scheduling/schedule.validator";
import { ReviewerController } from "./reviewers/reviewer.controller";
import { ReviewerService } from "./reviewers/reviewer.service";
import { ReviewerRepository } from "./reviewers/reviewer.repository";
import { ReviewerValidator } from "./reviewers/reviewer.validator";
import { CommitteeWorkflowController } from "./committees/committee-workflow.controller";
import { CommitteeWorkflowService } from "./committees/committee-workflow.service";
import { CommitteeRepository } from "./committees/committee.repository";
import { CommitteeValidator } from "./committees/committee.validator";
import { CommitteeController } from "./controller/committee.controller";
import { CommitteeService } from "./service/committee.service";
import { EligibilityController } from "./eligibility/eligibility.controller";
import { EligibilityService } from "./eligibility/eligibility.service";
import { EligibilityRepository } from "./eligibility/eligibility.repository";
import { EligibilityValidator } from "./eligibility/eligibility.validator";
import { ProposalReviewValidator } from "../topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../guidance/tasks/guidance.validator";
import { FinalDefenseValidator } from "../guidance/final-defense/final-defense.validator";

@Module({
  controllers: [
    FinalResultController,
    CommitteeGradeController,
    ReviewerGradeController,
    ScheduleController,
    ReviewerController,
    CommitteeController,
    EligibilityController,
    CommitteeWorkflowController,
  ],
  providers: [
    FinalResultService,
    FinalResultRepository,
    FinalResultSources,
    AdvisorGradeReader,
    CommitteeGradeService,
    CommitteeGradeRepository,
    CommitteeGradeValidator,
    ReviewerGradeService,
    ReviewerGradeRepository,
    ReviewerGradeValidator,
    ScheduleService,
    ScheduleRepository,
    ScheduleValidator,
    ReviewerService,
    ReviewerRepository,
    ReviewerValidator,
    CommitteeWorkflowService,
    CommitteeRepository,
    CommitteeValidator,
    CommitteeService,
    EligibilityService,
    EligibilityRepository,
    EligibilityValidator,
    ProposalReviewValidator,
    GuidanceValidator,
    FinalDefenseValidator,
  ],
  exports: [
    CommitteeGradeValidator,
    AdvisorGradeReader,
    EligibilityService,
    FinalResultService,
    CommitteeGradeService,
    ReviewerGradeService,
    CommitteeService,
    CommitteeWorkflowService,
    ReviewerService,
    ScheduleService,
  ],
})
export class DefenseModule {}
