import {
  Controller,
  Get,
  Param,
  Req,
  Post,
  HttpCode,
  Query,
  UseFilters,
  Patch,
  ParseUUIDPipe,
} from "@nestjs/common";
import { TaskSubmissionQuerySchema } from "@doan/shared";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../../topic/review-groups/review-group.errors";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { CurrentUser } from "../../common/security/current-user.decorator";
import { ApiTags } from "@nestjs/swagger";
import { NotificationService } from "../service/notification.service";
import { ApiResponse } from "../../common/dto/api-response.dto";

@ApiTags("notification")
@UseFilters(ReviewGroupExceptionFilter)
@Controller()
export class NotificationController {
  constructor(private readonly notifService: NotificationService) {}

  private user(r: { user: { sub?: string; userId?: string } }) {
    const id = r.user?.sub ?? r.user?.userId;
    if (!id || (r.user.sub && r.user.userId && r.user.sub !== r.user.userId))
      groupError(401, "AUTH_003", "Không xác định được tài khoản.");
    return id;
  }
  @Get("notifications/user/:userId")
  async getNotifications(
    @Req() r: { user: { sub?: string; userId?: string } },
    @Param("userId") userId: string,
  ) {
    const list = await this.notifService.getUserNotifications(
      this.user(r),
      userId,
    );
    return ApiResponse.ok(list);
  }
  @Get("me/notifications")
  async list(
    @Req() r: { user: { sub?: string; userId?: string } },
    @Query(new ReviewGroupPipe(TaskSubmissionQuerySchema))
    q: { page: number; limit: number },
  ) {
    return ApiResponse.ok(await this.notifService.list(this.user(r), q));
  }
  @Post("me/notifications/:id/read")
  @HttpCode(200)
  async read(
    @Req() r: { user: { sub?: string; userId?: string } },
    @Param("id") id: string,
  ) {
    return ApiResponse.ok(await this.notifService.read(this.user(r), id));
  }
  @Get("notifications/me")
  @RequirePermission("notification", "own")
  async own(@CurrentUser() u: { sub: string }) {
    return ApiResponse.ok(await this.notifService.own(u.sub));
  }
  @Patch("notifications/me/read")
  @RequirePermission("notification", "own")
  async readAll(@CurrentUser() u: { sub: string }) {
    return ApiResponse.ok(await this.notifService.readAll(u.sub));
  }
  @Patch("notifications/:id/read")
  @RequirePermission("notification", "own")
  async readOwn(
    @CurrentUser() u: { sub: string },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.notifService.read(u.sub, id);
    return ApiResponse.ok({ updated: 1 });
  }
  @Get("notifications/outbox/term/:termId")
  @RequirePermission("assignment", "manage")
  async outbox(@Param("termId", ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.notifService.outbox(id));
  }
  @Post("notifications/outbox/:id/retry")
  @RequirePermission("assignment", "manage")
  async retry(@Param("id", ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.notifService.retry(id));
  }
}
