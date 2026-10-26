import { Module } from "@nestjs/common";
import { NotificationController } from "./controller/notification.controller";
import { NotificationService } from "./service/notification.service";
import { NotificationRepository } from "./repository/notification.repository";
import { EmailWorkerService } from "./service/email-worker.service";

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository, EmailWorkerService],
  exports: [NotificationService],
})
export class NotificationModule {}
