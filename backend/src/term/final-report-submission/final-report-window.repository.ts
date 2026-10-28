import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { finalReportWindowConflict } from "./final-report-window.validator";

export type WindowTransaction = Prisma.TransactionClient;
type WindowValues = { opensAt: Date; closesAt: Date; isLocked: boolean };

@Injectable()
export class FinalReportWindowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(operation: (tx: WindowTransaction) => Promise<T>) {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      )
        throw finalReportWindowConflict();
      throw error;
    }
  }

  principal(userId: string, tx: WindowTransaction) {
    return tx.userAccount.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
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

  grant(userId: string, termId: string, tx: WindowTransaction) {
    return tx.academicTermGrant.findUnique({
      where: { userId_termId: { userId, termId } },
      select: { userId: true, termId: true, allDepartments: true },
    });
  }

  async lockTerm(termId: string, tx: WindowTransaction) {
    // Same parent-first order as existing academic workflow mutations.
    await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
  }

  term(termId: string, tx: WindowTransaction) {
    return tx.thesisTerm.findUnique({
      where: { id: termId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        isLocked: true,
        status: true,
      },
    });
  }

  window(termId: string, tx: WindowTransaction) {
    return tx.finalReportSubmissionWindow.findUnique({ where: { termId } });
  }

  create(termId: string, values: WindowValues, tx: WindowTransaction) {
    // Revision zero represents NOT_CONFIGURED; first persisted configuration is one.
    return tx.finalReportSubmissionWindow.create({
      data: { termId, ...values, revision: 1 },
    });
  }

  update(
    termId: string,
    revision: number,
    values: WindowValues,
    tx: WindowTransaction,
  ) {
    return tx.finalReportSubmissionWindow.updateMany({
      where: { termId, revision },
      data: { ...values, revision: { increment: 1 } },
    });
  }
}
