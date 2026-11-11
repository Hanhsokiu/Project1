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
  CommitteeAssignSchema,
  CommitteeFinalizeSchema,
  CommitteeProposalQuerySchema,
  CommitteeQuerySchema,
  CommitteeSaveSchema,
  CommitteeTermQuerySchema,
  CommitteeUnassignSchema,
} from "@doan/shared";
import type {
  CommitteeAssign,
  CommitteeFinalize,
  CommitteeQuery,
  CommitteeSave,
  CommitteeUnassign,
} from "@doan/shared";
import { CommitteeWorkflowService } from "./committee-workflow.service";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../../topic/review-groups/review-group.errors";
export type CommitteeRequest = { user?: { sub?: string; userId?: string } };
export function committeeActor(r: CommitteeRequest) {
  const id = r.user?.sub ?? r.user?.userId;
  if (!id || (r.user?.sub && r.user.userId && r.user.sub !== r.user.userId))
    groupError(401, "AUTH_003", "Cần đăng nhập.");
  return id;
}
const ok = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
const idPipe = () => new ReviewGroupPipe(z.string().trim().min(1).max(36));
@Controller("defense-committees")
@UseFilters(ReviewGroupExceptionFilter)
export class CommitteeWorkflowController {
  constructor(
    @Inject(CommitteeWorkflowService)
    private readonly service: CommitteeWorkflowService,
  ) {}
  @Get("options")
  @RequirePermission("defense-committee", "read")
  options(@Req() r: CommitteeRequest) {
    return this.service.options(committeeActor(r)).then(ok);
  }
  @Get("workspace")
  @RequirePermission("defense-committee", "read")
  workspace(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(CommitteeTermQuerySchema)) q: { termId: string },
  ) {
    return this.service.workspace(committeeActor(r), q.termId).then(ok);
  }
  @Get("allocation")
  @RequirePermission("defense-committee", "assign")
  propose(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(CommitteeProposalQuerySchema))
    q: { termId: string; termStudentIds?: string },
  ) {
    return this.service
      .propose(committeeActor(r), q.termId, q.termStudentIds)
      .then(ok);
  }
  @Get()
  @RequirePermission("defense-committee", "read")
  list(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(CommitteeQuerySchema)) q: CommitteeQuery,
  ) {
    return this.service.list(committeeActor(r), q).then(ok);
  }
  @Post()
  @RequirePermission("defense-committee", "create")
  create(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(CommitteeSaveSchema)) b: CommitteeSave,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.save(committeeActor(r), null, b, key).then(ok);
  }
  @Post("assignments")
  @RequirePermission("defense-committee", "assign")
  assign(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(CommitteeAssignSchema)) b: CommitteeAssign,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.assign(committeeActor(r), b, key).then(ok);
  }
  @Get(":id")
  @RequirePermission("defense-committee", "read")
  detail(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Query(new ReviewGroupPipe(CommitteeTermQuerySchema)) q: { termId: string },
  ) {
    return this.service.detail(committeeActor(r), id, q.termId).then(ok);
  }
  @Post(":id/update")
  @RequirePermission("defense-committee", "update")
  update(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(CommitteeSaveSchema)) b: CommitteeSave,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.save(committeeActor(r), id, b, key).then(ok);
  }
  @Post(":id/unassign")
  @RequirePermission("defense-committee", "assign")
  unassign(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(CommitteeUnassignSchema)) b: CommitteeUnassign,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.unassign(committeeActor(r), id, b, key).then(ok);
  }
  @Post(":id/finalize")
  @RequirePermission("defense-committee", "finalize")
  finalize(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(CommitteeFinalizeSchema)) b: CommitteeFinalize,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.finalize(committeeActor(r), id, b, key).then(ok);
  }
}
