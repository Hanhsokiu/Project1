import { Injectable } from "@nestjs/common";
import { NotificationRepository } from "../repository/notification.repository";
@Injectable()
export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}
  getUserNotifications(userId: string) {
    return this.repo.own(userId);
  }
  read(userId: string, id?: string) {
    return this.repo.read(userId, id);
  }
  outbox(termId: string) {
    return this.repo.list(termId);
  }
  retry(id: string) {
    return this.repo.retry(id);
  }
}
