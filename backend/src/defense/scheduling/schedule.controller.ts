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
  ScheduleBatchSchema,
  ScheduleCommandSchema,
  SchedulePreviewSchema,
  ScheduleProposalQuerySchema,
  ScheduleQuerySchema,
  ScheduleSaveSchema,
  ScheduleTermQuerySchema,
} from "@doan/shared";
import type {
  ScheduleBatch,
  ScheduleCommand,
  ScheduleQuery,
  ScheduleSave,
} from "@doan/shared";
import { ScheduleService } from "./schedule.service";
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
  }),
  idPipe = () => new ReviewGroupPipe(z.string().trim().min(1).max(36));
@Controller("defense-schedules")
@UseFilters(ReviewGroupExceptionFilter)
export class ScheduleController {
  constructor(
    @Inject(ScheduleService) private readonly service: ScheduleService,
  ) {}
  @Get("options") @RequirePermission("defense-schedule", "read") options(
    @Req() r: CommitteeRequest,
  ) {
    return this.service.options(committeeActor(r)).then(ok);
  }
  @Get("workspace") @RequirePermission("defense-schedule", "read") workspace(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ScheduleTermQuerySchema)) q: { termId: string },
  ) {
    return this.service.workspace(committeeActor(r), q.termId).then(ok);
  }
  @Get("proposal") @RequirePermission("defense-schedule", "create") propose(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ScheduleProposalQuerySchema))
    q: { termId: string; committeeIds?: string },
  ) {
    return this.service
      .propose(committeeActor(r), q.termId, q.committeeIds)
      .then(ok);
  }
  @Get() @RequirePermission("defense-schedule", "read") list(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ScheduleQuerySchema)) q: ScheduleQuery,
  ) {
    return this.service.list(committeeActor(r), q).then(ok);
  }
  @Post("preview") @RequirePermission("defense-schedule", "read") preview(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(SchedulePreviewSchema))
    b: { sessionId: string | null; body: ScheduleSave },
  ) {
    return this.service
      .preview(committeeActor(r), b.sessionId, b.body)
      .then(ok);
  }
  @Post() @RequirePermission("defense-schedule", "create") create(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ScheduleSaveSchema)) b: ScheduleSave,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.save(committeeActor(r), null, b, key).then(ok);
  }
  @Post("assignments") @RequirePermission("defense-schedule", "create") assign(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ScheduleBatchSchema)) b: ScheduleBatch,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.saveBatch(committeeActor(r), b, key).then(ok);
  }
  @Post("finalize") @RequirePermission("defense-schedule", "finalize") finalize(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ScheduleCommandSchema)) b: ScheduleCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .transition(committeeActor(r), b, key, "finalize")
      .then(ok);
  }
  @Post("publish") @RequirePermission("defense-schedule", "publish") publish(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ScheduleCommandSchema)) b: ScheduleCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .transition(committeeActor(r), b, key, "publish")
      .then(ok);
  }
  @Post("cancel") @RequirePermission("defense-schedule", "update") cancel(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ScheduleCommandSchema)) b: ScheduleCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .transition(committeeActor(r), b, key, "cancel")
      .then(ok);
  }
  @Get(":id") @RequirePermission("defense-schedule", "read") detail(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Query(new ReviewGroupPipe(ScheduleTermQuerySchema)) q: { termId: string },
  ) {
    return this.service.detail(committeeActor(r), id, q.termId).then(ok);
  }
  @Post(":id/update") @RequirePermission("defense-schedule", "update") update(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(ScheduleSaveSchema)) b: ScheduleSave,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.save(committeeActor(r), id, b, key).then(ok);
  }
}
