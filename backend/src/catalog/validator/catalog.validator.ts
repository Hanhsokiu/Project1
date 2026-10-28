import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import type { CatalogQuery } from "../dto/catalog.dto";
export class CatalogInputValidator {
  static parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
    const result = schema.safeParse(value);
    if (!result.success)
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Dữ liệu không hợp lệ",
          fieldErrors: result.error.flatten().fieldErrors,
        },
      });
    return result.data;
  }
  static query(raw: Record<string, unknown>): CatalogQuery {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(10),
      search: z.string().max(200).optional(),
      termId: z.string().uuid().optional(),
      trainingSystemId: z.string().uuid().optional(),
      departmentId: z.string().uuid().optional(),
      researchAreaId: z.string().uuid().optional(),
      className: z.string().max(100).optional(),
      academicEligible: z
        .enum(["true", "false"])
        .transform((v) => v === "true")
        .optional(),
      isActive: z
        .enum(["true", "false"])
        .transform((v) => v === "true")
        .optional(),
    });
    return this.parse(schema, {
      ...raw,
      pageSize: raw.pageSize ?? raw.limit ?? 10,
    });
  }
  static exists<T>(
    record: T | null | undefined,
    message = "Không tìm thấy dữ liệu",
  ): asserts record is T {
    if (!record) throw new NotFoundException(message);
  }
  static duplicate(error: unknown): never {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new ConflictException("Mã hoặc email đã tồn tại");
    throw error;
  }
}
