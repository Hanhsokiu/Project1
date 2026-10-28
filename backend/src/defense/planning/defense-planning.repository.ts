import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseReviewSession } from "../reviews/defense-review.repository";
import { planningError } from "./defense-planning.policy";

export class DefensePlanningSession extends DefenseReviewSession {
  constructor(private readonly planningDb: Prisma.TransactionClient) {
    super(planningDb);
  }
  candidates(termId: string) {
    return this.planningDb.termLecturer.findMany({
      where: {
        termId,
        lecturer: {
          isActive: true,
          user: {
            status: "ACTIVE",
            mustChangePassword: false,
            userRoles: { some: { role: { name: "LECTURER" } } },
          },
        },
      },
      select: {
        lecturer: { select: { id: true, fullName: true, departmentId: true } },
      },
      orderBy: { lecturerId: "asc" },
    });
  }
  rooms() {
    return this.planningDb.room.findMany({
      select: { id: true, code: true, capacity: true },
      orderBy: { code: "asc" },
    });
  }
  readFinalization(id: string) {
    return this.planningDb.defenseListFinalization.findUnique({
      where: { id },
    });
  }
  committees(termId: string) {
    return this.planningDb.defenseCommittee.findMany({
      where: { termId },
      include: { members: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
  reviewers(proposalIds: string[]) {
    return this.planningDb.reviewerAssignment.findMany({
      where: { proposalId: { in: proposalIds } },
      orderBy: [{ proposalId: "asc" }, { id: "asc" }],
    });
  }
  sessions(termId: string) {
    return this.planningDb.defenseSession.findMany({
      where: { committee: { termId } },
      include: { committeeStudents: true },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    });
  }
  async busySessions(startsAt: Date, endsAt: Date) {
    // Cross-term conflict checks return generic issues only, never foreign PII.
    // Do not guess a maximum duration and miss a long existing session.
    const ids = await this.planningDb.$queryRaw<{ id: string }[]>`
      SELECT id FROM public."DEFENSE_SESSION"
      WHERE scheduled_at < ${endsAt}
        AND scheduled_at + duration_min * INTERVAL '1 minute' > ${startsAt}`;
    if (!ids.length) return [];
    return this.planningDb.defenseSession.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: {
        committeeStudents: true,
        committee: { include: { members: true } },
      },
    });
  }
  bookingStudents(proposalIds: string[]) {
    return this.planningDb.proposal.findMany({
      where: { id: { in: proposalIds } },
      select: { id: true, studentId: true },
    });
  }
}
@Injectable()
export class DefensePlanningRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async read<T>(
    work: (
      s: DefensePlanningSession,
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        (tx) => work(new DefensePlanningSession(tx), tx),
        { isolationLevel: "RepeatableRead", maxWait: 10000, timeout: 15000 },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2021", "P2022"].includes(e.code)
      )
        planningError(
          503,
          "DEFENSE_PLANNING_UNAVAILABLE",
          "Nguồn dữ liệu hội đồng/phản biện/lịch chưa sẵn sàng.",
        );
      throw e;
    }
  }
}
