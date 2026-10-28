import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { defenseListError } from "./defense-list.validator";

@Injectable()
export class DefenseListRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    mode: "read" | "write",
  ) {
    try {
      return await this.prisma.$transaction(operation, {
        // GET and the neutral reader must observe the same snapshot. Writers
        // need fresh reads after waiting for the parent lock, matching PDF writes.
        isolationLevel:
          mode === "read"
            ? Prisma.TransactionIsolationLevel.RepeatableRead
            : Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (["P2002", "P2034"].includes(error.code))
          defenseListError(
            409,
            "DEFENSE_LIST_CONFLICT",
            "Danh sách đã được tạo hoặc thay đổi đồng thời; hãy tải lại.",
          );
        if (["P2021", "P2022"].includes(error.code))
          defenseListError(
            503,
            "DEFENSE_LIST_STORAGE_UNAVAILABLE",
            "Nguồn dữ liệu danh sách bảo vệ chưa sẵn sàng.",
          );
      }
      throw error;
    }
  }

  async lockTerm(termId: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
  }

  principal(userId: string, tx: Prisma.TransactionClient) {
    return tx.userAccount.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        mustChangePassword: true,
        userRoles: {
          select: {
            role: {
              select: {
                rolePermissions: {
                  select: {
                    permission: { select: { resource: true, action: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  grant(userId: string, termId: string, tx: Prisma.TransactionClient) {
    return tx.academicTermGrant.findUnique({
      where: { userId_termId: { userId, termId } },
      select: {
        userId: true,
        termId: true,
        allDepartments: true,
        pr2bGrantDepartmentGrantId: { select: { departmentId: true } },
      },
    });
  }

  term(termId: string, tx: Prisma.TransactionClient) {
    return tx.thesisTerm.findUnique({
      where: { id: termId },
      select: {
        id: true,
        status: true,
        isLocked: true,
        startDate: true,
        endDate: true,
      },
    });
  }

  list(termId: string, tx: Prisma.TransactionClient) {
    return tx.defenseList.findUnique({ where: { termId } });
  }

  async now(tx: Prisma.TransactionClient) {
    const [row] = await tx.$queryRaw<
      Array<{ at: Date }>
    >`SELECT clock_timestamp() AS at`;
    return row.at;
  }

  create(termId: string, at: Date, tx: Prisma.TransactionClient) {
    return tx.defenseList.create({
      data: {
        termId,
        state: "DRAFT",
        revision: 0,
        openedAt: null,
        openedByUserId: null,
        currentFinalizationId: null,
        createdAt: at,
        updatedAt: at,
      },
    });
  }

  open(
    termId: string,
    revision: number,
    userId: string,
    at: Date,
    tx: Prisma.TransactionClient,
  ) {
    return tx.defenseList.updateMany({
      where: {
        termId,
        state: "DRAFT",
        revision,
        openedAt: null,
        openedByUserId: null,
        currentFinalizationId: null,
      },
      data: {
        state: "OPEN",
        openedAt: at,
        openedByUserId: userId,
        revision: { increment: 1 },
        updatedAt: at,
      },
    });
  }
}
