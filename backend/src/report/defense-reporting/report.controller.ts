import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
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
  ReportExportSchema,
  ReportFilterSchema,
  ReportPreviewSchema,
  ReportOptionsQuerySchema,
} from "@doan/shared";
import type { ReportExport, ReportFilter, ReportRequest } from "@doan/shared";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import { ReviewGroupExceptionFilter } from "../../topic/review-groups/review-group.errors";
import {
  committeeActor,
  CommitteeRequest,
} from "../../defense/committees/committee-workflow.controller";
import { ReportService } from "./report.service";
const ok = (data: unknown) => ({ success: true, data });
const idPipe = () => new ReviewGroupPipe(z.string().uuid());
@Controller("defense-reports")
@UseFilters(ReviewGroupExceptionFilter)
export class ReportController {
  constructor(@Inject(ReportService) private readonly service: ReportService) {}
  @Get("options")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-report", "read")
  options(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ReportOptionsQuerySchema))
    f: Partial<ReportFilter>,
  ) {
    return this.service.options(committeeActor(r), f).then(ok);
  }
  @Get("templates")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-report", "templates-read")
  templates(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ReportFilterSchema)) f: ReportFilter,
  ) {
    return this.service.templateList(committeeActor(r), f).then(ok);
  }
  @Get("statistics")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-report", "statistics")
  statistics(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ReportFilterSchema)) f: ReportFilter,
  ) {
    return this.service.statistics(committeeActor(r), f).then(ok);
  }
  @Post("exports/preview")
  @HttpCode(200)
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-report", "preview")
  preview(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ReportPreviewSchema)) b: ReportRequest,
  ) {
    return this.service.preview(committeeActor(r), b).then(ok);
  }
  @Post("exports")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-report", "export")
  create(
    @Req() r: CommitteeRequest,
    @Body(new ReviewGroupPipe(ReportExportSchema)) b: ReportExport,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.export(committeeActor(r), b, key).then(ok);
  }
  @Get("exports")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-report", "history-read")
  history(
    @Req() r: CommitteeRequest,
    @Query(new ReviewGroupPipe(ReportFilterSchema)) f: ReportFilter,
  ) {
    return this.service.history(committeeActor(r), f).then(ok);
  }
  @Get("exports/:id")
  @Header("Cache-Control", "no-store, private")
  @RequirePermission("defense-report", "history-read")
  detail(@Req() r: CommitteeRequest, @Param("id", idPipe()) id: string) {
    return this.service.detail(committeeActor(r), id).then(ok);
  }
  // POST because preparing an authenticated delivery has an audit/idempotency side effect.
  @Post("exports/:id/download")
  @HttpCode(200)
  @RequirePermission("defense-report", "download")
  async download(
    @Req() r: CommitteeRequest,
    @Param("id", idPipe()) id: string,
    @Body(new ReviewGroupPipe(z.object({}).strict())) _b: Record<string, never>,
    @Headers("idempotency-key") key: string,
    @Res() res: Response,
  ) {
    const file = await this.service.download(committeeActor(r), id, key);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", String(file.bytes.length));
    res.send(file.bytes);
  }
}
