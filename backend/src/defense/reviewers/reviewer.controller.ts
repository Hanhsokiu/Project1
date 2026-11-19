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
  ReviewerAssignSchema,
  ReviewerFinalizeSchema,
  ReviewerProposalQuerySchema,
  ReviewerQuerySchema,
  ReviewerTermQuerySchema,
} from "@doan/shared";
import type {
  ReviewerAssign,
  ReviewerFinalize,
  ReviewerQuery,
} from "@doan/shared";
import { ReviewerService } from "./reviewer.service";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import { ReviewGroupExceptionFilter } from "../../topic/review-groups/review-group.errors";
import {
  committeeActor,
  CommitteeRequest,
} from "../committees/committee-workflow.controller";
const ok = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
const idPipe = () => new ReviewGroupPipe(z.string().trim().min(1).max(36));
@Controller("defense-reviewers")
@UseFilters(ReviewGroupExceptionFilter)
export class ReviewerController {
  constructor(
    @Inject(ReviewerService) private readonly service: ReviewerService,
  ) {}
  @Get("options")
  @RequirePermission("defense-reviewer", "read")
  options(@Req() r: CommitteeRequest) {
    return this.service.options(committeeActor(r)).then(ok);
  }
  @Get("workspace")
  @RequirePermission("defense-reviewer", "read")
  workspace(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ReviewerTermQuerySchema)) q: { termId: string },
  ) {
    return this.service.workspace(committeeActor(r), q.termId).then(ok);
  }
  @Get("allocation")
  @RequirePermission("defense-reviewer", "assign")
  allocation(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ReviewerProposalQuerySchema))
    q: { termId: string; termStudentIds?: string },
  ) {
    return this.service
      .propose(committeeActor(r), q.termId, q.termStudentIds)
      .then(ok);
  }
  @Get()
  @RequirePermission("defense-reviewer", "read")
  list(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ReviewerQuerySchema)) q: ReviewerQuery,
  ) {
    return this.service.list(committeeActor(r), q).then(ok);
  }
  @Post("assignments")
  @RequirePermission("defense-reviewer", "assign")
  assign(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ReviewerAssignSchema)) b: ReviewerAssign,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.assign(committeeActor(r), b, key).then(ok);
  }
  @Post("finalize")
  @RequirePermission("defense-reviewer", "finalize")
  finalize(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ReviewerFinalizeSchema)) b: ReviewerFinalize,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.finalize(committeeActor(r), b, key).then(ok);
  }
  @Get(":id")
  @RequirePermission("defense-reviewer", "read")
  detail(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Query(new ReviewGroupPipe(ReviewerTermQuerySchema)) q: { termId: string },
  ) {
    return this.service.detail(committeeActor(r), id, q.termId).then(ok);
  }
  @Post(":id/update")
  @RequirePermission("defense-reviewer", "update")
  update(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(ReviewerAssignSchema)) b: ReviewerAssign,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.assign(committeeActor(r), b, key, id).then(ok);
  }
}
