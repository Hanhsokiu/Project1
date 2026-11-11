import {
  Body,
  Controller,
  Get,
  Headers,
  Header,
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
  ReviewerGradeCommandSchema,
  ReviewerGradeQuerySchema,
  ReviewerGradeTermQuerySchema,
} from "@doan/shared";
import type { ReviewerGradeCommand, ReviewerGradeQuery } from "@doan/shared";
import { ReviewerGradeService } from "./reviewer-grade.service";
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
@Controller("defense-reviewer-grades")
@UseFilters(ReviewGroupExceptionFilter)
export class ReviewerGradeController {
  constructor(
    @Inject(ReviewerGradeService)
    private readonly service: ReviewerGradeService,
  ) {}
  @Get("options")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-reviewer-grade", "read")
  options(@Req() r: CommitteeRequest) {
    return this.service.options(committeeActor(r)).then(ok);
  }
  @Get()
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-reviewer-grade", "read")
  list(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ReviewerGradeQuerySchema)) q: ReviewerGradeQuery,
  ) {
    return this.service.list(committeeActor(r), q).then(ok);
  }
  @Get(":id")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-reviewer-grade", "read")
  detail(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Query(new ReviewGroupPipe(ReviewerGradeTermQuerySchema))
    q: { termId: string; reviewerId?: string },
  ) {
    return this.service
      .detail(committeeActor(r), id, q.termId, q.reviewerId)
      .then(ok);
  }
  @Post(":id/save")
  @RequirePermission("defense-reviewer-grade", "save")
  save(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(ReviewerGradeCommandSchema))
    b: ReviewerGradeCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.command(committeeActor(r), id, b, key, "save").then(ok);
  }
  @Post(":id/finalize")
  @RequirePermission("defense-reviewer-grade", "finalize")
  finalize(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(ReviewerGradeCommandSchema))
    b: ReviewerGradeCommand,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .command(committeeActor(r), id, b, key, "finalize")
      .then(ok);
  }
  @Get(":id/versions/:versionId/pdf")
  @RequirePermission("defense-reviewer-grade", "download")
  async download(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Param("versionId", idPipe()) version: string,
    @Query(
      new ReviewGroupPipe(
        z.object({ termId: z.string().trim().min(1).max(36) }).strict(),
      ),
    )
    q: { termId: string },
    @Res() res: Response,
  ) {
    const { bytes, name } = await this.service.download(
      committeeActor(r),
      id,
      q.termId,
      version,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="review-report.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(bytes);
  }
}
