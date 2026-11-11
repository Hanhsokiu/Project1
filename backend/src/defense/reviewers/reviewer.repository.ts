import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CommitteeSession,
  committeeJson,
} from "../committees/committee.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { reviewHash } from "../../topic/proposal-reviews/proposal-review.validator";

export type ReviewerRow = Prisma.ReviewerAssignmentGetPayload<object>;
export class ReviewerSession extends CommitteeSession {
  private rwColumns?: Promise<{ column_name: string }[]>;
  private rwCapability?: Promise<boolean>;
  private columnsReviewer() {
    return (this.rwColumns ??= this.finalDb.$queryRaw<
      { column_name: string }[]
    >`
      SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT'`);
  }
  async rwLegacyReady() {
    const names = new Set(
      (await this.columnsReviewer()).map((r) => r.column_name),
    );
    return ["id", "proposal_id", "reviewer_id", "assigned_at"].every((n) =>
      names.has(n),
    );
  }
  rwReady() {
    return (this.rwCapability ??= this.checkReviewerReady());
  }
  private async checkReviewerReady() {
    const names = new Set(
      (await this.columnsReviewer()).map((r) => r.column_name),
    );
    if (
      ![
        "id",
        "proposal_id",
        "reviewer_id",
        "assigned_at",
        "term_id",
        "term_student_id",
        "committee_id",
        "revision",
        "state",
        "selected",
        "context",
        "created_by",
        "updated_by",
        "updated_at",
        "finalized_by",
        "finalized_at",
      ].every((n) => names.has(n))
    )
      return false;
    const guards = await this.finalDb.$queryRaw<{ name: string }[]>`
      SELECT conname::text AS name FROM pg_constraint WHERE conrelid='public."REVIEWER_ASSIGNMENT"'::regclass
        AND convalidated AND conname='rw_provenance_valid'
      UNION ALL SELECT tgname::text FROM pg_trigger WHERE tgrelid='public."REVIEWER_ASSIGNMENT"'::regclass
        AND tgenabled IN ('O','A') AND tgname IN ('rw_transition_guard','rw_group_guard')
      UNION ALL SELECT 'rw_unique_pair'::text WHERE EXISTS (
        SELECT 1 FROM pg_index x WHERE x.indrelid='public."REVIEWER_ASSIGNMENT"'::regclass
        AND x.indisunique AND x.indisvalid AND x.indisready AND x.indnkeyatts=2
        AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(x.indkey::smallint[]) k
          JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k) = ARRAY['proposal_id','reviewer_id']::text[] )`;
    return new Set(guards.map((g) => g.name)).size === 4;
  }
  rwPolicy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC20_POLICY" } },
    });
  }
  async rwRows(termId: string) {
    const proposals = await this.candidateIds({ termId });
    return this.finalDb.reviewerAssignment.findMany({
      where: {
        OR: [{ termId }, { proposalId: { in: proposals.map((p) => p.id) } }],
      },
      orderBy: [{ proposalId: "asc" }, { reviewerId: "asc" }],
    });
  }
  async rwLegacy(termId: string) {
    const proposals = await this.candidateIds({ termId });
    return this.finalDb.reviewerAssignment.findMany({
      where: { proposalId: { in: proposals.map((p) => p.id) } },
      select: {
        id: true,
        proposalId: true,
        reviewerId: true,
        assignedAt: true,
      },
      orderBy: [{ proposalId: "asc" }, { reviewerId: "asc" }],
    });
  }
  rwLecturerAreas(termId: string) {
    return this.finalDb.lecturerArea.findMany({
      where: { lecturer: { termLecturers: { some: { termId } } } },
      select: { lecturerId: true, researchAreaId: true },
      orderBy: [{ lecturerId: "asc" }, { researchAreaId: "asc" }],
    });
  }
  async rwAdvisorHistory(proposalId: string, termId: string) {
    const p = await this.finalDb.proposal.findUnique({
      where: { id: proposalId },
      select: {
        termId: true,
        studentId: true,
        topic: { select: { researchAreaId: true } },
      },
    });
    if (!p || p.termId !== termId)
      return {
        valid: false,
        advisorIds: [],
        hash: reviewHash(null),
        areaId: null,
      };
    const rows = await this.finalDb.advisorAssignment.findMany({
      where: {
        registration: { termId, studentId: p.studentId },
        assignmentPlan: { status: { in: ["FINALIZED", "PUBLISHED"] } },
      },
      include: {
        assignmentPlan: { include: { pr2bAssignmentPlanWorkflowPlanId: true } },
        pr2bAssignmentChangeAssignmentId: {
          orderBy: { assignmentRevision: "asc" },
        },
      },
      orderBy: { id: "asc" },
    });
    let valid = rows.length > 0;
    const advisorIds = new Set<string>();
    const proof = rows.map((a) => {
      const m = a.assignmentPlan.pr2bAssignmentPlanWorkflowPlanId;
      if (
        a.assignmentPlan.status !== "FINALIZED" ||
        !m?.finalizedByUserId ||
        !m.finalizedAt ||
        m.finalizedAt > new Date()
      )
        valid = false;
      advisorIds.add(a.advisorId);
      let previous: string | null = null,
        time = 0;
      for (const [i, c] of a.pr2bAssignmentChangeAssignmentId.entries()) {
        if (
          c.assignmentRevision !== i + 1 ||
          c.effectiveAt.getTime() < time ||
          c.effectiveAt > new Date() ||
          (previous && previous !== c.oldAdvisorId) ||
          !c.actorId
        )
          valid = false;
        advisorIds.add(c.oldAdvisorId);
        advisorIds.add(c.newAdvisorId);
        previous = c.newAdvisorId;
        time = c.effectiveAt.getTime();
      }
      if (previous && previous !== a.advisorId) valid = false;
      return {
        id: a.id,
        plan: a.assignmentPlanId,
        advisor: a.advisorId,
        meta: m,
        changes: a.pr2bAssignmentChangeAssignmentId,
      };
    });
    return {
      valid,
      advisorIds: [...advisorIds].sort(),
      hash: reviewHash(proof),
      areaId: p.topic.researchAreaId,
    };
  }
  async rwAdvisorLoads(termId: string) {
    const term = await this.term(termId),
      planId = term?.pr2bTermWorkflowTermId?.officialAssignmentPlanId;
    if (!planId) return { valid: false, counts: {} as Record<string, number> };
    const rows = await this.finalDb.advisorAssignment.findMany({
      where: { assignmentPlanId: planId },
      select: {
        advisorId: true,
        assignmentPlan: { select: { termId: true, status: true } },
        pr2bAssignmentChangeAssignmentId: {
          orderBy: { assignmentRevision: "desc" },
          take: 1,
        },
      },
    });
    const counts: Record<string, number> = {};
    let valid = true;
    for (const a of rows) {
      const c = a.pr2bAssignmentChangeAssignmentId[0];
      if (
        a.assignmentPlan.termId !== termId ||
        a.assignmentPlan.status !== "FINALIZED" ||
        (c && (c.newAdvisorId !== a.advisorId || c.effectiveAt > new Date()))
      )
        valid = false;
      counts[a.advisorId] = (counts[a.advisorId] ?? 0) + 1;
    }
    return { valid, counts };
  }
  async rwLock(termId: string) {
    await this.ccLock(termId);
    await this.finalDb
      .$queryRaw`SELECT r.id FROM public."REVIEWER_ASSIGNMENT" r JOIN public."PROPOSAL" p ON p.id=r.proposal_id WHERE p.term_id=${termId} ORDER BY r.id FOR UPDATE OF r`;
  }
  async rwSave(
    proposalId: string,
    expected: number,
    reviewerIds: string[],
    data: Omit<
      Prisma.ReviewerAssignmentUncheckedCreateInput,
      "reviewerId" | "id"
    >,
  ) {
    const rows = await this.finalDb.reviewerAssignment.findMany({
      where: { proposalId },
      orderBy: { reviewerId: "asc" },
    });
    if (
      rows.some(
        (r) => r.revision !== expected || r.state !== "DRAFT" || r.finalizedAt,
      ) ||
      (!rows.length && expected !== 0)
    )
      groupError(
        409,
        "REVISION_CONFLICT",
        "Phân công phản biện đã thay đổi/legacy/đã chốt.",
      );
    for (const r of rows) {
      const changed = await this.finalDb.reviewerAssignment.updateMany({
        where: {
          id: r.id,
          revision: expected,
          state: "DRAFT",
          finalizedAt: null,
        },
        data: {
          committeeId: data.committeeId,
          revision: expected + 1,
          state: data.state,
          selected: reviewerIds.includes(r.reviewerId),
          context: data.context,
          updatedBy: data.updatedBy,
          updatedAt: data.updatedAt,
          finalizedBy: data.finalizedBy,
          finalizedAt: data.finalizedAt,
        },
      });
      if (changed.count !== 1)
        groupError(
          409,
          "REVISION_CONFLICT",
          "Revision phân công phản biện đã thay đổi.",
        );
    }
    for (const reviewerId of [...reviewerIds].sort())
      if (!rows.some((r) => r.reviewerId === reviewerId))
        await this.finalDb.reviewerAssignment.create({
          data: { ...data, reviewerId, revision: expected + 1, selected: true },
        });
  }
  rwEvents(member: string) {
    return this.finalDb.auditLog.findMany({
      where: { resource: "defense-reviewer", resourceId: member },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }
  rwEvent(
    actor: string,
    member: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    return this.finalDb.auditLog.create({
      data: {
        userId: actor,
        resource: "defense-reviewer",
        resourceId: member,
        action,
        oldValue: committeeJson(oldValue),
        newValue: committeeJson(newValue),
      },
    });
  }
}
@Injectable()
export class ReviewerRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: ReviewerSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new ReviewerSession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 30000,
    });
  }
  write<T>(fn: (s: ReviewerSession) => Promise<T>) {
    return this.prisma
      .$transaction((tx) => fn(new ReviewerSession(tx)), {
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
            "Xung đột phân công/revision; tải lại hoặc thử cùng Idempotency-Key.",
          );
        throw e;
      });
  }
}
