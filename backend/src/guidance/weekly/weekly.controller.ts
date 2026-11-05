import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  WeeklyPlanCreateSchema,
  WeeklyPlanUpdateSchema,
  WeeklyPlanStateSchema,
  WeeklyQuerySchema,
} from "@doan/shared";
import type {
  WeeklyPlanCreate,
  WeeklyPlanUpdate,
  WeeklyPlanState,
  WeeklyQuery,
} from "@doan/shared";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../../topic/review-groups/review-group.errors";
import { WeeklyService } from "./weekly.service";
type Request = { user: { sub?: string; userId?: string } };
const identity = (r: Request) => {
  const id = r.user?.sub ?? r.user?.userId;
  if (!id || (r.user.sub && r.user.userId && r.user.sub !== r.user.userId))
    groupError(401, "AUTH_003", "Không xác định được tài khoản.");
  return id;
};
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
@ApiTags("weekly-progress")
@ApiBearerAuth()
@UseFilters(ReviewGroupExceptionFilter)
@Controller()
export class WeeklyController {
  constructor(private readonly service: WeeklyService) {}
  @Get("weekly-plans/options")
  @RequirePermission("guidance", "read")
  options(@Req() r: Request) {
    return this.service.options(identity(r)).then(success);
  }
  @Get("terms/:termId/weekly-plans")
  @RequirePermission("guidance", "read")
  list(@Req() r: Request, @Param("termId") termId: string) {
    return this.service.list(identity(r), termId).then(success);
  }
  @Post("terms/:termId/weekly-plans")
  @RequirePermission("guidance", "monitor")
  create(
    @Req() r: Request,
    @Param("termId") termId: string,
    @Body(new ReviewGroupPipe(WeeklyPlanCreateSchema)) input: WeeklyPlanCreate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.command(identity(r), termId, input, key).then(success);
  }
  @Patch("terms/:termId/weekly-plans/:id")
  @RequirePermission("guidance", "monitor")
  update(
    @Req() r: Request,
    @Param("termId") termId: string,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(WeeklyPlanUpdateSchema)) input: WeeklyPlanUpdate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .command(identity(r), termId, input, key, id)
      .then(success);
  }
  @Post("terms/:termId/weekly-plans/:id/state")
  @RequirePermission("guidance", "monitor")
  state(
    @Req() r: Request,
    @Param("termId") termId: string,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(WeeklyPlanStateSchema)) input: WeeklyPlanState,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .command(identity(r), termId, input, key, id, true)
      .then(success);
  }
  @Get("terms/:termId/weekly-plans/:id/history")
  @RequirePermission("guidance", "monitor")
  history(
    @Req() r: Request,
    @Param("termId") termId: string,
    @Param("id") id: string,
  ) {
    return this.service.history(identity(r), termId, id).then(success);
  }
  @Get("terms/:termId/weekly-progress")
  @RequirePermission("guidance", "read")
  summary(
    @Req() r: Request,
    @Param("termId") termId: string,
    @Query(new ReviewGroupPipe(WeeklyQuerySchema)) query: WeeklyQuery,
  ) {
    return this.service.summary(identity(r), termId, query).then(success);
  }
}
