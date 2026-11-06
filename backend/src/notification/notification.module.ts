import { Module } from "@nestjs/common";
import { NotificationController } from "./controller/notification.controller";
import { NotificationService } from "./service/notification.service";
import { NotificationRepository } from "./repository/notification.repository";
import { EmailWorkerService } from "./service/email-worker.service";
import { ProposalReviewValidator } from "../topic/proposal-reviews/proposal-review.validator";

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    EmailWorkerService,
    ProposalReviewValidator,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
