import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
} from "@nestjs/common";
import { z } from "zod";
import {
  EligibilityDecisionSchema,
  EligibilityDetailQuerySchema,
  EligibilityFinalizeSchema,
  EligibilityQuerySchema,
  EligibilityReviewSchema,
} from "@doan/shared";
import type {
  EligibilityDecision,
  EligibilityFinalize,
  EligibilityQuery,
  EligibilityReview,
} from "@doan/shared";
import { EligibilityService } from "./eligibility.service";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  groupError,
  ReviewGroupExceptionFilter,
} from "../../topic/review-groups/review-group.errors";

type Request = { user?: { sub?: string; userId?: string } };
function actor(r: Request) {
  const id = r.user?.sub ?? r.user?.userId;
  if (!id || (r.user?.sub && r.user.userId && r.user.sub !== r.user.userId))
    groupError(401, "AUTH_003", "Cần đăng nhập.");
  return id;
}
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
const idPipe = () => new ReviewGroupPipe(z.string().trim().min(1).max(36));
@UseFilters(ReviewGroupExceptionFilter)
@Controller("defense-eligibility")
export class EligibilityController {
  constructor(
    @Inject(EligibilityService) private readonly service: EligibilityService,
  ) {}
  @Get("options")
  @RequirePermission("defense-eligibility", "read")
  options(@Req() r: Request) {
    return this.service.options(actor(r)).then(success);
  }
  @Get()
  @RequirePermission("defense-eligibility", "read")
  list(
    @Req() r: Request,
    @Query(new ReviewGroupPipe(EligibilityQuerySchema)) q: EligibilityQuery,
  ) {
    return this.service.list(actor(r), q).then(success);
  }
  @Post("finalize")
  @RequirePermission("defense-eligibility", "finalize")
  finalize(
    @Req() r: Request,
    @Body(new ReviewGroupPipe(EligibilityFinalizeSchema))
    body: EligibilityFinalize,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.finalize(actor(r), body, key).then(success);
  }
  @Get(":termStudentId")
  @RequirePermission("defense-eligibility", "read")
  detail(
    @Req() r: Request,
    @Param("termStudentId", idPipe()) id: string,
    @Query(new ReviewGroupPipe(EligibilityDetailQuerySchema))
    q: { termId: string },
  ) {
    return this.service.detail(actor(r), id, q.termId).then(success);
  }
  @Post(":termStudentId/review")
  @RequirePermission("defense-eligibility", "review")
  review(
    @Req() r: Request,
    @Param("termStudentId", idPipe()) id: string,
    @Body(new ReviewGroupPipe(EligibilityReviewSchema)) body: EligibilityReview,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.reviewDossier(actor(r), id, body, key).then(success);
  }
  @Post(":termStudentId/decide")
  @RequirePermission("defense-eligibility", "decide")
  decide(
    @Req() r: Request,
    @Param("termStudentId", idPipe()) id: string,
    @Body(new ReviewGroupPipe(EligibilityDecisionSchema))
    body: EligibilityDecision,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.decide(actor(r), id, body, key).then(success);
  }
}
