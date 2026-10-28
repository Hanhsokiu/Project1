import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import {
  OfficialReportService,
  officialReportQuerySchema,
  officialReportSummaryQuerySchema,
  type ReportRequest,
} from "./official-report.service";
const params = z.object({ termId: z.string().trim().min(1).max(36) }).strict();
@ApiTags("official-reports")
@ApiBearerAuth()
@Controller("terms/:termId/official-reports")
export class OfficialReportController {
  constructor(
    @Inject(OfficialReportService)
    private readonly service: OfficialReportService,
  ) {}
  @Get("summary")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("official-report", "read")
  async summary(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(params)) p: { termId: string },
    @Query(new ZodValidationPipe(officialReportSummaryQuerySchema))
    q: z.infer<typeof officialReportSummaryQuerySchema>,
  ) {
    return ApiResponse.ok(await this.service.summary(u.userId, p.termId, q));
  }
  @Get("export")
  @RequirePermission("official-report", "export")
  async export(
    @CurrentUser() u: CurrentUserPayload,
    @Param(new ZodValidationPipe(params)) p: { termId: string },
    @Query(new ZodValidationPipe(officialReportQuerySchema)) q: ReportRequest,
    @Res() res: Response,
  ) {
    const f = await this.service.export(u.userId, p.termId, q);
    res.set({
      "Content-Type": f.contentType,
      "Content-Length": String(f.bytes.length),
      "Content-Disposition": `attachment; filename="official-report.${q.format.toLowerCase()}"; filename*=UTF-8''${encodeURIComponent(f.name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.send(f.bytes);
  }
}
