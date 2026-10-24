import {
  Controller,
  Get,
  Param,
  Req,
  Post,
  HttpCode,
  Query,
  UseFilters,
} from "@nestjs/common";
import { TaskSubmissionQuerySchema } from "@doan/shared";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../../topic/review-groups/review-group.errors";
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
}
