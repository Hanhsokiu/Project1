import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type GradingKind } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseWorkflowSession } from "../../defense/workflow/defense-workflow.repository";
import { gradingError } from "./grading.policy";
import { gradingParameterKeys } from "./grading-parameters";
export class GradingSession extends DefenseWorkflowSession {
  constructor(readonly gradingDb: Prisma.TransactionClient) {
    super(gradingDb);
  }
  policyRecord(termId: string) {
    return this.gradingDb.gradingPolicy.findUnique({
      where: { termId },
      include: { current: true },
    });
  }
  policyRevision(termId: string, revision: number) {
    return this.gradingDb.gradingPolicyRevision.findUnique({
      where: { termId_revision: { termId, revision } },
    });
  }
  gradingParameters(termId: string) {
    return this.gradingDb.termParameter.findMany({
      where: { termId, key: { in: [...gradingParameterKeys] } },
      orderBy: { key: "asc" },
    });
  }
  sheetRevisions(ids: string[]) {
    return this.gradingDb.gradingSheetRevision.findMany({
      where: { id: { in: ids } },
      include: { sheet: true },
    });
  }
  async lockGrading(termId: string) {
    await this.lock(termId); // Same term/source/file lock protocol as UC17–21.
    await this.gradingDb
      .$queryRaw`SELECT term_id FROM public."GRADING_POLICY" WHERE term_id=${termId} FOR UPDATE`;
    await this.gradingDb
      .$queryRaw`SELECT id FROM public."GRADING_SHEET" WHERE term_id=${termId} ORDER BY id FOR UPDATE`;
    await this.gradingDb
      .$queryRaw`SELECT proposal_id FROM public."GRADING_RESULT" WHERE term_id=${termId} ORDER BY proposal_id FOR UPDATE`;
  }
  createPolicy(termId: string) {
    return this.gradingDb.gradingPolicy.create({ data: { termId } });
  }
  policyVersion(data: Prisma.GradingPolicyRevisionUncheckedCreateInput) {
    return this.gradingDb.gradingPolicyRevision.create({ data });
  }
  policyUpdate(termId: string, revision: number, next: string) {
    return this.gradingDb.gradingPolicy.updateMany({
      where: { termId, revision },
      data: { revision: revision + 1, currentRevisionId: next },
    });
  }
  sheet(
    termId: string,
    proposalId: string,
    scorerUserId: string,
    kind: GradingKind,
  ) {
    return this.gradingDb.gradingSheet.findUnique({
      where: {
        termId_proposalId_scorerUserId_kind: {
          termId,
          proposalId,
          scorerUserId,
          kind,
        },
      },
      include: { current: true },
    });
  }
  sheets(termId: string, proposalId?: string, scorerUserId?: string) {
    return this.gradingDb.gradingSheet.findMany({
      where: { termId, proposalId, scorerUserId },
      include: { current: true },
      orderBy: [
        { proposalId: "asc" },
        { scorerUserId: "asc" },
        { kind: "asc" },
      ],
    });
  }
  createSheet(data: Prisma.GradingSheetUncheckedCreateInput) {
    return this.gradingDb.gradingSheet.create({ data });
  }
  sheetVersion(data: Prisma.GradingSheetRevisionUncheckedCreateInput) {
    return this.gradingDb.gradingSheetRevision.create({ data });
  }
  sheetUpdate(
    id: string,
    revision: number,
    next: string,
    state: "DRAFT" | "SEALED",
  ) {
    return this.gradingDb.gradingSheet.updateMany({
      where: { id, revision, state: "DRAFT" },
      data: { revision: revision + 1, currentRevisionId: next, state },
    });
  }
  sheetHistory(sheetId: string, afterRevision: number, limit: number) {
    return this.gradingDb.gradingSheetRevision.findMany({
      where: { sheetId, revision: { gt: afterRevision } },
      orderBy: [{ revision: "asc" }, { id: "asc" }],
      take: limit + 1,
    });
  }
  result(proposalId: string) {
    return this.gradingDb.gradingResult.findUnique({
      where: { proposalId },
      include: { current: { include: { policy: true } } },
    });
  }
  results(termId: string) {
    return this.gradingDb.gradingResult.findMany({
      where: { termId },
      include: { current: { include: { policy: true } } },
      orderBy: { proposalId: "asc" },
    });
  }
  createResult(termId: string, proposalId: string) {
    return this.gradingDb.gradingResult.create({
      data: { termId, proposalId },
    });
  }
  resultVersion(data: Prisma.GradingResultRevisionUncheckedCreateInput) {
    return this.gradingDb.gradingResultRevision.create({ data });
  }
  resultUpdate(
    proposalId: string,
    revision: number,
    next: string,
    state: "SEALED" | "PUBLISHED",
  ) {
    return this.gradingDb.gradingResult.updateMany({
      where: { proposalId, revision, state: "SEALED" },
      data: { revision: revision + 1, currentRevisionId: next, state },
    });
  }
  resultHistory(proposalId: string, afterRevision: number, limit: number) {
    return this.gradingDb.gradingResultRevision.findMany({
      where: { proposalId, revision: { gt: afterRevision } },
      orderBy: [{ revision: "asc" }, { id: "asc" }],
      take: limit + 1,
      include: { policy: true },
    });
  }
  policyHistory(termId: string, afterRevision: number, limit: number) {
    return this.gradingDb.gradingPolicyRevision.findMany({
      where: { termId, revision: { gt: afterRevision } },
      orderBy: { revision: "asc" },
      take: limit + 1,
    });
  }
  async gradingWatchers(termId: string, departmentId: string | null) {
    const grants = await this.gradingDb.academicTermGrant.findMany({
      where: {
        termId,
        OR: [
          { allDepartments: true },
          ...(departmentId
            ? [{ pr2bGrantDepartmentGrantId: { some: { departmentId } } }]
            : []),
        ],
        refUserId: {
          status: "ACTIVE",
          mustChangePassword: false,
          userRoles: {
            some: {
              role: {
                rolePermissions: {
                  some: {
                    permission: { resource: "grading", action: "read-results" },
                  },
                },
              },
            },
          },
        },
      },
      select: { userId: true },
    });
    return grants.map((g) => g.userId);
  }
  reportLecturers(ids: string[]) {
    return this.gradingDb.lecturer.findMany({
      where: { id: { in: ids } },
      select: { id: true, lecturerCode: true, fullName: true },
    });
  }
}
@Injectable()
export class GradingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async transaction<T>(
    write: boolean,
    work: (s: GradingSession, tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        (tx) => work(new GradingSession(tx), tx),
        {
          isolationLevel: write ? "ReadCommitted" : "RepeatableRead",
          maxWait: 10000,
          timeout: 60000,
        },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        const sql = String(e.meta?.code ?? "");
        if (
          ["P2021", "P2022"].includes(e.code) ||
          ["42P01", "42703"].includes(sql)
        )
          gradingError(
            503,
            "GRADING_SCHEMA_UNAVAILABLE",
            "Schema chấm điểm chưa sẵn sàng; không thể giả lập lưu.",
          );
        if (
          ["P2002", "P2034", "P2028"].includes(e.code) ||
          ["55P03", "40P01", "57014", "40001"].includes(sql)
        )
          gradingError(
            409,
            "GRADING_CONFLICT",
            "Có thay đổi đồng thời hoặc chờ khóa quá lâu; hãy tải lại.",
          );
      }
      throw e;
    }
  }
}
