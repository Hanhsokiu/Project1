import { Injectable } from "@nestjs/common";
import { NotificationRepository } from "../repository/notification.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";

@Injectable()
export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly policy: ProposalReviewValidator,
  ) {}

  async getUserNotifications(userId: string, requestedUserId: string) {
    await this.active(userId);
    if (userId !== requestedUserId)
      groupError(404, "COMMON_001", "Không tìm thấy thông báo.");
    return this.repo.legacy(userId);
  }
  async list(userId: string, q: { page: number; limit: number }) {
    await this.active(userId);
    return this.repo.list(userId, q.page, q.limit);
  }
  async own(userId: string) {
    await this.active(userId);
    return this.repo.own(userId);
  }
  async readAll(userId: string) {
    await this.active(userId);
    return this.repo.readAll(userId);
  }
  outbox(termId: string) {
    return this.repo.outbox(termId);
  }
  retry(id: string) {
    return this.repo.retry(id);
  }
  private async active(userId: string) {
    this.policy.principal(await this.repo.principal(userId));
  }
  async read(userId: string, id: string) {
    await this.active(userId);
    const result = await this.repo.read(userId, id);
    if (!result) groupError(404, "COMMON_001", "Không tìm thấy thông báo.");
    return result;
  }
}
