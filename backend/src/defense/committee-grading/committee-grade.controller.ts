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
  Res,
  UseFilters,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import {
  CommitteeGradeCommandSchema,
  CommitteeGradeQuerySchema,
  CommitteeGradeTermQuerySchema,
} from "@doan/shared";
import type { CommitteeGradeCommand, CommitteeGradeQuery } from "@doan/shared";
import { CommitteeGradeService } from "./committee-grade.service";
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
@Controller("defense-committee-grades")
@UseFilters(ReviewGroupExceptionFilter)
export class CommitteeGradeController {
  constructor(
    @Inject(CommitteeGradeService)
    private readonly service: CommitteeGradeService,
  ) {}
  @Get("options")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-committee-grade", "read")
  options(@Req() r: CommitteeRequest) {
    return this.service.options(committeeActor(r)).then(ok);
  }
  @Get("progress")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-committee-grade", "progress-read")
  progress(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(CommitteeGradeQuerySchema))
    q: CommitteeGradeQuery,
  ) {
    return this.service.progress(committeeActor(r), q).then(ok);
  }
  @Get()
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-committee-grade", "read")
  list(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(CommitteeGradeQuerySchema))
    q: CommitteeGradeQuery,
  ) {
    return this.service.list(committeeActor(r), q).then(ok);
  }
  @Get(":id")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-committee-grade", "read")
  detail(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Query(new ReviewGroupPipe(CommitteeGradeTermQuerySchema))
    q: { termId: string; committeeId: string; lecturerId?: string },
  ) {
    return this.service
      .detail(committeeActor(r), id, q.termId, q.committeeId, q.lecturerId)
      .then(ok);
  }
  @Post(":id/save")
  @RequirePermission("defense-committee-grade", "save-own")
  save(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(CommitteeGradeCommandSchema))
    b: CommitteeGradeCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.command(committeeActor(r), id, b, key, "save").then(ok);
  }
  @Post(":id/finalize")
  @RequirePermission("defense-committee-grade", "finalize-own")
  finalize(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(CommitteeGradeCommandSchema))
    b: CommitteeGradeCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .command(committeeActor(r), id, b, key, "finalize")
      .then(ok);
  }
  @Get(":id/versions/:versionId/pdf")
  @RequirePermission("defense-committee-grade", "download-own")
  async download(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Param("versionId", idPipe()) version: string,
    @Query(
      new ReviewGroupPipe(
        z
          .object({
            termId: z.string().min(1).max(36),
            committeeId: z.string().min(1).max(36),
          })
          .strict(),
      ),
    )
    q: { termId: string; committeeId: string },
    @Res() res: Response,
  ) {
    const { bytes, name } = await this.service.download(
      committeeActor(r),
      id,
      q.termId,
      q.committeeId,
      version,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="committee-report.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(bytes);
  }
}
