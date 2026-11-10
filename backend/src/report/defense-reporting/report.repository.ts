import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { FinalResultSession } from "../../defense/final-results/final-result.repository";
import { committeeJson } from "../../defense/committees/committee.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
export class ReportSession extends FinalResultSession {
  rpPolicy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC25_POLICY" } },
    });
  }
  rpCandidates(
    termId: string,
    className: string | undefined,
    limit: number,
    memberId?: string,
  ) {
    return this.finalDb.termStudent.findMany({
      where: {
        termId,
        ...(memberId ? { id: memberId } : {}),
        ...(className ? { student: { className } } : {}),
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: limit + 1,
    });
  }
  rpEvent(actor: string, id: string, action: string, value: unknown) {
    return this.finalDb.auditLog.create({
      data: {
        userId: actor,
        resource: "defense-report",
        resourceId: id,
        action,
        newValue: committeeJson(value),
      },
    });
  }
  rpMetadata(id: string, actor: string) {
    return this.finalDb.auditLog.findFirst({
      where: {
        resource: "defense-report",
        resourceId: id,
        userId: actor,
        action: { in: ["EXPORT_GENERATED", "GENERATION_FAILED"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  rpHistory(actor: string, termId: string) {
    return this.finalDb.auditLog.findMany({
      where: {
        resource: "defense-report",
        userId: actor,
        action: { in: ["EXPORT_GENERATED", "GENERATION_FAILED"] },
        newValue: { path: ["termId"], equals: termId },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    });
  }
}
@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: ReportSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new ReportSession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 60000,
    });
  }
  write<T>(fn: (s: ReportSession) => Promise<T>) {
    return this.prisma
      .$transaction((tx) => fn(new ReportSession(tx)), {
        isolationLevel: "Serializable",
        timeout: 60000,
      })
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2002", "P2034"].includes(e.code)
        )
          groupError(
            409,
            "EXPORT_CONFLICT",
            "Thao tác đồng thời; thử lại cùng key.",
          );
        throw e;
      });
  }
}
