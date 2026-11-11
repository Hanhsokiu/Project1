import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ReviewerGradeSession } from "../reviewer-grading/reviewer-grade.repository";
import { committeeJson } from "../committees/committee.repository";
import { writeOwnedGrade } from "../grading/write-grade";
import { groupError } from "../../topic/review-groups/review-group.errors";
export class CommitteeGradeSession extends ReviewerGradeSession {
  async cgReady() {
    if (
      !(await this.rgReady()) ||
      !(await this.ccReady()) ||
      !(await this.scReady())
    )
      return false;
    const guards = await this.finalDb.$queryRaw<{ name: string }[]>`
      SELECT conname::text AS name FROM pg_constraint WHERE conrelid='public."SCORE_ENTRY"'::regclass AND convalidated AND conname='cg_record_valid'
      UNION ALL SELECT tgname::text FROM pg_trigger WHERE tgenabled IN ('O','A') AND ((tgrelid='public."SCORE_ENTRY"'::regclass AND tgname IN ('cg_score_guard','cg_commit_guard')) OR (tgrelid='public."SCORE_DETAIL"'::regclass AND tgname='cg_detail_guard'))`;
    return new Set(guards.map((g) => g.name)).size === 4;
  }
  cgPolicy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC23_POLICY" } },
    });
  }
  cgTermIds(lecturerId: string) {
    return this.finalDb.committeeMember.findMany({
      where: { lecturerId },
      select: { committee: { select: { termId: true } } },
    });
  }
  cgScores(proposalId: string, scorerId: string) {
    return this.finalDb.scoreEntry.findMany({
      where: {
        proposalId,
        scorerId,
        role: { in: ["COMMITTEE_MEMBER", "COMMITTEE_CHAIR"] },
      },
      include: { scoreDetails: { orderBy: { rubricCriteriaId: "asc" } } },
      orderBy: { id: "asc" },
    });
  }
  cgEvents(id: string) {
    return this.finalDb.auditLog.findMany({
      where: { resource: "defense-committee-grade", resourceId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }
  cgEvent(
    actor: string,
    id: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    return this.finalDb.auditLog.create({
      data: {
        userId: actor,
        resource: "defense-committee-grade",
        resourceId: id,
        action,
        oldValue: committeeJson(oldValue),
        newValue: committeeJson(newValue),
      },
    });
  }
  async cgSave(
    proposalId: string,
    scorerId: string,
    expected: number,
    data: Prisma.ScoreEntryUncheckedCreateInput,
    details: Record<string, string>,
  ) {
    await writeOwnedGrade(
      this.finalDb,
      "COMMITTEE_MEMBER",
      proposalId,
      scorerId,
      expected,
      data,
      details,
    );
    return (await this.cgScores(proposalId, scorerId)).find(
      (s) => s.role === "COMMITTEE_MEMBER",
    )!;
  }
}
@Injectable()
export class CommitteeGradeRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: CommitteeGradeSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new CommitteeGradeSession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 30000,
    });
  }
  write<T>(fn: (s: CommitteeGradeSession) => Promise<T>) {
    return this.prisma
      .$transaction((tx) => fn(new CommitteeGradeSession(tx)), {
        isolationLevel: "Serializable",
        timeout: 30000,
      })
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2034", "P2002"].includes(e.code)
        )
          groupError(
            409,
            "REVISION_CONFLICT",
            "Ghi đồng thời; tải lại hoặc retry cùng Idempotency-Key.",
          );
        throw e;
      });
  }
}
