import { Controller, Get, Param, Req, UseFilters } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TaskService } from "../service/task.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../../topic/review-groups/review-group.errors";

@ApiTags("guidance")
@Controller("tasks")
@UseFilters(ReviewGroupExceptionFilter)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get("plan/:planId")
  @RequirePermission("guidance", "read")
  async getTasks(
    @Param("planId") planId: string,
    @Req() req: { user: { sub?: string; userId?: string } },
  ) {
    const userId = req.user?.sub ?? req.user?.userId;
    if (
      !userId ||
      (req.user.sub && req.user.userId && req.user.sub !== req.user.userId)
    )
      groupError(401, "AUTH_003", "Không xác định được tài khoản.");
    const list = await this.taskService.findByPlan(userId, planId);
    return ApiResponse.ok(list);
  }
}
