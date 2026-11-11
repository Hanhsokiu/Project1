import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EligibilitySession } from "../eligibility/eligibility.repository";
import type { EligibilityService } from "../eligibility/eligibility.service";
import { groupError } from "../../topic/review-groups/review-group.errors";

const lecturerSelect = {
  id: true,
  lecturerCode: true,
  fullName: true,
  departmentId: true,
  titleId: true,
  isActive: true,
  user: {
    select: {
      status: true,
      userRoles: {
        orderBy: { roleId: "asc" },
        select: { role: { select: { name: true } } },
      },
    },
  },
  termLecturers: { orderBy: { termId: "asc" }, select: { termId: true } },
} satisfies Prisma.LecturerSelect;
const ccInclude = {
  members: {
    orderBy: { lecturerId: "asc" },
    include: { lecturer: { select: lecturerSelect } },
  },
  studentAssignments: { orderBy: { termStudentId: "asc" } },
} satisfies Prisma.DefenseCommitteeInclude;
export type CommitteeRecord = Prisma.DefenseCommitteeGetPayload<{
  include: typeof ccInclude;
}>;
export class CommitteeSession extends EligibilitySession {
  // Memoize upstream reads only within this transaction. UC19 does not mutate
  // these producers; its own committee/member/assignment/audit reads stay fresh.
  private principals = new Map<
    string,
    ReturnType<EligibilitySession["principal"]>
  >();
  private grantReads = new Map<
    string,
    ReturnType<EligibilitySession["grants"]>
  >();
  private termReads = new Map<string, ReturnType<EligibilitySession["term"]>>();
  private windowReads = new Map<
    string,
    ReturnType<EligibilitySession["windowTerm"]>
  >();
  private policyReads = new Map<
    string,
    ReturnType<EligibilitySession["policy"]>
  >();
  private eligibilityPolicies = new Map<
    string,
    ReturnType<EligibilitySession["eligibilityPolicy"]>
  >();
  private evidenceReads = new Map<
    string,
    ReturnType<EligibilityService["forCommittee"]>
  >();
  override principal(id: string) {
    let value = this.principals.get(id);
    if (!value) {
      value = super.principal(id);
      this.principals.set(id, value);
    }
    return value;
  }
  override grants(actor: string, termId?: string) {
    const key = JSON.stringify([actor, termId]);
    let value = this.grantReads.get(key);
    if (!value) {
      value = super.grants(actor, termId);
      this.grantReads.set(key, value);
    }
    return value;
  }
  override term(id: string) {
    let value = this.termReads.get(id);
    if (!value) {
      value = super.term(id);
      this.termReads.set(id, value);
    }
    return value;
  }
  override windowTerm(id: string) {
    let value = this.windowReads.get(id);
    if (!value) {
      value = super.windowTerm(id);
      this.windowReads.set(id, value);
    }
    return value;
  }
  override policy(id: string) {
    let value = this.policyReads.get(id);
    if (!value) {
      value = super.policy(id);
      this.policyReads.set(id, value);
    }
    return value;
  }
  override eligibilityPolicy(id: string) {
    let value = this.eligibilityPolicies.get(id);
    if (!value) {
      value = super.eligibilityPolicy(id);
      this.eligibilityPolicies.set(id, value);
    }
    return value;
  }
  ccEvidence(
    actor: string,
    term: string,
    member: string,
    work: () => ReturnType<EligibilityService["forCommittee"]>,
  ) {
    const key = JSON.stringify([actor, term, member]);
    let value = this.evidenceReads.get(key);
    if (!value) {
      value = work();
      this.evidenceReads.set(key, value);
    }
    return value;
  }
  async ccCandidateMembers(termId: string) {
    const rows = await this.finalDb.topicWorkflow.findMany({
      where: {
        termId,
        termStudentId: { not: null },
        refTopicId: { proposals: { some: { termId } } },
      },
      select: { termStudentId: true },
      orderBy: { termStudentId: "asc" },
    });
    return rows.flatMap((r) =>
      r.termStudentId ? [{ id: r.termStudentId }] : [],
    );
  }
  private ccColumns?: Promise<
    Array<{ table_name: string; column_name: string }>
  >;
  private ccCapability?: Promise<boolean>;
  private columns() {
    return (this.ccColumns ??= this.finalDb.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'
      AND table_name IN ('DEFENSE_COMMITTEE','COMMITTEE_MEMBER','DEFENSE_COMMITTEE_ASSIGNMENT','DEFENSE_SESSION','COMMITTEE_STUDENT')`);
  }
  async ccLegacyReady() {
    const rows = await this.columns();
    return [
      "DEFENSE_COMMITTEE.id",
      "DEFENSE_COMMITTEE.term_id",
      "DEFENSE_COMMITTEE.name",
      "COMMITTEE_MEMBER.committee_id",
      "COMMITTEE_MEMBER.lecturer_id",
      "COMMITTEE_MEMBER.role",
    ].every((n) => rows.some((r) => `${r.table_name}.${r.column_name}` === n));
  }
  ccReady() {
    return (this.ccCapability ??= this.checkReady());
  }
  async ccClaimsReady() {
    const names = new Set(
      (await this.columns()).map((r) => `${r.table_name}.${r.column_name}`),
    );
    return [
      "DEFENSE_SESSION.id",
      "DEFENSE_SESSION.committee_id",
      "COMMITTEE_STUDENT.session_id",
      "COMMITTEE_STUDENT.proposal_id",
    ].every((n) => names.has(n));
  }
  async ccClaims(termId: string) {
    const proposals = await this.candidateIds({ termId });
    return this.finalDb.committeeStudent.findMany({
      where: {
        OR: [
          { session: { committee: { termId } } },
          { proposalId: { in: proposals.map((p) => p.id) } },
        ],
      },
      select: { proposalId: true, session: { select: { committeeId: true } } },
      orderBy: [{ sessionId: "asc" }, { proposalId: "asc" }],
    });
  }
  private async checkReady() {
    const names = new Set(
      (await this.columns()).map((r) => `${r.table_name}.${r.column_name}`),
    );
    if (!(await this.ccClaimsReady())) return false;
    if (
      ![
        ...[
          "code",
          "department_id",
          "revision",
          "state",
          "context",
          "created_by",
          "updated_by",
          "updated_at",
          "finalized_by",
          "finalized_at",
        ].map((n) => `DEFENSE_COMMITTEE.${n}`),
        ...[
          "id",
          "committee_id",
          "term_id",
          "term_student_id",
          "proposal_id",
          "state",
          "revision",
          "context",
          "assigned_by",
          "assigned_at",
          "updated_by",
          "updated_at",
        ].map((n) => `DEFENSE_COMMITTEE_ASSIGNMENT.${n}`),
      ].every((n) => names.has(n))
    )
      return false;
    const guards = await this.finalDb.$queryRaw<Array<{ name: string }>>`
      SELECT k.conname::text AS name FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace
      WHERE n.nspname='public' AND k.convalidated AND k.conname IN ('cc_provenance_valid','cca_provenance_valid','DEFENSE_COMMITTEE_ASSIGNMENT_term_student_id_key','DEFENSE_COMMITTEE_ASSIGNMENT_proposal_id_key','DEFENSE_COMMITTEE_term_id_code_key')
      UNION ALL SELECT i.relname::text FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=i.relnamespace
      WHERE n.nspname='public' AND x.indisunique AND x.indisvalid AND x.indisready AND i.relname IN ('DEFENSE_COMMITTEE_ASSIGNMENT_term_student_id_key','DEFENSE_COMMITTEE_ASSIGNMENT_proposal_id_key','DEFENSE_COMMITTEE_term_id_code_key')
      UNION ALL SELECT t.tgname::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND t.tgenabled IN ('O','A') AND t.tgname IN ('cc_transition_guard','cc_member_guard','cca_transition_guard','cc_final_structure_guard')`;
    return new Set(guards.map((g) => g.name)).size === 9;
  }
  ccPolicy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC19_POLICY" } },
    });
  }
  ccList(termId: string) {
    return this.finalDb.defenseCommittee.findMany({
      where: { termId },
      include: ccInclude,
      orderBy: { id: "asc" },
    });
  }
  ccLegacy(termId: string) {
    return this.finalDb.defenseCommittee.findMany({
      where: { termId },
      select: {
        id: true,
        termId: true,
        name: true,
        createdAt: true,
        members: {
          orderBy: { lecturerId: "asc" },
          select: {
            lecturerId: true,
            role: true,
            lecturer: { select: lecturerSelect },
          },
        },
      },
      orderBy: { id: "asc" },
    });
  }
  ccLecturers(termId: string) {
    return this.finalDb.lecturer.findMany({
      where: { termLecturers: { some: { termId } } },
      select: lecturerSelect,
      orderBy: { id: "asc" },
    });
  }
  async ccLock(termId: string) {
    // Same first lock as B1–B8/UC17/UC18; subsequent locks follow stable order.
    await this.finalDb
      .$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
    await this.finalDb
      .$queryRaw`SELECT id FROM public."DEFENSE_COMMITTEE" WHERE term_id=${termId} ORDER BY id FOR UPDATE`;
    await this.finalDb
      .$queryRaw`SELECT id FROM public."TERM_PHASE" WHERE term_id=${termId} ORDER BY id FOR UPDATE`;
    const proposals = await this.candidateIds({ termId });
    for (const p of proposals) await this.lock(termId, [], p.id);
  }
  ccCreate(data: Prisma.DefenseCommitteeUncheckedCreateInput) {
    return this.finalDb.defenseCommittee.create({ data });
  }
  async ccAdvance(
    id: string,
    expected: number,
    data: Prisma.DefenseCommitteeUncheckedUpdateManyInput,
  ) {
    const changed = await this.finalDb.defenseCommittee.updateMany({
      where: { id, revision: expected, state: "DRAFT", finalizedAt: null },
      data: { ...data, revision: { increment: 1 } },
    });
    if (changed.count !== 1)
      groupError(
        409,
        "REVISION_CONFLICT",
        "Hội đồng đã thay đổi hoặc đã chốt.",
      );
  }
  async ccMembers(id: string, members: { lecturerId: string; role: string }[]) {
    await this.finalDb.committeeMember.deleteMany({
      where: { committeeId: id },
    });
    if (members.length)
      await this.finalDb.committeeMember.createMany({
        data: members.map((m) => ({ committeeId: id, ...m })),
      });
  }
  async ccAssign(
    termStudentId: string,
    expected: number,
    data: Prisma.DefenseCommitteeAssignmentUncheckedCreateInput,
  ) {
    if (expected === 0)
      return this.finalDb.defenseCommitteeAssignment.create({ data });
    const changed = await this.finalDb.defenseCommitteeAssignment.updateMany({
      where: { termStudentId, revision: expected },
      data: {
        committeeId: data.committeeId,
        state: data.state,
        context: data.context,
        updatedBy: data.updatedBy,
        updatedAt: data.updatedAt,
        revision: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Phân sinh viên đã thay đổi.");
  }
  ccEvents(id: string) {
    return this.finalDb.auditLog.findMany({
      where: { resource: "defense-committee", resourceId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }
  ccEvent(
    actor: string,
    id: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    return this.finalDb.auditLog.create({
      data: {
        userId: actor,
        resource: "defense-committee",
        resourceId: id,
        action,
        oldValue: committeeJson(oldValue),
        newValue: committeeJson(newValue),
      },
    });
  }
}
export const committeeJson = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
@Injectable()
export class CommitteeRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: CommitteeSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new CommitteeSession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 30000,
    });
  }
  write<T>(fn: (s: CommitteeSession) => Promise<T>) {
    return this.prisma
      .$transaction((tx) => fn(new CommitteeSession(tx)), {
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
            "Xung đột revision/mã/phân sinh viên; tải lại hoặc thử cùng Idempotency-Key.",
          );
        throw e;
      });
  }
}
