import { Injectable } from "@nestjs/common";
import { NotificationRepository } from "../repository/notification.repository";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { groupError } from "../../topic/review-groups/review-group.errors";

@Injectable()
export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly policy: ProposalReviewValidator,
  ) {}

  async getUserNotifications(userId: string, requestedUserId: string) {
    this.policy.principal(await this.repo.principal(userId));
    if (userId !== requestedUserId)
      groupError(404, "COMMON_001", "Không tìm thấy thông báo.");
    return this.repo.legacy(userId);
  }
  async list(userId: string, q: { page: number; limit: number }) {
    this.policy.principal(await this.repo.principal(userId));
    return this.repo.list(userId, q.page, q.limit);
  }
  async read(userId: string, id: string) {
    this.policy.principal(await this.repo.principal(userId));
    const result = await this.repo.read(userId, id);
    if (!result) groupError(404, "COMMON_001", "Không tìm thấy thông báo.");
    return result;
  }
}
