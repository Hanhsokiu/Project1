import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

interface FieldIssue {
  path: string;
  message: string;
}

function normalizeFields(
  fields: unknown,
  fieldErrors: unknown,
): FieldIssue[] | undefined {
  const result: FieldIssue[] = [];
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (
        field &&
        typeof field === "object" &&
        typeof field.path === "string" &&
        typeof field.message === "string"
      )
        result.push({ path: field.path, message: field.message });
    }
  }
  if (
    fieldErrors &&
    typeof fieldErrors === "object" &&
    !Array.isArray(fieldErrors)
  ) {
    for (const [path, messages] of Object.entries(fieldErrors)) {
      if (!Array.isArray(messages)) continue;
      for (const message of messages) {
        if (
          typeof message === "string" &&
          !result.some(
            (field) => field.path === path && field.message === message,
          )
        ) {
          result.push({ path, message });
        }
      }
    }
  }
  return result.length ? result : undefined;
}

@Catch()
export class GlobalExceptionHandler implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionHandler.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const request = host
      .switchToHttp()
      .getRequest<{ method: string; url: string }>();
    const response = host.switchToHttp().getResponse<{
      status: (status: number) => { json: (body: unknown) => void };
    }>();
    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR",
      message = "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      fields: FieldIssue[] | undefined,
      details: unknown;
    // body-parser errors are ordinary Errors, not Nest HttpExceptions. Only
    // recognize the exact transport error; never trust arbitrary status fields.
    if (
      exception instanceof Error &&
      "type" in exception &&
      exception.type === "entity.too.large" &&
      "status" in exception &&
      exception.status === 413
    ) {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message =
        "Nội dung yêu cầu vượt dung lượng cho phép. Vui lòng giảm kích thước và thử lại.";
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        status = 409;
        code = "DUPLICATE";
        message = "Dữ liệu đã tồn tại.";
      } else if (exception.code === "P2025") {
        status = 404;
        code = "NOT_FOUND";
        message = "Không tìm thấy dữ liệu.";
      } else if (exception.code === "P2034") {
        status = 409;
        code = "CONCURRENT_UPDATE";
        message = "Dữ liệu vừa được thay đổi. Vui lòng tải lại và thử lại.";
      } else if (exception.code === "P2003") {
        status = 409;
        code = "REFERENCE_IN_USE";
        message = "Dữ liệu đang được tham chiếu hoặc liên kết không hợp lệ.";
      }
    }
    // Only intentional client/business errors may supply public metadata.
    // HTTP 500 exceptions are redacted just like unexpected internal errors.
    if (exception instanceof HttpException && status < 500) {
      const body = exception.getResponse() as
        | string
        | {
            error?:
              | string
              | {
                  code?: string;
                  message?: string;
                  fields?: unknown;
                  fieldErrors?: unknown;
                  details?: unknown;
                };
            message?: string | string[];
          };
      if (typeof body === "string") message = body;
      else {
        const error = typeof body.error === "object" ? body.error : undefined;
        message =
          error?.message ||
          (Array.isArray(body.message)
            ? body.message.join("; ")
            : body.message) ||
          exception.message;
        code =
          error?.code ||
          (
            {
              400: "VALIDATION_ERROR",
              401: "UNAUTHENTICATED",
              403: "FORBIDDEN",
              404: "NOT_FOUND",
              409: "CONFLICT",
              413: "FILE_TOO_LARGE",
            } as Record<number, string>
          )[status] ||
          "HTTP_ERROR";
        fields = normalizeFields(error?.fields, error?.fieldErrors);
        details = error?.details;
      }
    }
    if (status >= 500)
      this.logger.error(
        request.method + " " + request.url,
        exception instanceof Error ? exception.stack : undefined,
      );
    response.status(status).json({
      success: false,
      data: null,
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
        ...(details !== undefined ? { details } : {}),
      },
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
