import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NestInterceptor,
  Param,
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { FinalReportService } from "./final-report.service";
import {
  FinalReportAction,
  finalReportIdSchema,
  finalReportMultipartSchema,
  reportError,
} from "./final-report.dto";

export type ReportRequest = {
  user?: {
    sub?: string;
    userId?: string;
    locked?: boolean;
    mustChangePassword?: boolean;
    roles?: string[];
    permissions?: string[];
  };
  params: { proposalId: string };
};
export function reportIdentity(req: ReportRequest, action: FinalReportAction) {
  const u = req.user,
    id = u?.sub ?? u?.userId;
  if (!id || (u?.sub && u.userId && u.sub !== u.userId))
    reportError(401, "AUTH_003", "Không xác định được tài khoản.");
  // JWT guard verifies account status/session; service re-reads the principal.
  if (
    u!.locked !== false ||
    u!.mustChangePassword !== false ||
    !u!.roles?.includes("STUDENT") ||
    !u!.permissions?.includes(`submission:${action}`)
  )
    reportError(
      403,
      "FINAL_REPORT_FORBIDDEN",
      "Tài khoản không có quyền với PDF cuối.",
    );
  return id;
}

@Injectable()
export class FinalReportUploadInterceptor implements NestInterceptor {
  constructor(private readonly service: FinalReportService) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<ReportRequest>();
    const proposalId = new ZodValidationPipe(finalReportIdSchema).transform(
      req.params.proposalId,
    );
    const policy = await this.service.preflight(
      reportIdentity(req, "create"),
      proposalId,
    );
    const interceptor = new (FileInterceptor("file", {
      storage: memoryStorage(),
      preservePath: true,
      // Busboy reports partsLimit at the boundary; allow the closing boundary
      // while files/fields and the strict DTO still enforce exactly two inputs.
      limits: {
        fileSize: policy.maxFileBytes,
        files: 1,
        fields: 1,
        parts: 3,
        fieldSize: 32,
      },
    }))();
    return interceptor.intercept(context, next);
  }
}

@ApiTags("final-reports")
@ApiBearerAuth()
@Controller("proposals/:proposalId")
export class FinalReportController {
  constructor(private readonly service: FinalReportService) {}
  @Get("final-report-context")
  @RequirePermission("submission", "read")
  async context(
    @Req() req: ReportRequest,
    @Param("proposalId", new ZodValidationPipe(finalReportIdSchema)) id: string,
  ) {
    return ApiResponse.ok(
      await this.service.context(reportIdentity(req, "read"), id),
    );
  }
  @Get("final-report")
  @RequirePermission("submission", "read")
  async detail(
    @Req() req: ReportRequest,
    @Param("proposalId", new ZodValidationPipe(finalReportIdSchema)) id: string,
  ) {
    return ApiResponse.ok(
      await this.service.detail(reportIdentity(req, "read"), id),
    );
  }
  @Put("final-report")
  @RequirePermission("submission", "create")
  @UseInterceptors(FinalReportUploadInterceptor)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Submit/replace own PDF before the independent window closes; no version history or UC17 changes",
  })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["file", "expectedRevision"],
      properties: {
        file: { type: "string", format: "binary" },
        expectedRevision: { type: "integer", minimum: 0, maximum: 2147483646 },
      },
    },
  })
  async put(
    @Req() req: ReportRequest,
    @Param("proposalId", new ZodValidationPipe(finalReportIdSchema)) id: string,
    @Body(new ZodValidationPipe(finalReportMultipartSchema))
    input: { expectedRevision: number },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return ApiResponse.ok(
      await this.service.put(
        reportIdentity(req, "create"),
        id,
        input.expectedRevision,
        file,
      ),
    );
  }
  @Get("final-report/download")
  @RequirePermission("submission", "download")
  @ApiProduces("application/pdf")
  async download(
    @Req() req: ReportRequest,
    @Param("proposalId", new ZodValidationPipe(finalReportIdSchema)) id: string,
    @Res() response: Response,
  ) {
    const file = await this.service.download(
      reportIdentity(req, "download"),
      id,
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
