import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { GuidanceSession } from "../tasks/guidance.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
const include = {
  pr2bSubmissionWorkflowSubmissionId: true,
  pr2bSubmissionAssetSubmissionId: { include: { refFileId: true } },
} satisfies Prisma.TaskSubmissionInclude;
export type SubmissionRecord = Prisma.TaskSubmissionGetPayload<{
  include: typeof include;
}>;
export class SubmissionSession extends GuidanceSession {
  constructor(private readonly submissionDb: Prisma.TransactionClient) {
    super(submissionDb);
  }
  upload(id: string) {
    return this.submissionDb.guidanceSubmissionUpload.findUnique({
      where: { id },
      include: { asset: true },
    });
  }
  uploadByKey(actorId: string, taskId: string, requestKey: string) {
    return this.submissionDb.guidanceSubmissionUpload.findUnique({
      where: { actorId_taskId_requestKey: { actorId, taskId, requestKey } },
      include: { asset: true },
    });
  }
  pendingCount(actorId: string) {
    return this.submissionDb.guidanceSubmissionUpload.count({
      where: {
        actorId,
        state: { in: ["PENDING", "READY"] },
        expiresAt: { gt: new Date() },
      },
    });
  }
  addUpload(data: Prisma.GuidanceSubmissionUploadUncheckedCreateInput) {
    return this.submissionDb.guidanceSubmissionUpload.create({
      data,
      include: { asset: true },
    });
  }
  updateUpload(
    id: string,
    data: Prisma.GuidanceSubmissionUploadUncheckedUpdateInput,
  ) {
    return this.submissionDb.guidanceSubmissionUpload.update({
      where: { id },
      data,
      include: { asset: true },
    });
  }
  async lockUpload(id: string) {
    await this.submissionDb
      .$queryRaw`SELECT id FROM public."GUIDANCE_SUBMISSION_UPLOAD" WHERE id=${id} FOR UPDATE`;
  }
  submission(id: string) {
    return this.submissionDb.taskSubmission.findUnique({
      where: { id },
      include,
    });
  }
  submissionPage(taskId: string, skip: number, take: number) {
    return this.submissionDb.taskSubmission.findMany({
      where: { taskId },
      include,
      skip,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
  submissionCount(taskId: string) {
    return this.submissionDb.taskSubmission.count({ where: { taskId } });
  }
  legacySubmissionCount(taskId: string) {
    return this.submissionDb.taskSubmission.count({
      where: { taskId, pr2bSubmissionWorkflowSubmissionId: { is: null } },
    });
  }
  addSubmission(data: Prisma.TaskSubmissionUncheckedCreateInput) {
    return this.submissionDb.taskSubmission.create({ data, include });
  }
  supersede(id: string) {
    return this.submissionDb.submissionWorkflow.update({
      where: { submissionId: id },
      data: { state: "SUPERSEDED", revision: { increment: 1 } },
    });
  }
  linkAsset(submissionId: string, fileId: string) {
    return this.submissionDb.submissionAsset.create({
      data: { submissionId, fileId },
    });
  }
  assetUpload(assetId: string) {
    return this.submissionDb.guidanceSubmissionUpload.findUnique({
      where: { assetId },
      include: { asset: true },
    });
  }
  assetUsed(fileId: string) {
    return this.submissionDb.fileAsset.count({
      where: {
        id: fileId,
        OR: [
          { pr2bSubmissionAssetFileId: { some: {} } },
          { pr2bEvaluationEvidenceFileId: { some: {} } },
          { pr2bDossierFinalizationPdfAssetId: { some: {} } },
          { pr2bDossierReceiptScanAssetId: { some: {} } },
        ],
      },
    });
  }
  quarantine(id: string) {
    return this.submissionDb.fileAsset.update({
      where: { id },
      data: { state: "QUARANTINED" },
    });
  }
  expired() {
    return this.submissionDb.guidanceSubmissionUpload.findMany({
      where: {
        state: { in: ["PENDING", "READY", "EXPIRED"] },
        expiresAt: { lte: new Date() },
        cleanedAt: null,
      },
      select: { id: true },
      take: 100,
      orderBy: { expiresAt: "asc" },
    });
  }
}
@Injectable()
export class SubmissionRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    work: (s: SubmissionSession) => Promise<T>,
    mutation = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++)
      try {
        return await this.prisma.$transaction(
          (tx) => work(new SubmissionSession(tx)),
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
            "Dữ liệu đã thay đổi; hãy tải lại.",
          );
        }
        throw e;
      }
  }
}
