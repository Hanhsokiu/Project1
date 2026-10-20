import { Module } from '@nestjs/common';
import { ThesisTermController } from './controller/thesis-term.controller';
import { TermLifecycleService } from './service/term-lifecycle.service';
import { TermParameterService } from './service/term-parameter.service';
import { TermTransitionValidator } from './validator/term-transition.validator';

@Module({
  controllers: [ThesisTermController],
  providers: [TermLifecycleService, TermParameterService, TermTransitionValidator],
  exports: [TermLifecycleService, TermParameterService],
})
export class TermModule {}
