import { Module } from "@nestjs/common";
import { ThesisTermController } from "./controller/thesis-term.controller";
import { TermLifecycleService } from "./service/term-lifecycle.service";
import { TermParameterService } from "./service/term-parameter.service";
import { TermTransitionValidator } from "./validator/term-transition.validator";
import { AcademicSemesterController } from "./controller/academic-semester.controller";
import { TermRepository } from "./repository/term.repository";
import { TermWindowService } from "./service/term-window.service";

@Module({
  controllers: [ThesisTermController, AcademicSemesterController],
  providers: [
    TermRepository,
    TermLifecycleService,
    TermParameterService,
    TermTransitionValidator,
    TermWindowService,
  ],
  exports: [
    TermLifecycleService,
    TermParameterService,
    TermWindowService,
    TermRepository,
  ],
})
export class TermModule {}
