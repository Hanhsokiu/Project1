import { Module } from "@nestjs/common";
import { DossierController } from "./proposal-dossiers/dossier.controller";
import { DossierRepository } from "./proposal-dossiers/dossier.repository";
import { DossierService } from "./proposal-dossiers/dossier.service";
import { DossierValidator } from "./proposal-dossiers/dossier.validator";
import { DossierPdfService } from "./proposal-dossiers/dossier-pdf.service";
import { TopicController } from "./controller/topic.controller";
import { TopicService } from "./service/topic.service";
import { ReviewGroupController } from "./review-groups/review-group.controller";
import { ReviewGroupService } from "./review-groups/review-group.service";
import { ReviewGroupRepository } from "./review-groups/review-group.repository";
import { ReviewGroupValidator } from "./review-groups/review-group.validator";
import { ProposalReviewController } from "./proposal-reviews/proposal-review.controller";
import { ProposalReviewService } from "./proposal-reviews/proposal-review.service";
import { ProposalReviewRepository } from "./proposal-reviews/proposal-review.repository";
import { ProposalReviewValidator } from "./proposal-reviews/proposal-review.validator";
import { ProposalVersionController } from "./proposal-versions/proposal-version.controller";
import { ProposalVersionRepository } from "./proposal-versions/proposal-version.repository";
import { ProposalVersionValidator } from "./proposal-versions/proposal-version.validator";
import { ProposalVersionService } from "./proposal-versions/proposal-version.service";
import { ProposalLifecycleService } from "./proposal-versions/proposal-lifecycle.service";

import { TopicRepository } from "./repository/topic.repository";
import { ProposalPdfService } from "./service/proposal-pdf.service";
import { RegistrationModule } from "../registration/registration.module";
import { TermModule } from "../term/term.module";

@Module({
  imports: [RegistrationModule, TermModule],
  controllers: [
    TopicController,
    ReviewGroupController,
    ProposalReviewController,
    ProposalVersionController,
    DossierController,
  ],
  providers: [
    TopicService,
    TopicRepository,
    ProposalPdfService,
    ReviewGroupService,
    ReviewGroupRepository,
    ReviewGroupValidator,
    ProposalReviewService,
    ProposalReviewRepository,
    ProposalReviewValidator,
    ProposalVersionRepository,
    ProposalVersionValidator,
    ProposalVersionService,
    ProposalLifecycleService,
    DossierRepository,
    DossierService,
    DossierValidator,
    DossierPdfService,
  ],
  exports: [TopicService],
})
export class TopicModule {}
