import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CommitteeGradeSession } from "../committee-grading/committee-grade.repository";
import { committeeJson } from "../committees/committee.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
export type FinalResultRecord = Prisma.FinalResultGetPayload<object>;
export class FinalResultSession extends CommitteeGradeSession {
  async frReady() {
    const columns = await this.finalDb.$queryRaw<
      {
        column_name: string;
        numeric_precision: number | null;
        numeric_scale: number | null;
      }[]
    >`SELECT column_name,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT'`;
    if (
      ![
        "revision",
        "state",
        "context",
        "is_locked",
        "finalized_by",
        "finalized_at",
        "published_by",
      ].every((n) => columns.some((c) => c.column_name === n)) ||
      !columns.some(
        (c) =>
          c.column_name === "final_score" &&
          c.numeric_precision === 4 &&
          c.numeric_scale === 1,
      )
    )
      return false;
    const guards = await this.finalDb.$queryRaw<
      { name: string }[]
    >`SELECT conname::text AS name FROM pg_constraint WHERE conrelid='public."FINAL_RESULT"'::regclass AND convalidated AND conname='fr_record_valid' UNION ALL SELECT tgname::text FROM pg_trigger WHERE tgrelid='public."FINAL_RESULT"'::regclass AND tgenabled IN ('O','A') AND tgname IN ('fr_transition_guard','fr_commit_guard')`;
    return new Set(guards.map((g) => g.name)).size === 3;
  }
  frPolicy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC24_POLICY" } },
    });
  }
  frRow(proposalId: string) {
    return this.finalDb.finalResult.findUnique({ where: { proposalId } });
  }
  frLegacy(proposalId: string) {
    return this.finalDb.finalResult.findUnique({
      where: { proposalId },
      select: { id: true },
    });
  }
  frEvents(id: string) {
    return this.finalDb.auditLog.findMany({
      where: { resource: "defense-result", resourceId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
  frEvent(
    actor: string,
    id: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    return this.finalDb.auditLog.create({
      data: {
        userId: actor,
        resource: "defense-result",
        resourceId: id,
        action,
        oldValue: committeeJson(oldValue),
        newValue: committeeJson(newValue),
      },
    });
  }
  async frSave(
    proposalId: string,
    expected: number,
    data: Prisma.FinalResultUncheckedCreateInput,
  ) {
    if (!expected)
      return this.finalDb.finalResult.create({
        data: { ...data, proposalId, revision: 1 },
      });
    const changed = await this.finalDb.finalResult.updateMany({
      where: {
        proposalId,
        revision: expected,
        state: data.state === "PUBLISHED" ? "FINALIZED" : "CONFIRMING",
        isLocked: data.state === "PUBLISHED",
      },
      data: {
        revision: expected + 1,
        state: data.state,
        context: data.context,
        finalScore: data.finalScore,
        isPassed: data.isPassed,
        isLocked: data.isLocked,
        finalizedBy: data.finalizedBy,
        finalizedAt: data.finalizedAt,
        isPublished: data.isPublished,
        publishedBy: data.publishedBy,
        publishedAt: data.publishedAt,
      },
    });
    if (changed.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Kết quả đã thay đổi hoặc bị khóa.");
    return (await this.frRow(proposalId))!;
  }
  async frLock(termId: string, proposalId: string) {
    await this.ccLock(termId);
    await this.finalDb
      .$queryRaw`SELECT id FROM public."SCORE_ENTRY" WHERE proposal_id=${proposalId} ORDER BY id FOR UPDATE`;
    await this.finalDb
      .$queryRaw`SELECT id FROM public."FINAL_RESULT" WHERE proposal_id=${proposalId} FOR UPDATE`;
  }
}
@Injectable()
export class FinalResultRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: FinalResultSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new FinalResultSession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 60000,
    });
  }
  write<T>(fn: (s: FinalResultSession) => Promise<T>) {
    return this.prisma
      .$transaction((tx) => fn(new FinalResultSession(tx)), {
        isolationLevel: "Serializable",
        timeout: 60000,
      })
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2034", "P2002"].includes(e.code)
        )
          groupError(409, "REVISION_CONFLICT", "Ghi đồng thời; tải lại hồ sơ.");
        throw e;
      });
  }
}
