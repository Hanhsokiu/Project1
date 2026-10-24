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
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  ProgressReviewCreateSchema,
  ProgressReviewAmendSchema,
  GuidanceMonitorQuerySchema,
  GuidanceMeetingCreateSchema,
  GuidanceMeetingAmendSchema,
  TaskSubmissionQuerySchema,
} from "@doan/shared";
import type {
  ProgressReviewCreate,
  ProgressReviewAmend,
  GuidanceMonitorQuery,
  GuidanceMeetingCreate,
  GuidanceMeetingAmend,
} from "@doan/shared";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../../topic/review-groups/review-group.errors";
import { ProgressReviewService } from "./progress-review.service";
type Request = { user: { sub?: string; userId?: string } };
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
const reviewBody = {
  type: "object" as const,
  additionalProperties: false,
  required: ["expectedTaskRevision", "expectedSubmissionRevision", "decision"],
  properties: {
    expectedTaskRevision: { type: "integer" as const, minimum: 0 },
    expectedSubmissionRevision: { type: "integer" as const, minimum: 0 },
    decision: {
      type: "string" as const,
      enum: ["PASS", "FAIL", "REVISION_REQUIRED"],
    },
    comment: { type: "string" as const, maxLength: 20000 },
  },
};
const meetingProperties = {
  occurredAt: { type: "string" as const, format: "date-time" },
  mode: { type: "string" as const, enum: ["IN_PERSON", "ONLINE"] },
  location: { type: "string" as const, nullable: true, maxLength: 1000 },
  discussion: { type: "string" as const, minLength: 1, maxLength: 20000 },
  conclusion: { type: "string" as const, minLength: 1, maxLength: 20000 },
};
@ApiTags("guidance-reviews-monitoring")
@ApiBearerAuth()
@UseFilters(ReviewGroupExceptionFilter)
@Controller()
export class ProgressReviewController {
  @Get("guidance-review-options/terms")
  @RequirePermission("guidance", "read")
  options(@Req() r: Request) {
    return this.service.options(this.user(r)).then(success);
  }
  constructor(private readonly service: ProgressReviewService) {}
  private user(r: Request) {
    const id = r.user?.sub ?? r.user?.userId;
    if (!id || (r.user.sub && r.user.userId && r.user.sub !== r.user.userId))
      groupError(401, "AUTH_003", "Không xác định được tài khoản.");
    return id;
  }
  @Get("task-submissions/:id/review-context")
  @RequirePermission("submission", "read")
  context(@Req() r: Request, @Param("id") id: string) {
    return this.service.context(this.user(r), id).then(success);
  }
  @Post("task-submissions/:id/reviews")
  @RequirePermission("task", "review")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({ schema: reviewBody })
  @ApiOperation({
    summary:
      "One effective three-way review of the exact current submission; FAIL/revision require comment",
  })
  record(
    @Req() r: Request,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(ProgressReviewCreateSchema))
    input: ProgressReviewCreate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.record(this.user(r), id, input, key).then(success);
  }
  @Post("task-reviews/:id/amendments")
  @RequirePermission("task", "review")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      ...reviewBody,
      required: [...reviewBody.required, "expectedReviewRevision", "reason"],
      properties: {
        ...reviewBody.properties,
        expectedReviewRevision: { type: "integer", minimum: 0 },
        reason: { type: "string", minLength: 1, maxLength: 2000 },
      },
    },
  })
  amend(
    @Req() r: Request,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(ProgressReviewAmendSchema))
    input: ProgressReviewAmend,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.amend(this.user(r), id, input, key).then(success);
  }
  @Get("terms/:termId/progress-review-inbox")
  @RequirePermission("task", "review")
  inbox(
    @Req() r: Request,
    @Param("termId") termId: string,
    @Query(new ReviewGroupPipe(GuidanceMonitorQuerySchema))
    q: GuidanceMonitorQuery,
  ) {
    return this.service.inbox(this.user(r), termId, q).then(success);
  }
  @Get("terms/:termId/guidance-dashboard")
  @RequirePermission("guidance", "monitor")
  dashboard(
    @Req() r: Request,
    @Param("termId") termId: string,
    @Query(new ReviewGroupPipe(GuidanceMonitorQuerySchema))
    q: GuidanceMonitorQuery,
  ) {
    return this.service.dashboard(this.user(r), termId, q).then(success);
  }
  @Get("guidance-plans/:id/meetings")
  @RequirePermission("guidance", "read")
  meetings(
    @Req() r: Request,
    @Param("id") id: string,
    @Query(new ReviewGroupPipe(TaskSubmissionQuerySchema))
    q: { page: number; limit: number },
  ) {
    return this.service.meetings(this.user(r), id, q).then(success);
  }
  @Post("guidance-plans/:id/meetings")
  @RequirePermission("guidance", "manage")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "expectedPlanRevision",
        "occurredAt",
        "mode",
        "discussion",
        "conclusion",
      ],
      properties: {
        ...meetingProperties,
        expectedPlanRevision: { type: "integer", minimum: 0 },
      },
    },
  })
  createMeeting(
    @Req() r: Request,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(GuidanceMeetingCreateSchema))
    input: GuidanceMeetingCreate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .meetingCommand(this.user(r), id, input, key)
      .then(success);
  }
  @Patch("guidance-meetings/:id")
  @RequirePermission("guidance", "manage")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["expectedRevision", "reason"],
      properties: {
        ...meetingProperties,
        expectedRevision: { type: "integer", minimum: 0 },
        reason: { type: "string", minLength: 1, maxLength: 2000 },
      },
    },
  })
  amendMeeting(
    @Req() r: Request,
    @Param("id") id: string,
    @Body(new ReviewGroupPipe(GuidanceMeetingAmendSchema))
    input: GuidanceMeetingAmend,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .amendMeeting(this.user(r), id, input, key)
      .then(success);
  }
}
