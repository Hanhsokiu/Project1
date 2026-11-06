import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalExceptionHandler } from "./global-exception.handler";

interface ErrorBody {
  success: boolean;
  data: null;
  error: {
    code: string;
    message: string;
    fields?: { path: string; message: string }[];
    details?: unknown;
  };
  message: string;
  path: string;
}

function render(exception: unknown) {
  let status = 0;
  let body: ErrorBody | undefined;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: "POST", url: "/api/students" }),
      getResponse: () => ({
        status: (value: number) => {
          status = value;
          return {
            json: (value: ErrorBody) => {
              body = value;
            },
          };
        },
      }),
    }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionHandler().catch(exception, host);
  return { status, body: body! };
}

afterEach(() => vi.restoreAllMocks());

describe("GlobalExceptionHandler public business error contract", () => {
  it("maps body-parser size errors to a redacted 413, not an internal error", () => {
    const error = Object.assign(new Error("private parser details"), {
      type: "entity.too.large",
      status: 413,
    });
    const result = render(error);
    expect(result.status).toBe(413);
    expect(result.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(JSON.stringify(result.body)).not.toContain("private parser details");
  });
  it("normalizes catalog fieldErrors and preserves valid existing field issues", () => {
    const { status, body } = render(
      new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: "Dữ liệu không hợp lệ",
          fields: [
            { path: "email", message: "Email không hợp lệ" },
            { path: "gpa", message: 123 },
          ],
          fieldErrors: {
            email: ["Email không hợp lệ"],
            gpa: ["GPA bắt buộc từ 0 đến 4"],
          },
        },
      }),
    );
    expect(status).toBe(400);
    expect(body.error).toEqual({
      code: "VALIDATION_FAILED",
      message: "Dữ liệu không hợp lệ",
      fields: [
        { path: "email", message: "Email không hợp lệ" },
        { path: "gpa", message: "GPA bắt buộc từ 0 đến 4" },
      ],
    });
    expect(body).toMatchObject({
      success: false,
      data: null,
      path: "/api/students",
    });
    expect(body.error).not.toHaveProperty("fieldErrors");
  });

  it("retains the deliberate import failure code and structured row-count details", () => {
    const { status, body } = render(
      new UnprocessableEntityException({
        error: {
          code: "IMPORT_HAS_ERRORS",
          message:
            "Chế độ STRICT yêu cầu sửa tất cả dòng lỗi trước khi xác nhận",
          details: { invalidRows: 2 },
        },
      }),
    );
    expect(status).toBe(422);
    expect(body.error).toEqual({
      code: "IMPORT_HAS_ERRORS",
      message: "Chế độ STRICT yêu cầu sửa tất cả dòng lỗi trước khi xác nhận",
      details: { invalidRows: 2 },
    });
    expect(body.error).not.toHaveProperty("fields");
  });

  it("redacts raw errors and HTTP 500 payloads while logging server-side diagnostics", () => {
    const log = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    const failures = [
      new Error(
        "postgresql://private-user:private-password@internal-db/database",
      ),
      new InternalServerErrorException({
        error: {
          code: "DATABASE_DEBUG",
          message: "SELECT password_hash FROM USER_ACCOUNT",
          fields: [{ path: "passwordHash", message: "internal value" }],
          details: { connectionString: "private database details" },
        },
      }),
    ];
    for (const failure of failures) {
      const { status, body } = render(failure);
      expect(status).toBe(500);
      expect(body.error).toEqual({
        code: "INTERNAL_ERROR",
        message: "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      });
      expect(JSON.stringify(body)).not.toMatch(
        /password|private|SELECT|DATABASE_DEBUG/,
      );
    }
    expect(log).toHaveBeenCalledTimes(2);
  });
});
