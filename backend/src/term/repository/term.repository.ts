import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RosterDto, TermQueryDto } from "../dto/term.dto";
import { BusinessException } from "../../common/exception/business.exception";
import { ErrorCode } from "../../common/exception/error-code.enum";

export const termInclude = Prisma.validator<Prisma.ThesisTermInclude>()({
  phases: true,
  parameters: true,
  semesterRecord: true,
  trainingSystem: true,
  termLecturers: {
    include: { lecturer: { include: { researchAreas: true } } },
  },
  termStudents: { include: { student: true } },
});
export type LoadedTerm = Prisma.ThesisTermGetPayload<{
  include: typeof termInclude;
}>;
export type TermTransaction = Prisma.TransactionClient;

@Injectable()
export class TermRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    operation: (tx: TermTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "P2002")
        throw new BusinessException(
          ErrorCode.DUPLICATE,
          "Dữ liệu đã được tạo bởi một thao tác khác. Vui lòng tải lại.",
          409,
        );
      if (code === "P2034")
        throw new BusinessException(
          ErrorCode.TERM_TRANSITION_INVALID,
          "Dữ liệu đợt vừa thay đổi. Vui lòng tải lại và thử lại thao tác.",
          409,
        );
      throw error;
    }
  }
  async list(query: TermQueryDto) {
    const where: Prisma.ThesisTermWhereInput = {
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.trainingSystemId
        ? { trainingSystemId: query.trainingSystemId }
        : {}),
      ...(query.semesterId ? { semesterId: query.semesterId } : {}),
      ...(query.academicYear ? { academicYear: query.academicYear } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.thesisTerm.findMany({
        where,
        include: termInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.thesisTerm.count({ where }),
    ]);
    return { items, total };
  }
  findById(id: string, tx?: TermTransaction) {
    return (tx ?? this.prisma).thesisTerm.findUnique({
      where: { id },
      include: termInclude,
    });
  }
  findByCode(code: string, tx?: TermTransaction) {
    return (tx ?? this.prisma).thesisTerm.findUnique({ where: { code } });
  }
  latest(trainingSystemId: string, semesterId: string) {
    return this.prisma.thesisTerm.findFirst({
      where: { trainingSystemId, semesterId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: termInclude,
    });
  }
  semesters(query: { academicYear?: string; search?: string }) {
    return this.prisma.academicSemester.findMany({
      where: {
        ...(query.academicYear ? { academicYear: query.academicYear } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: "insensitive" } }
          : {}),
      },
      orderBy: [{ academicYear: "desc" }, { semester: "asc" }],
    });
  }
  semester(id: string, tx?: TermTransaction) {
    return (tx ?? this.prisma).academicSemester.findUnique({ where: { id } });
  }
  semesterByKey(academicYear: string, semester: number, tx: TermTransaction) {
    return tx.academicSemester.findUnique({
      where: { academicYear_semester: { academicYear, semester } },
    });
  }
  createSemester(
    data: Prisma.AcademicSemesterCreateInput,
    tx: TermTransaction,
  ) {
    return tx.academicSemester.create({ data });
  }
  trainingSystem(id: string, tx: TermTransaction) {
    return tx.trainingSystem.findUnique({ where: { id } });
  }
  create(data: Prisma.ThesisTermCreateInput, tx: TermTransaction) {
    return tx.thesisTerm.create({ data, include: termInclude });
  }
  update(id: string, data: Prisma.ThesisTermUpdateInput, tx: TermTransaction) {
    return tx.thesisTerm.update({ where: { id }, data, include: termInclude });
  }
  updatePhase(
    id: string,
    data: Prisma.TermPhaseUpdateInput,
    tx: TermTransaction,
  ) {
    return tx.termPhase.update({ where: { id }, data });
  }
  createPhase(data: Prisma.TermPhaseUncheckedCreateInput, tx: TermTransaction) {
    return tx.termPhase.create({ data });
  }
  async linkWorkflowPhase(
    termId: string,
    phaseId: string,
    key: "PROPOSAL_EDIT" | "PROPOSAL_REVIEW",
    tx: TermTransaction,
  ) {
    const link = await tx.termPhaseWorkflow.upsert({
      where: { phaseId },
      create: { termId, phaseId, key },
      update: {},
    });
    if (link.termId !== termId || link.key !== key)
      throw new BusinessException(
        ErrorCode.VALIDATION_FAILED,
        "Giai đoạn đã liên kết với workflow khác; cần đối soát trước khi lưu.",
      );
  }
  async replaceParameters(
    termId: string,
    parameters: Record<string, number>,
    tx: TermTransaction,
  ) {
    for (const [key, value] of Object.entries(parameters))
      await tx.termParameter.upsert({
        where: { termId_key: { termId, key } },
        create: { termId, key, value: String(value) },
        update: { value: String(value) },
      });
  }
  students(ids: string[], tx: TermTransaction) {
    return tx.student.findMany({ where: { id: { in: ids } } });
  }
  lecturers(ids: string[], tx: TermTransaction) {
    return tx.lecturer.findMany({
      where: { id: { in: ids } },
      include: { researchAreas: true },
    });
  }
  registrations(termId: string, tx: TermTransaction) {
    return tx.registration.findMany({
      where: { termId },
      select: { studentId: true, status: true },
    });
  }
  async publicationState(termId: string, tx?: TermTransaction) {
    const client = tx ?? this.prisma;
    const officialAssignments = await client.advisorAssignment.findMany({
      where: {
        assignmentPlan: { termId, status: { in: ["PUBLISHED", "FINALIZED"] } },
      },
      select: {
        advisorId: true,
        registration: { select: { studentId: true } },
      },
    });
    const officialPlanCount = await client.assignmentPlan.count({
      where: { termId, status: { in: ["PUBLISHED", "FINALIZED"] } },
    });
    const proposals = await client.proposal.findMany({
      where: { topic: { termId } },
      select: { id: true },
    });
    const publishedResults = proposals.length
      ? await client.finalResult.count({
          where: {
            proposalId: { in: proposals.map((p) => p.id) },
            isPublished: true,
          },
        })
      : 0;
    return {
      assignmentPublished: officialPlanCount > 0,
      resultsPublished: publishedResults > 0,
      officialAssignments,
    };
  }
  async replaceRoster(termId: string, input: RosterDto, tx: TermTransaction) {
    await tx.termStudent.deleteMany({
      where: { termId, studentId: { notIn: input.studentIds } },
    });
    if (input.studentIds.length)
      await tx.termStudent.createMany({
        data: input.studentIds.map((studentId) => ({ termId, studentId })),
        skipDuplicates: true,
      });
    await tx.termLecturer.deleteMany({
      where: {
        termId,
        lecturerId: { notIn: input.lecturers.map((l) => l.lecturerId) },
      },
    });
    for (const lecturer of input.lecturers)
      await tx.termLecturer.upsert({
        where: {
          termId_lecturerId: { termId, lecturerId: lecturer.lecturerId },
        },
        create: { termId, ...lecturer },
        update: { quota: lecturer.quota },
      });
  }
}
