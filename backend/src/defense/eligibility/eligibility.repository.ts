import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { FinalDefenseSession } from "../../guidance/final-defense/final-defense.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";

export class EligibilitySession extends FinalDefenseSession {
  private columnInfo?: Promise<Array<{ column_name: string }>>;
  private uc17Capability?: Promise<boolean>;
  private uc18Capability?: Promise<boolean>;
  override schemaReady() {
    return (this.uc17Capability ??= super.schemaReady());
  }
  private eligibilityColumns() {
    return (this.columnInfo ??= this.finalDb.$queryRaw<
      Array<{ column_name: string }>
    >`
      SELECT column_name FROM information_schema.columns WHERE table_schema='public'
      AND table_name='DEFENSE_ELIGIBILITY'`);
  }
  async eligibilityLegacyReady() {
    const rows = await this.eligibilityColumns();
    return ["id", "proposal_id", "status"].every((n) =>
      rows.some((r) => r.column_name === n),
    );
  }
  async eligibilitySchemaReady() {
    return (this.uc18Capability ??= this.checkEligibilitySchema());
  }
  private async checkEligibilitySchema() {
    const rows = await this.eligibilityColumns();
    if (
      ![
        "revision",
        "context",
        "reviewed_by",
        "decided_by",
        "decided_at",
        "finalized_by",
        "finalized_at",
      ].every((n) => rows.some((r) => r.column_name === n))
    )
      return false;
    const guards = await this.finalDb.$queryRaw<Array<{ name: string }>>`
      SELECT conname::text AS name FROM pg_constraint
      WHERE conrelid='public."DEFENSE_ELIGIBILITY"'::regclass
      AND convalidated AND conname='eligibility_provenance_valid'
      UNION ALL SELECT tgname::text AS name FROM pg_trigger
      WHERE tgrelid='public."DEFENSE_ELIGIBILITY"'::regclass
      AND tgenabled IN ('O','A') AND tgname='eligibility_transition_guard'`;
    return guards.length === 2;
  }
  eligibilityPolicy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC18_POLICY" } },
    });
  }
  eligibilityAdvisor(id: string) {
    return this.finalDb.lecturer.findUnique({
      where: { id },
      select: { userId: true, fullName: true },
    });
  }
  eligibilityProgress(proposalId: string) {
    return this.finalDb.guidancePlan.findUnique({
      where: { proposalId },
      include: {
        pr2bGuidancePlanWorkflowPlanId: true,
        tasks: {
          orderBy: { id: "asc" },
          include: {
            pr2bTaskWorkflowTaskId: {
              include: {
                refCurrentSubmissionId: {
                  include: {
                    pr2bSubmissionWorkflowSubmissionId: {
                      include: { refEffectiveReviewId: true },
                    },
                    pr2bSubmissionAssetSubmissionId: {
                      include: { refFileId: true },
                      orderBy: { fileId: "asc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
  eligibilityCoverage(termId: string, termStudentId: string) {
    return this.finalDb.periodRequiredStudent.findMany({
      where: { termId, termStudentId, refPeriodId: { type: "WEEK" } },
      select: { periodId: true },
      orderBy: { periodId: "asc" },
    });
  }
  member(id: string) {
    return this.finalDb.termStudent.findUnique({
      where: { id },
      include: { student: true },
    });
  }
  members(termId: string) {
    return this.finalDb.termStudent.findMany({
      where: { termId },
      select: { id: true },
      orderBy: { id: "asc" },
    });
  }
  async memberProposal(termStudentId: string) {
    const owner = await this.ownerProposal(termStudentId);
    const proposals = owner?.refTopicId.proposals ?? [];
    return { owner, proposals };
  }
  eligibility(proposalId: string) {
    return this.finalDb.defenseEligibility.findUnique({
      where: { proposalId },
    });
  }
  legacyEligibility(proposalId: string) {
    return this.finalDb.defenseEligibility.findUnique({
      where: { proposalId },
      select: { id: true, status: true },
    });
  }
  eligibilityEvents(proposalId: string) {
    return this.finalDb.auditLog.findMany({
      where: { resource: "defense-eligibility", resourceId: proposalId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }
  eligibilityEvent(
    actor: string,
    proposalId: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    return this.finalDb.auditLog.create({
      data: {
        userId: actor,
        resource: "defense-eligibility",
        resourceId: proposalId,
        action,
        oldValue: eligibilityJson(oldValue),
        newValue: eligibilityJson(newValue),
      },
    });
  }
  async saveEligibility(
    proposalId: string,
    expected: number,
    data: Prisma.DefenseEligibilityUncheckedUpdateManyInput,
  ) {
    const current = await this.eligibility(proposalId);
    if (!current) {
      if (expected !== 0)
        groupError(409, "REVISION_CONFLICT", "Hồ sơ đã thay đổi.");
      // Commands supply scalar values only; create is deliberately distinct from GET.
      return this.finalDb.defenseEligibility.create({
        data: {
          proposalId,
          ...data,
          revision: 1,
        } as Prisma.DefenseEligibilityUncheckedCreateInput,
      });
    }
    const changed = await this.finalDb.defenseEligibility.updateMany({
      where: { id: current.id, revision: expected, finalizedAt: null },
      data: { ...data, revision: { increment: 1 } },
    });
    if (changed.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Hồ sơ đã đổi hoặc đã chốt.");
    return this.eligibility(proposalId);
  }
}
export const eligibilityJson = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
@Injectable()
export class EligibilityRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: EligibilitySession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new EligibilitySession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 20000,
    });
  }
  write<T>(fn: (s: EligibilitySession) => Promise<T>) {
    return this.prisma
      .$transaction((tx) => fn(new EligibilitySession(tx)), {
        isolationLevel: "Serializable",
        timeout: 20000,
      })
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2034", "P2002"].includes(e.code)
        )
          groupError(
            409,
            "REVISION_CONFLICT",
            "Ghi đồng thời; tải lại hoặc thử cùng Idempotency-Key.",
          );
        throw e;
      });
  }
}
