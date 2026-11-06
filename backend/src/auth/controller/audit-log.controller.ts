import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { RequirePermission } from "../../common/security/require-permission.decorator";
import { ApiResponse } from "../../common/dto/api-response.dto";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("audit", "read")
  async list(
    @Query(new ZodValidationPipe(querySchema))
    query: z.infer<typeof querySchema>,
  ) {
    const take = query.pageSize ?? query.limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * take,
        take,
        // Do not expose raw audit payloads containing private account data.
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          createdAt: true,
          user: { select: { username: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);
    return ApiResponse.ok({
      items: rows.map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        actor: r.user?.username ?? "Hệ thống",
        action: r.action,
        detail: [r.resource, r.resourceId].filter(Boolean).join(" · "),
      })),
      total,
      page: query.page,
      totalPages: Math.ceil(total / take),
    });
  }
}
