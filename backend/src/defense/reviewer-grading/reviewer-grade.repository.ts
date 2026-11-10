import { writeOwnedGrade } from "../grading/write-grade";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ScheduleSession } from "../scheduling/schedule.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { committeeJson } from "../committees/committee.repository";
export type ReviewerGradeRecord = Prisma.ScoreEntryGetPayload<{
  include: { scoreDetails: true };
}>;
export class ReviewerGradeSession extends ScheduleSession {
  async rgReady() {
    if (!(await this.schemaReady()) || !(await this.rwReady())) return false;
    const guards = await this.finalDb.$queryRaw<{ name: string }[]>`
      SELECT conname::text AS name FROM pg_constraint WHERE conrelid='public."SCORE_ENTRY"'::regclass AND convalidated AND conname='rg_record_valid'
      UNION ALL SELECT tgname::text FROM pg_trigger WHERE tgenabled IN ('O','A') AND ((tgrelid='public."SCORE_ENTRY"'::regclass AND tgname IN ('rg_score_guard','rg_commit_guard')) OR (tgrelid='public."SCORE_DETAIL"'::regclass AND tgname='rg_detail_guard'))
      UNION ALL SELECT 'rg_score_unique' WHERE EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid='public."SCORE_ENTRY"'::regclass AND k.contype='u' AND k.convalidated AND ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY c(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=c.num ORDER BY c.ord)=ARRAY['proposal_id','scorer_id','role'])
      UNION ALL SELECT 'rg_detail_unique' WHERE EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid='public."SCORE_DETAIL"'::regclass AND k.contype='u' AND k.convalidated AND ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY c(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=c.num ORDER BY c.ord)=ARRAY['score_entry_id','rubric_criteria_id'])
      UNION ALL SELECT 'rg_decimal_storage' WHERE (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND (table_name,column_name) IN (('SCORE_ENTRY','total_score'),('SCORE_DETAIL','score')) AND numeric_precision=4 AND numeric_scale=1)=2`;
    return new Set(guards.map((g) => g.name)).size === 7;
  }
  rgPolicy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC22_POLICY" } },
    });
  }
  rgAssignments(termId?: string, reviewerId?: string) {
    return this.finalDb.reviewerAssignment.findMany({
      where: {
        ...(termId ? { termId } : {}),
        ...(reviewerId ? { reviewerId } : {}),
      },
      orderBy: [
        { termId: "asc" },
        { termStudentId: "asc" },
        { reviewerId: "asc" },
      ],
    });
  }
  rgScore(proposalId: string, scorerId: string) {
    return this.finalDb.scoreEntry.findUnique({
      where: {
        proposalId_scorerId_role: { proposalId, scorerId, role: "REVIEWER" },
      },
      include: { scoreDetails: { orderBy: { rubricCriteriaId: "asc" } } },
    });
  }
  rgRubric(termId: string, ids: string[]) {
    return this.finalDb.rubricCriteria.findMany({
      where: { termId, id: { in: ids } },
      orderBy: { id: "asc" },
    });
  }
  rgEvents(id: string) {
    return this.finalDb.auditLog.findMany({
      where: { resource: "defense-reviewer-grade", resourceId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }
  rgEvent(
    actor: string,
    id: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    return this.finalDb.auditLog.create({
      data: {
        userId: actor,
        resource: "defense-reviewer-grade",
        resourceId: id,
        action,
        oldValue: committeeJson(oldValue),
        newValue: committeeJson(newValue),
      },
    });
  }
  async rgSave(
    proposalId: string,
    scorerId: string,
    expected: number,
    data: Prisma.ScoreEntryUncheckedCreateInput,
    details: Record<string, string>,
  ) {
    await writeOwnedGrade(
      this.finalDb,
      "REVIEWER",
      proposalId,
      scorerId,
      expected,
      data,
      details,
    );
    return (await this.rgScore(proposalId, scorerId))!;
  }
}
@Injectable()
export class ReviewerGradeRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: ReviewerGradeSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new ReviewerGradeSession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 30000,
    });
  }
  write<T>(fn: (s: ReviewerGradeSession) => Promise<T>) {
    return this.prisma
      .$transaction((tx) => fn(new ReviewerGradeSession(tx)), {
        isolationLevel: "Serializable",
        timeout: 30000,
      })
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2002", "P2034"].includes(e.code)
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
