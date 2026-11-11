import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ReviewerSession } from "../reviewers/reviewer.repository";
import { committeeJson } from "../committees/committee.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
const navigation = {
  committee: {
    select: {
      id: true,
      termId: true,
      name: true,
      members: { select: { lecturerId: true } },
    },
  },
  room: true,
  committeeStudents: { select: { proposalId: true } },
} satisfies Prisma.DefenseSessionInclude;
export type ScheduleRecord = Prisma.DefenseSessionGetPayload<{
  include: typeof navigation;
}>;
export function scheduleSnapshot(r: ScheduleRecord) {
  return Object.fromEntries(
    Object.entries(r).filter(
      ([key]) => !["committee", "room", "committeeStudents"].includes(key),
    ),
  ) as Omit<ScheduleRecord, "committee" | "room" | "committeeStudents">;
}
export class ScheduleSession extends ReviewerSession {
  private scColumns?: Promise<{ column_name: string }[]>;
  private scCapability?: Promise<boolean>;
  private columnsSchedule() {
    return (this.scColumns ??= this.finalDb.$queryRaw<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION'`);
  }
  async scLegacyReady() {
    const names = new Set(
      (await this.columnsSchedule()).map((r) => r.column_name),
    );
    return [
      "id",
      "committee_id",
      "room_id",
      "scheduled_at",
      "duration_min",
      "created_at",
    ].every((n) => names.has(n));
  }
  scReady() {
    return (this.scCapability ??= this.checkScheduleReady());
  }
  private async checkScheduleReady() {
    const names = new Set(
      (await this.columnsSchedule()).map((r) => r.column_name),
    );
    if (
      ![
        "revision",
        "state",
        "local_date",
        "session_type",
        "timezone",
        "ends_at",
        "context",
        "created_by",
        "updated_by",
        "updated_at",
        "finalized_by",
        "finalized_at",
        "published_by",
        "published_at",
      ].every((n) => names.has(n))
    )
      return false;
    const guards = await this.finalDb.$queryRaw<{ name: string }[]>`
      SELECT conname::text AS name FROM pg_constraint WHERE conrelid='public."DEFENSE_SESSION"'::regclass AND convalidated AND conname='sc_provenance_valid'
      UNION ALL SELECT tgname::text FROM pg_trigger WHERE tgrelid='public."DEFENSE_SESSION"'::regclass AND tgenabled IN ('O','A') AND tgname IN ('sc_transition_guard','sc_conflict_guard')
      UNION ALL SELECT t.tgname::text FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
        JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public."DEFENSE_SESSION"'::regclass
        AND t.tgname='sc_booking_mutex_guard' AND t.tgenabled IN ('O','A') AND NOT t.tgisinternal
        AND t.tgtype::int=30 AND n.nspname='public' AND p.proname='sc_booking_mutex_guard'
        AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off']`;
    const found = new Set(guards.map((g) => g.name));
    return [
      "sc_provenance_valid",
      "sc_transition_guard",
      "sc_conflict_guard",
      "sc_booking_mutex_guard",
    ].every((name) => found.has(name));
  }
  scPolicy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC21_POLICY" } },
    });
  }
  scRooms() {
    return this.finalDb.room.findMany({ orderBy: { id: "asc" } });
  }
  scRecords() {
    return this.finalDb.defenseSession.findMany({
      include: navigation,
      orderBy: { id: "asc" },
    });
  }
  scLegacy() {
    return this.finalDb.defenseSession.findMany({
      select: {
        id: true,
        committeeId: true,
        roomId: true,
        scheduledAt: true,
        durationMin: true,
        createdAt: true,
        ...navigation,
      },
      orderBy: { id: "asc" },
    });
  }
  scStudentIdentities(ids: string[]) {
    return this.finalDb.termStudent.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        termId: true,
        studentId: true,
        student: {
          select: { fullName: true, studentCode: true, isActive: true },
        },
      },
      orderBy: { id: "asc" },
    });
  }
  scProposalOwners(ids: string[]) {
    return this.finalDb.proposal.findMany({
      where: { id: { in: ids } },
      select: { id: true, studentId: true },
    });
  }
  async scLock(termId: string) {
    await this.ccLock(termId);
  }
  async scSave(
    id: string,
    expected: number,
    state: "DRAFT" | "FINALIZED",
    data: Prisma.DefenseSessionUncheckedCreateInput,
  ) {
    if (expected === 0)
      return this.finalDb.defenseSession.create({
        data: { ...data, id, revision: 1 },
      });
    const changed = await this.finalDb.defenseSession.updateMany({
      where: { id, revision: expected, state },
      data: {
        committeeId: data.committeeId,
        roomId: data.roomId,
        scheduledAt: data.scheduledAt,
        durationMin: data.durationMin,
        revision: expected + 1,
        state: data.state,
        localDate: data.localDate,
        sessionType: data.sessionType,
        timezone: data.timezone,
        endsAt: data.endsAt,
        context: data.context,
        updatedBy: data.updatedBy,
        updatedAt: data.updatedAt,
        finalizedBy: data.finalizedBy,
        finalizedAt: data.finalizedAt,
        publishedBy: data.publishedBy,
        publishedAt: data.publishedAt,
      },
    });
    if (changed.count !== 1)
      groupError(
        409,
        "REVISION_CONFLICT",
        "Lịch đã thay đổi hoặc không còn ở trạng thái cho phép.",
      );
  }
  scEvents(id: string) {
    return this.finalDb.auditLog.findMany({
      where: { resource: "defense-schedule", resourceId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }
  scEvent(
    actor: string,
    id: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    return this.finalDb.auditLog.create({
      data: {
        userId: actor,
        resource: "defense-schedule",
        resourceId: id,
        action,
        oldValue: committeeJson(oldValue),
        newValue: committeeJson(newValue),
      },
    });
  }
}
@Injectable()
export class ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: ScheduleSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new ScheduleSession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 30000,
    });
  }
  write<T>(fn: (s: ScheduleSession) => Promise<T>) {
    // All UC21 writers (including SQL guards) use the same cross-term mutex.
    // ReadCommitted is intentional: reads after waiting must see the last booking.
    return this.prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(2117,21)`;
          return fn(new ScheduleSession(tx));
        },
        { isolationLevel: "ReadCommitted", timeout: 30000 },
      )
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2002", "P2034"].includes(e.code)
        )
          groupError(
            409,
            "REVISION_CONFLICT",
            "Xung đột lịch/revision; tải lại hoặc thử cùng Idempotency-Key.",
          );
        throw e;
      });
  }
}
