import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { reportError } from "./final-report.dto";

export type ReportTransaction = Prisma.TransactionClient;
export const reportInclude = {
  fileAsset: true,
} satisfies Prisma.FinalReportInclude;
export type ReportRecord = Prisma.FinalReportGetPayload<{
  include: typeof reportInclude;
}>;

@Injectable()
export class FinalReportRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    operation: (tx: ReportTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        // Fresh reads after row/advisory-lock waits are essential: an orphan
        // cleaner must see an upload that committed while it waited for its key.
        // Writers are protected by parent/window/proposal locks plus revision CAS.
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      )
        reportError(
          409,
          "REVISION_CONFLICT",
          "Hồ sơ vừa thay đổi. Hãy tải lại trước khi nộp.",
        );
      throw error;
    }
  }
  principal(id: string, tx: ReportTransaction) {
    return tx.userAccount.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        mustChangePassword: true,
        student: { select: { id: true, isActive: true } },
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
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
  proposal(id: string, tx: ReportTransaction) {
    return tx.proposal.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        termId: true,
        topic: { select: { termId: true } },
        term: {
          select: {
            id: true,
            status: true,
            isLocked: true,
            startDate: true,
            endDate: true,
            finalReportSubmissionWindow: true,
          },
        },
      },
    });
  }
  roster(termId: string, studentId: string, tx: ReportTransaction) {
    return tx.termStudent.findUnique({
      where: { termId_studentId: { termId, studentId } },
      select: { id: true },
    });
  }
  async lock(termId: string, proposalId: string, tx: ReportTransaction) {
    await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
    await tx.$queryRaw`SELECT term_id FROM public."FINAL_REPORT_SUBMISSION_WINDOW" WHERE term_id=${termId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM public."PROPOSAL" WHERE id=${proposalId} FOR UPDATE`;
  }
  async lockKey(key: string, tx: ReportTransaction) {
    // Shared by writers, downloads and orphan cleanup. Never reattach an old key.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }
  async now(tx: ReportTransaction) {
    const [row] = await tx.$queryRaw<
      Array<{ at: Date }>
    >`SELECT clock_timestamp() AS at`;
    return row.at;
  }
  report(proposalId: string, tx: ReportTransaction) {
    return tx.finalReport.findUnique({
      where: { proposalId },
      include: reportInclude,
    });
  }
  addAsset(data: Prisma.FileAssetUncheckedCreateInput, tx: ReportTransaction) {
    return tx.fileAsset.create({ data });
  }
  async swap(
    proposalId: string,
    termId: string,
    reportId: string,
    assetId: string,
    revision: number,
    exists: boolean,
    tx: ReportTransaction,
  ) {
    // Enforce the deadline at the database write, after all bytes were saved.
    // clock_timestamp() is deliberately not transaction-start CURRENT_TIMESTAMP.
    const rows = exists
      ? await tx.$queryRaw<Array<{ id: string }>>`
          WITH accepted AS MATERIALIZED (SELECT clock_timestamp() AS at)
          UPDATE public."FINAL_REPORT" r SET file_asset_id=${assetId}, submitted_at=a.at, revision=r.revision+1
          FROM accepted a, public."FINAL_REPORT_SUBMISSION_WINDOW" w, public."THESIS_TERM" t
          WHERE r.proposal_id=${proposalId} AND r.revision=${revision} AND w.term_id=${termId} AND t.id=w.term_id
            AND NOT w.is_locked AND NOT t.is_locked AND t.status::text NOT IN ('COMPLETED','CANCELLED')
            AND w.opens_at>=t.start_date AND w.closes_at<=t.end_date
            AND w.opens_at<=a.at AND a.at<w.closes_at RETURNING r.id`
      : await tx.$queryRaw<Array<{ id: string }>>`
          WITH accepted AS MATERIALIZED (SELECT clock_timestamp() AS at)
          INSERT INTO public."FINAL_REPORT" (id,proposal_id,file_asset_id,submitted_at,revision,created_at)
          SELECT ${reportId},${proposalId},${assetId},a.at,1,a.at
          FROM accepted a, public."FINAL_REPORT_SUBMISSION_WINDOW" w JOIN public."THESIS_TERM" t ON t.id=w.term_id
          WHERE w.term_id=${termId} AND NOT w.is_locked AND NOT t.is_locked AND t.status::text NOT IN ('COMPLETED','CANCELLED')
            AND w.opens_at>=t.start_date AND w.closes_at<=t.end_date
            AND w.opens_at<=a.at AND a.at<w.closes_at RETURNING id`;
    if (rows.length !== 1)
      reportError(
        409,
        "FINAL_REPORT_WRITE_CONFLICT",
        "Cửa sổ nộp đã đóng hoặc hồ sơ vừa thay đổi.",
      );
  }
  assetForCleanup(key: string, tx: ReportTransaction) {
    return tx.fileAsset.findUnique({
      where: { storageKey: key },
      include: {
        finalReport: { select: { id: true } },
        guidanceUpload: { select: { id: true } },
        pr2bDossierPdfContent: { select: { assetId: true } },
        _count: {
          select: {
            pr2bDossierFinalizationPdfAssetId: true,
            pr2bDossierReceiptScanAssetId: true,
            pr2bSubmissionAssetFileId: true,
            pr2bEvaluationEvidenceFileId: true,
          },
        },
      },
    });
  }
  deleteAsset(id: string, tx: ReportTransaction) {
    return tx.fileAsset.delete({ where: { id } });
  }
  cleanupCandidates(before: Date, tx: ReportTransaction) {
    // Also retry metadata cleanup if bytes were removed but its DB transaction failed.
    return tx.fileAsset.findMany({
      where: {
        storageKey: { startsWith: "final-reports/" },
        kind: "REPORT",
        createdAt: { lt: before },
        finalReport: { is: null },
        guidanceUpload: { is: null },
        pr2bDossierPdfContent: { is: null },
        pr2bDossierFinalizationPdfAssetId: { none: {} },
        pr2bDossierReceiptScanAssetId: { none: {} },
        pr2bSubmissionAssetFileId: { none: {} },
        pr2bEvaluationEvidenceFileId: { none: {} },
      },
      select: { storageKey: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  }
}
export type ReportPrincipal = Awaited<
  ReturnType<FinalReportRepository["principal"]>
>;
export type ReportProposal = NonNullable<
  Awaited<ReturnType<FinalReportRepository["proposal"]>>
>;
