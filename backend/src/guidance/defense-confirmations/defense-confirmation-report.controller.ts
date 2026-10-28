import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/security/current-user.decorator";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import {
  defenseConfirmationParamsSchema,
  type DefenseConfirmationParams,
} from "./defense-confirmation.dto";
import {
  defenseConfirmationReportQuerySchema,
  type DefenseConfirmationReportIdentity,
} from "./defense-confirmation-report.dto";
import { DefenseConfirmationReportService } from "./defense-confirmation-report.service";

@ApiTags("defense-confirmation")
@ApiBearerAuth()
@Controller("proposals/:proposalId/defense-confirmation/report")
export class DefenseConfirmationReportController {
  constructor(
    @Inject(DefenseConfirmationReportService)
    private readonly service: DefenseConfirmationReportService,
  ) {}

  @Get("download")
  @RequirePermission("defense-confirmation", "read")
  @ApiProduces("application/pdf")
  @ApiOperation({
    summary:
      "Current official advisor: verified private PDF matching context.expectedContext.pdf; 409 if replaced",
  })
  @ApiQuery({ name: "finalReportId", required: true, type: String })
  @ApiQuery({ name: "revision", required: true, type: Number })
  @ApiQuery({ name: "checksum", required: true, type: String })
  async download(
    @Param(new ZodValidationPipe(defenseConfirmationParamsSchema))
    params: DefenseConfirmationParams,
    @Query(new ZodValidationPipe(defenseConfirmationReportQuerySchema))
    query: DefenseConfirmationReportIdentity,
    @CurrentUser() user: CurrentUserPayload,
    @Res() response: Response,
  ) {
    const file = await this.service.download(
      user.userId,
      params.proposalId,
      query,
    );
    response.set({
      "Content-Type": "application/pdf",
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `attachment; filename="final-report.pdf"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    response.send(file.bytes);
  }
}
