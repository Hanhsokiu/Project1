import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Headers,
  Inject,
  Injectable,
  NestInterceptor,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import {
  AdvisorConfirmationSchema,
  AdvisorSummarySchema,
  FinalDefenseQuerySchema,
  FinalPdfUploadSchema,
} from "@doan/shared";
import type {
  AdvisorConfirmation,
  AdvisorSummary,
  FinalDefenseQuery,
} from "@doan/shared";
import { FinalDefenseService } from "./final-defense.service";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  groupError,
  ReviewGroupExceptionFilter,
} from "../../topic/review-groups/review-group.errors";
import { z } from "zod";

type Request = {
  user: { sub?: string; userId?: string };
  params: { proposalId: string };
};
const idPipe = () => new ReviewGroupPipe(z.string().trim().min(1).max(36));
function actor(r: Request) {
  const id = r.user?.sub ?? r.user?.userId;
  if (!id || (r.user?.sub && r.user?.userId && r.user.sub !== r.user.userId))
    groupError(401, "AUTH_003", "Cần đăng nhập.");
  return id;
}
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
@Injectable()
export class FinalPdfInterceptor implements NestInterceptor {
  constructor(
    @Inject(FinalDefenseService) private readonly service: FinalDefenseService,
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();
    // Authorization and policy before buffering; repeated under lock before persistence.
    const policy = await this.service.preflight(
      actor(req),
      req.params.proposalId,
    );
    const interceptor = new (FileInterceptor("file", {
      storage: memoryStorage(),
      preservePath: true,
      limits: {
        files: 1,
        fields: 1,
        parts: 3,
        fileSize: policy.maxPdfBytes,
        fieldSize: 100,
      },
    }))();
    return interceptor.intercept(context, next);
  }
}
// JWT and PermissionsGuard are the existing application's APP_GUARDs.
@UseFilters(ReviewGroupExceptionFilter)
@Controller()
export class FinalDefenseController {
  constructor(
    @Inject(FinalDefenseService) private readonly service: FinalDefenseService,
  ) {}
  @Get("final-defense/options")
  @RequirePermission("defense-confirmation", "read")
  options(@Req() r: Request) {
    return this.service.options(actor(r)).then(success);
  }
  @Get("final-defense")
  @RequirePermission("defense-confirmation", "read")
  list(
    @Req() r: Request,
    @Query(new ReviewGroupPipe(FinalDefenseQuerySchema))
    query: FinalDefenseQuery,
  ) {
    return this.service.list(actor(r), query).then(success);
  }
  @Get("proposals/:proposalId/final-report")
  @RequirePermission("defense-confirmation", "read")
  detail(@Req() r: Request, @Param("proposalId", idPipe()) id: string) {
    return this.service.detail(actor(r), id).then(success);
  }
  @Post("proposals/:proposalId/final-report/pdf")
  @RequirePermission("final-report", "create")
  @UseInterceptors(FinalPdfInterceptor)
  upload(
    @Req() r: Request,
    @Param("proposalId", idPipe()) id: string,
    @Body(new ReviewGroupPipe(FinalPdfUploadSchema))
    body: { expectedRevision: number },
    @UploadedFile() file: Express.Multer.File,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service
      .upload(actor(r), id, body.expectedRevision, file, key)
      .then(success);
  }
  @Post("proposals/:proposalId/final-report/review")
  @RequirePermission("defense-confirmation", "review")
  review(
    @Req() r: Request,
    @Param("proposalId", idPipe()) id: string,
    @Body(new ReviewGroupPipe(AdvisorSummarySchema)) body: AdvisorSummary,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.summarize(actor(r), id, body, key).then(success);
  }
  @Post("proposals/:proposalId/final-report/decide")
  @RequirePermission("defense-confirmation", "decide")
  decide(
    @Req() r: Request,
    @Param("proposalId", idPipe()) id: string,
    @Body(new ReviewGroupPipe(AdvisorConfirmationSchema))
    body: AdvisorConfirmation,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.confirm(actor(r), id, body, key).then(success);
  }
  @Get("proposals/:proposalId/final-report/versions/:versionId/pdf")
  @RequirePermission("final-report", "download")
  async download(
    @Req() r: Request,
    @Param("proposalId", idPipe()) id: string,
    @Param("versionId", idPipe()) versionId: string,
    @Res() response: Response,
  ) {
    const { bytes, name } = await this.service.download(
      actor(r),
      id,
      versionId,
    );
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="final-report.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(bytes);
  }
}
