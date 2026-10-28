import { Module } from "@nestjs/common";
import { ThesisTermController } from "./controller/thesis-term.controller";
import { TermLifecycleService } from "./service/term-lifecycle.service";
import { TermParameterService } from "./service/term-parameter.service";
import { TermTransitionValidator } from "./validator/term-transition.validator";
import { AcademicSemesterController } from "./controller/academic-semester.controller";
import { TermRepository } from "./repository/term.repository";
import { TermWindowService } from "./service/term-window.service";
import { FinalReportWindowController } from "./final-report-submission/final-report-window.controller";
import { FinalReportWindowService } from "./final-report-submission/final-report-window.service";
import { FinalReportWindowRepository } from "./final-report-submission/final-report-window.repository";
import { FinalReportWindowValidator } from "./final-report-submission/final-report-window.validator";
import { DefenseConfirmationWindowController } from "./defense-confirmation-window/defense-confirmation-window.controller";
import { DefenseConfirmationWindowService } from "./defense-confirmation-window/defense-confirmation-window.service";
import { DefenseConfirmationWindowRepository } from "./defense-confirmation-window/defense-confirmation-window.repository";
import { DefenseConfirmationWindowValidator } from "./defense-confirmation-window/defense-confirmation-window.validator";

@Module({
  controllers: [
    ThesisTermController,
    AcademicSemesterController,
    FinalReportWindowController,
    DefenseConfirmationWindowController,
  ],
  providers: [
    TermRepository,
    TermLifecycleService,
    TermParameterService,
    TermTransitionValidator,
    TermWindowService,
    FinalReportWindowService,
    FinalReportWindowRepository,
    FinalReportWindowValidator,
    DefenseConfirmationWindowService,
    DefenseConfirmationWindowRepository,
    DefenseConfirmationWindowValidator,
  ],
  exports: [
    TermLifecycleService,
    TermParameterService,
    TermWindowService,
    TermRepository,
  ],
})
export class TermModule {}
