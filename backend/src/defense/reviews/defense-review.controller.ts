import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ApiResponse } from "../../common/dto/api-response.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { DefenseReviewService } from "./defense-review.service";
import {
  previewQuerySchema,
  reviewQuerySchema,
  reviewTermSchema,
  type PreviewQuery,
  type ReviewQuery,
} from "./defense-review.dto";

@ApiTags("defense-review")
@ApiBearerAuth()
@Controller()
export class DefenseReviewController {
  constructor(
    @Inject(DefenseReviewService)
    private readonly service: DefenseReviewService,
  ) {}
  @Get("defense-confirmations/terms")
  @RequirePermission("defense-confirmation", "read")
  async terms(@CurrentUser() user: CurrentUserPayload) {
    return ApiResponse.ok(await this.service.terms(user.userId));
  }
  @Get("defense-confirmations/inbox")
  @RequirePermission("defense-confirmation", "read")
  async inbox(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(reviewQuerySchema)) query: ReviewQuery,
  ) {
    return ApiResponse.ok(await this.service.inbox(user.userId, query));
  }
  @Get("defense-lists/terms")
  @RequirePermission("defense-list", "read")
  async reviewTerms(@CurrentUser() user: CurrentUserPayload) {
    return ApiResponse.ok(await this.service.terms(user.userId, true));
  }
  @Get("terms/:termId/defense-list/preview")
  @RequirePermission("defense-list", "read")
  async preview(
    @CurrentUser() user: CurrentUserPayload,
    @Param(new ZodValidationPipe(reviewTermSchema)) params: { termId: string },
    @Query(new ZodValidationPipe(previewQuerySchema)) query: PreviewQuery,
  ) {
    return ApiResponse.ok(
      await this.service.preview(user.userId, params.termId, query),
    );
  }
}
