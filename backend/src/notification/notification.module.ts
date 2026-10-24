import { Module } from "@nestjs/common";
import { NotificationRepository } from "./repository/notification.repository";
import { ProposalReviewValidator } from "../topic/proposal-reviews/proposal-review.validator";
import { NotificationController } from "./controller/notification.controller";
import { NotificationService } from "./service/notification.service";

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    ProposalReviewValidator,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
