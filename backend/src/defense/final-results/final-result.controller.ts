import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
} from "@nestjs/common";
import {
  FinalResultCommandSchema,
  FinalResultQuerySchema,
  FinalResultScopeSchema,
} from "@doan/shared";
import type { FinalResultCommand, FinalResultQuery } from "@doan/shared";
import { z } from "zod";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import { ReviewGroupExceptionFilter } from "../../topic/review-groups/review-group.errors";
import {
  committeeActor,
  CommitteeRequest,
} from "../committees/committee-workflow.controller";
import { FinalResultService } from "./final-result.service";
const ok = <T>(data: T) => ({ success: true, data });
const idPipe = () => new ReviewGroupPipe(z.string().trim().min(1).max(36));
@Controller("defense-results")
@UseFilters(ReviewGroupExceptionFilter)
export class FinalResultController {
  constructor(
    @Inject(FinalResultService) private readonly service: FinalResultService,
  ) {}
  @Get("options")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-result", "read")
  options(@Req() r: CommitteeRequest) {
    return this.service.options(committeeActor(r)).then(ok);
  }
  @Get()
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-result", "read")
  list(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(FinalResultQuerySchema)) q: FinalResultQuery,
  ) {
    return this.service.list(committeeActor(r), q).then(ok);
  }
  @Get(":id")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-result", "read")
  detail(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Query(new ReviewGroupPipe(FinalResultScopeSchema)) q: { termId: string },
  ) {
    return this.service.detail(committeeActor(r), id, q.termId).then(ok);
  }
  @Post(":id/preview")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-result", "read")
  preview(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(FinalResultScopeSchema)) b: { termId: string },
  ) {
    return this.service.preview(committeeActor(r), id, b.termId).then(ok);
  }
  @Post(":id/confirm")
  @RequirePermission("defense-result", "confirm")
  confirm(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(FinalResultCommandSchema)) b: FinalResultCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .command(committeeActor(r), id, b, key, "confirm")
      .then(ok);
  }
  @Post(":id/finalize")
  @RequirePermission("defense-result", "finalize")
  finalize(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(FinalResultCommandSchema)) b: FinalResultCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .command(committeeActor(r), id, b, key, "finalize")
      .then(ok);
  }
  @Post(":id/publish")
  @RequirePermission("defense-result", "publish")
  publish(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(FinalResultCommandSchema)) b: FinalResultCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .command(committeeActor(r), id, b, key, "publish")
      .then(ok);
  }
}
