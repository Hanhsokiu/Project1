import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseConfirmationSession } from "./defense-confirmation.repository";
import { confirmationError } from "./defense-confirmation.dto";

/** Only SELECTs and transaction-scoped locks. No decision/configuration writes. */
export class DefenseConfirmationReportSession extends DefenseConfirmationSession {
  constructor(private readonly reportDb: Prisma.TransactionClient) {
    super(reportDb);
  }

  async lockReport(termId: string, proposalId: string) {
    // Same parent-first order as PDF replacement/cleanup and UC17/UC18 writes.
    // No window/list lock is needed: downloads remain allowed after closing.
    await this.reportDb
      .$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
    await this.reportDb
      .$queryRaw`SELECT id FROM public."PROPOSAL" WHERE id=${proposalId} FOR UPDATE`;
  }

  async lockPdfKey(key: string) {
    await this.reportDb
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }

  async now() {
    const [row] = await this.reportDb.$queryRaw<
      Array<{ at: Date }>
    >`SELECT clock_timestamp() AS at`;
    return row.at;
  }
}

@Injectable()
export class DefenseConfirmationReportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read<T>(
    operation: (session: DefenseConfirmationReportSession) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        (tx) => operation(new DefenseConfirmationReportSession(tx)),
        {
          // Reload current facts after waiting for the upload's parent/key lock.
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (
          ["P2021", "P2022"].includes(error.code) ||
          (error.code === "P2010" &&
            ["42P01", "42703"].includes(String(error.meta?.code)))
        )
          confirmationError(
            503,
            "UC17_STORAGE_UNAVAILABLE",
            "Nguồn dữ liệu PDF/phân công chưa sẵn sàng.",
          );
        if (error.code === "P2034")
          confirmationError(
            409,
            "PDF_CONTEXT_CHANGED",
            "Hồ sơ đang thay đổi; hãy tải lại context.",
          );
      }
      throw error;
    }
  }
}
