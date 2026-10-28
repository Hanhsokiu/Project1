import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ProposalVersionSession } from "../proposal-versions/proposal-version.repository";
import { groupError } from "../review-groups/review-group.errors";
const include = {
  pr2bDossierWorkflowDossierId: true,
  pr2bDossierFinalizationDossierId: {
    include: {
      refVersionId: { select: { version: true } },
      refPdfAssetId: true,
      pr2bDossierReceiptFinalizationId: true,
    },
    orderBy: { sequence: "desc" as const },
  },
  pr2bDossierHistoryDossierId: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ThesisDossierInclude;
export type DossierRecord = Prisma.ThesisDossierGetPayload<{
  include: typeof include;
}>;
export class DossierSession extends ProposalVersionSession {
  constructor(private readonly db: Prisma.TransactionClient) {
    super(db);
  }
  dossier(proposalId: string) {
    return this.db.thesisDossier.findUnique({ where: { proposalId }, include });
  }
  profile(termStudentId: string) {
    return this.db.dossierStudentProfile.findUnique({
      where: { termStudentId },
    });
  }
  printStudent(id: string) {
    return this.db.student.findUnique({
      where: { id },
      include: { trainingSystem: true },
    });
  }
  printAdvisor(id: string) {
    return this.db.lecturer.findUnique({
      where: { id },
      include: { department: true },
    });
  }
  async lockPrintInputs(
    studentId: string,
    advisorId: string,
    termStudentId: string,
  ) {
    await this.db
      .$queryRaw`SELECT id FROM public."STUDENT" WHERE id=${studentId} FOR SHARE`;
    await this.db
      .$queryRaw`SELECT id FROM public."LECTURER" WHERE id=${advisorId} FOR SHARE`;
    await this.db
      .$queryRaw`SELECT "termStudentId" FROM public."DOSSIER_STUDENT_PROFILE" WHERE "termStudentId"=${termStudentId} FOR SHARE`;
  }
  createDossier(proposalId: string) {
    return this.db.thesisDossier.create({
      data: {
        proposalId,
        pr2bDossierWorkflowDossierId: { create: { state: "DRAFT" } },
      },
      include,
    });
  }
  addFinalization(data: Prisma.DossierFinalizationUncheckedCreateInput) {
    return this.db.dossierFinalization.create({ data });
  }
  updateDossier(
    dossierId: string,
    revision: number,
    data: Prisma.DossierWorkflowUncheckedUpdateManyInput,
  ) {
    return this.db.dossierWorkflow.updateMany({
      where: { dossierId, revision },
      data: { ...data, revision: { increment: 1 } },
    });
  }
  addReceipt(data: Prisma.DossierReceiptUncheckedCreateInput) {
    return this.db.dossierReceipt.create({ data });
  }
  addAsset(data: Prisma.FileAssetUncheckedCreateInput) {
    return this.db.fileAsset.create({ data });
  }
  addPdf(assetId: string, bytes: Buffer) {
    return this.db.dossierPdfContent.create({ data: { assetId, bytes } });
  }
  pdf(assetId: string) {
    return this.db.dossierPdfContent.findUnique({ where: { assetId } });
  }
  linkPdf(id: string, pdfAssetId: string) {
    return this.db.dossierFinalization.update({
      where: { id },
      data: { pdfAssetId },
    });
  }
  dossierHistory(data: Prisma.DossierHistoryUncheckedCreateInput) {
    return this.db.dossierHistory.create({ data });
  }
  dossierAudit(
    userId: string,
    id: string,
    action: string,
    newValue: Prisma.InputJsonValue,
  ) {
    return this.db.auditLog.create({
      data: { userId, resource: "dossier", resourceId: id, action, newValue },
    });
  }
}
@Injectable()
export class DossierRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    work: (s: DossierSession) => Promise<T>,
    mutation = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++)
      try {
        return await this.prisma.$transaction(
          (tx) => work(new DossierSession(tx)),
          {
            isolationLevel: mutation ? "Serializable" : "RepeatableRead",
            timeout: 30000,
          },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (["P2034", "P2002"].includes(e.code) ||
            (e.code === "P2010" &&
              ["40001", "40P01"].includes(String(e.meta?.code))))
        ) {
          if (attempt < 2) continue;
          groupError(
            409,
            "REVISION_CONFLICT",
            "Hồ sơ đã thay đổi. Hãy tải lại.",
          );
        }
        throw e;
      }
  }
}
