import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  committeePreviewSchema,
  reviewerPreviewSchema,
  schedulePreviewSchema,
  planningTermSchema,
  type CommitteePreviewInput,
  type ReviewerPreviewInput,
  type SchedulePreviewInput,
} from "@doan/shared";
import { ApiResponse } from "../../common/dto/api-response.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { DefensePlanningService } from "./defense-planning.service";
const detailSchema = planningTermSchema
  .extend({ committeeId: z.string().trim().min(1).max(36) })
  .strict();

@ApiTags("defense-planning")
@ApiBearerAuth()
@Controller()
export class DefensePlanningController {
  constructor(
    @Inject(DefensePlanningService)
    private readonly service: DefensePlanningService,
  ) {}
  @Get("defense-planning/terms")
  @RequirePermission("defense-planning", "read")
  async terms(@CurrentUser() user: CurrentUserPayload) {
    return ApiResponse.ok(await this.service.terms(user.userId));
  }
  @Get("terms/:termId/defense-planning/context")
  @RequirePermission("defense-planning", "read")
  async context(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(planningTermSchema)) p: { termId: string },
  ) {
    return ApiResponse.ok(await this.service.context(user.userId, p.termId));
  }
  @Get("terms/:termId/defense-planning/committees")
  @RequirePermission("defense-planning", "read")
  async committees(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(planningTermSchema)) p: { termId: string },
  ) {
    return ApiResponse.ok(
      await this.service.records(user.userId, p.termId, "committees"),
    );
  }
  @Get("terms/:termId/defense-planning/committees/:committeeId")
  @RequirePermission("defense-planning", "read")
  async committee(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(detailSchema))
    p: { termId: string; committeeId: string },
  ) {
    return ApiResponse.ok(
      await this.service.records(
        user.userId,
        p.termId,
        "committees",
        p.committeeId,
      ),
    );
  }
  @Get("terms/:termId/defense-planning/reviewers")
  @RequirePermission("defense-planning", "read")
  async reviewers(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(planningTermSchema)) p: { termId: string },
  ) {
    return ApiResponse.ok(
      await this.service.records(user.userId, p.termId, "reviewers"),
    );
  }
  @Get("terms/:termId/defense-planning/schedule")
  @RequirePermission("defense-planning", "read")
  async schedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(planningTermSchema)) p: { termId: string },
  ) {
    return ApiResponse.ok(
      await this.service.records(user.userId, p.termId, "schedule"),
    );
  }
  @Post("terms/:termId/defense-planning/committees/preview")
  @HttpCode(200)
  @RequirePermission("defense-planning", "preview")
  @ApiOperation({
    summary: "Read-only UC19 preview, never persists a committee",
  })
  async previewCommittees(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(planningTermSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(committeePreviewSchema))
    body: CommitteePreviewInput,
  ) {
    return ApiResponse.ok(
      await this.service.preview(user.userId, p.termId, "COMMITTEES", body),
    );
  }
  @Post("terms/:termId/defense-planning/reviewers/preview")
  @HttpCode(200)
  @RequirePermission("defense-planning", "preview")
  @ApiOperation({
    summary:
      "Read-only UC20 proposal with current official advisor conflict checks",
  })
  async previewReviewers(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(planningTermSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(reviewerPreviewSchema))
    body: ReviewerPreviewInput,
  ) {
    return ApiResponse.ok(
      await this.service.preview(user.userId, p.termId, "REVIEWERS", body),
    );
  }
  @Post("terms/:termId/defense-planning/schedule/preview")
  @HttpCode(200)
  @RequirePermission("defense-planning", "preview")
  @ApiOperation({
    summary:
      "Read-only UC21 preview; detects local and cross-term recorded schedule conflicts",
  })
  async previewSchedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(planningTermSchema)) p: { termId: string },
    @Body(new ZodValidationPipe(schedulePreviewSchema))
    body: SchedulePreviewInput,
  ) {
    return ApiResponse.ok(
      await this.service.preview(user.userId, p.termId, "SCHEDULE", body),
    );
  }
}
