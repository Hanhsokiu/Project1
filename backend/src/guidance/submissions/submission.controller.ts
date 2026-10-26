import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Headers,
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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { catchError } from "rxjs/operators";
import type { Response } from "express";
import {
  SubmissionFileKindSchema,
  TaskSubmissionCreateSchema,
  TaskSubmissionQuerySchema,
} from "@doan/shared";
import type { TaskSubmissionCreate } from "@doan/shared";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ReviewGroupPipe } from "../../topic/review-groups/review-group.dto";
import {
  ReviewGroupExceptionFilter,
  groupError,
} from "../../topic/review-groups/review-group.errors";
import { SubmissionService } from "./submission.service";
type Request = {
  user: { sub?: string; userId?: string };
  params: { taskId: string };
};
function identity(r: Request) {
  const id = r.user?.sub ?? r.user?.userId;
  if (!id || (r.user.sub && r.user.userId && r.user.sub !== r.user.userId))
    groupError(401, "AUTH_003", "Không xác định được tài khoản.");
  return id;
}
const success = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});
@Injectable()
export class SubmissionUploadInterceptor implements NestInterceptor {
  constructor(private readonly service: SubmissionService) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const r = context.switchToHttp().getRequest<Request>();
    // Relation check before allocating multipart buffers, and again in service transaction.
    const p = await this.service.preflight(identity(r), r.params.taskId);
    const interceptor = new (FileInterceptor("file", {
      storage: memoryStorage(),
      preservePath: true,
      limits: {
        fileSize: p.maxFileBytes,
        files: 1,
        fields: 1,
          parts: 3,
        fieldSize: 100,
      },
    }))();
    try {
      const stream = await interceptor.intercept(context, next);
      return stream.pipe(
        catchError((e: unknown) => {
          if (
            e &&
            typeof e === "object" &&
            "getStatus" in e &&
            (e as { getStatus: () => number }).getStatus() === 413
          )
            groupError(413, "FILE_TOO_LARGE", "File vượt dung lượng cấu hình.");
          throw e;
        }),
      );
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "getStatus" in e &&
        (e as { getStatus: () => number }).getStatus() === 413
      )
        groupError(413, "FILE_TOO_LARGE", "File vượt dung lượng cấu hình.");
      groupError(
        400,
        "FILE_TYPE_INVALID",
        "Multipart không hợp lệ; cần một file và kind.",
      );
    }
  }
}
@ApiTags("guidance-submissions")
@ApiBearerAuth()
@UseFilters(ReviewGroupExceptionFilter)
@Controller()
export class SubmissionController {
  constructor(private readonly service: SubmissionService) {}
  @Get("tasks/:taskId/submission-context")
  @RequirePermission("submission", "read")
  context(@Req() r: Request, @Param("taskId") id: string) {
    return this.service.context(identity(r), id).then(success);
  }
  @Post("tasks/:taskId/submission-uploads")
  @RequirePermission("submission", "create")
  @UseInterceptors(SubmissionUploadInterceptor)
  @ApiConsumes("multipart/form-data")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["kind", "file"],
      properties: {
        kind: { type: "string", enum: ["REPORT", "SOURCE", "EVIDENCE"] },
        file: { type: "string", format: "binary" },
      },
    },
  })
  upload(
    @Req() r: Request,
    @Param("taskId") id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File,
    @Headers("idempotency-key") key: string,
  ) {
    const kind = SubmissionFileKindSchema.safeParse(body?.kind);
    if (!kind.success || !file || Object.keys(body).some((k) => k !== "kind"))
      groupError(
        400,
        "FILE_TYPE_INVALID",
        "Cần một file với phân loại hợp lệ.",
      );
    return this.service
      .stage(identity(r), id, kind.data, file, key)
      .then(success);
  }
  @Post("tasks/:taskId/submissions")
  @RequirePermission("submission", "create")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary:
      "Commit own READY files atomically; append immutable submission version; late accepted while phase open",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["expectedTaskRevision", "uploadIds"],
      additionalProperties: false,
      properties: {
        expectedTaskRevision: { type: "integer", minimum: 0 },
        uploadIds: {
          type: "array",
          items: { type: "string", format: "uuid" },
          minItems: 2,
          maxItems: 12,
          uniqueItems: true,
        },
        content: { type: "string", maxLength: 20000 },
      },
    },
  })
  submit(
    @Req() r: Request,
    @Param("taskId") id: string,
    @Body(new ReviewGroupPipe(TaskSubmissionCreateSchema))
    body: TaskSubmissionCreate,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.submit(identity(r), id, body, key).then(success);
  }
  @Get("tasks/:taskId/submissions")
  @RequirePermission("submission", "read")
  list(
    @Req() r: Request,
    @Param("taskId") id: string,
    @Query(new ReviewGroupPipe(TaskSubmissionQuerySchema))
    q: { page: number; limit: number },
  ) {
    return this.service.list(identity(r), id, q).then(success);
  }
  @Get("task-submissions/:submissionId")
  @RequirePermission("submission", "read")
  detail(@Req() r: Request, @Param("submissionId") id: string) {
    return this.service.detail(identity(r), id).then(success);
  }
  @Get("task-submissions/:submissionId/files/:fileId/download")
  @RequirePermission("submission", "download")
  @ApiOperation({
    summary:
      "Private attachment; scope checked against current parent, never accepts storage path",
  })
  async download(
    @Req() r: Request,
    @Param("submissionId") id: string,
    @Param("fileId") fileId: string,
    @Res() response: Response,
  ) {
    const file = await this.service.download(identity(r), id, fileId);
    response.set({
      "Content-Type": "application/octet-stream",
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    response.send(file.bytes);
  }
}
