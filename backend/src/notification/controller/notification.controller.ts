import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { NotificationService } from "../service/notification.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { CurrentUser } from "../../common/security/current-user.decorator";
@ApiTags("notification")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationController {
  constructor(private readonly service: NotificationService) {}
  @Get("me")
  @RequirePermission("notification", "own")
  async own(@CurrentUser() u: { sub: string }) {
    return ApiResponse.ok(await this.service.getUserNotifications(u.sub));
  }
  @Patch("me/read")
  @RequirePermission("notification", "own")
  async readAll(@CurrentUser() u: { sub: string }) {
    return ApiResponse.ok(await this.service.read(u.sub));
  }
  @Patch(":id/read")
  @RequirePermission("notification", "own")
  async read(
    @CurrentUser() u: { sub: string },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return ApiResponse.ok(await this.service.read(u.sub, id));
  }
  @Get("outbox/term/:termId")
  @RequirePermission("assignment", "manage")
  async outbox(@Param("termId", ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.outbox(id));
  }
  @Post("outbox/:id/retry")
  @RequirePermission("assignment", "manage")
  async retry(@Param("id", ParseUUIDPipe) id: string) {
    return ApiResponse.ok(await this.service.retry(id));
  }
}
