import { Injectable } from "@nestjs/common";
import {
  NotificationRepository,
  NotificationOutboxSession,
} from "../repository/notification.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { academicTermScope } from "../../common/security/academic-term-scope.policy";
import { AuditService } from "../../common/audit/audit.service";

@Injectable()
export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly policy: ProposalReviewValidator,
    private readonly audit: AuditService,
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
  private async outboxActor(s: NotificationOutboxSession, userId: string) {
    const actor = this.policy.principal(await s.principal(userId));
    if (
      actor.id !== userId ||
      actor.mustChangePassword ||
      !actor.userRoles.some((r) =>
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === "assignment" &&
            p.permission.action === "manage",
        ),
      )
    )
      groupError(403, "AUTH_004", "Thiếu quyền quản lý outbox.");
    return actor;
  }
  private async outboxScope(
    s: NotificationOutboxSession,
    userId: string,
    termId: string,
  ) {
    await this.outboxActor(s, userId);
    const scope = academicTermScope(
      await s.grants(userId, termId),
      userId,
      termId,
    );
    // Each legacy message can aggregate students from multiple departments.
    // Department-only grants cannot authorize the whole message or term list.
    if (!scope.allDepartments)
      groupError(
        403,
        "OUTBOX_SCOPE_FORBIDDEN",
        "Outbox tổng hợp yêu cầu grant quản lý toàn đợt.",
      );
  }
  outbox(userId: string, termId: string) {
    return this.repo.outboxTransaction(async (s) => {
      await this.outboxScope(s, userId, termId);
      return s.listOutbox(termId);
    });
  }
  retry(userId: string, id: string) {
    return this.repo.outboxTransaction(async (s, tx) => {
      await this.outboxActor(s, userId);
      const locator = await s.record(id);
      if (!locator?.termId)
        groupError(404, "COMMON_001", "Không tìm thấy sự kiện email.");
      await s.lockTerm(locator.termId);
      await s.lockOutbox(id);
      const row = await s.record(id);
      if (!row || row.termId !== locator.termId)
        groupError(409, "COMMON_002", "Sự kiện email vừa thay đổi.");
      await this.outboxScope(s, userId, row.termId);
      const result = await s.retry(id, row.termId);
      await this.audit.log(
        {
          userId,
          action: "RETRY_EMAIL_OUTBOX",
          resource: "email-outbox",
          resourceId: id,
          oldValue: { status: row.status },
          newValue: { status: result.status, termId: row.termId },
        },
        tx,
      );
      return result;
    });
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
