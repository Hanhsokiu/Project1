import { Module } from "@nestjs/common";
import { TopicController } from "./controller/topic.controller";
import { TopicService } from "./service/topic.service";
import { TopicRepository } from "./repository/topic.repository";
import { ProposalPdfService } from "./service/proposal-pdf.service";
import { RegistrationModule } from "../registration/registration.module";
import { TermModule } from "../term/term.module";

@Module({
  imports: [RegistrationModule, TermModule],
  controllers: [TopicController],
  providers: [TopicService, TopicRepository, ProposalPdfService],
  exports: [TopicService],
})
export class TopicModule {}
