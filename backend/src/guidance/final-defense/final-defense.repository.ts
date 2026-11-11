import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { GuidanceSession } from "../tasks/guidance.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { termInclude } from "../../term/repository/term.repository";

export class FinalDefenseSession extends GuidanceSession {
  constructor(readonly finalDb: Prisma.TransactionClient) {
    super(finalDb);
  }
  async schemaReady() {
    const rows = await this.finalDb.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'
      AND table_name IN ('FINAL_REPORT','FINAL_REPORT_VERSION','DEFENSE_CONFIRMATION','SCORE_ENTRY')`;
    const names = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const columnsReady = [
      "FINAL_REPORT.revision",
      "FINAL_REPORT_VERSION.id",
      "FINAL_REPORT_VERSION.report_id",
      "FINAL_REPORT_VERSION.sequence",
      "FINAL_REPORT_VERSION.file_asset_id",
      "FINAL_REPORT_VERSION.submitted_at",
      "DEFENSE_CONFIRMATION.revision",
      "DEFENSE_CONFIRMATION.report_version_id",
      "DEFENSE_CONFIRMATION.context",
      "SCORE_ENTRY.revision",
      "SCORE_ENTRY.report_version_id",
      "SCORE_ENTRY.comment",
      "SCORE_ENTRY.context",
    ].every((n) => names.has(n));
    if (!columnsReady) return false;
    // Partially added columns are not an applied migration. Reads fall back to
    // baseline projections until the version ownership/immutability guards exist.
    const guards = await this.finalDb.$queryRaw<Array<{ name: string }>>`
      SELECT k.conname::text AS name FROM pg_constraint k
        JOIN pg_namespace n ON n.oid=k.connamespace
        WHERE n.nspname='public' AND k.convalidated AND k.conname IN
          ('final_confirmation_version_fk','advisor_score_version_fk',
           'final_report_revision_nonnegative','final_confirmation_valid','final_advisor_score_valid')
      UNION ALL SELECT t.tgname::text AS name FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
        WHERE n.nspname='public' AND pn.nspname='public' AND NOT t.tgisinternal
          AND p.provolatile='v' AND NOT p.prosecdef
          AND (t.tgname='final_pdf_immutable' OR p.proconfig @> ARRAY['row_security=off'])
          AND t.tgenabled IN ('O','A') AND
          (c.relname,t.tgname,p.proname,t.tgtype::int) IN (
            ('FINAL_REPORT_VERSION','final_pdf_immutable','final_pdf_immutable',27),
            ('FINAL_REPORT_VERSION','final_pdf_asset_check','final_pdf_asset_check',7),
            ('FILE_ASSET','final_pdf_asset_immutable','final_pdf_asset_immutable',27),
            ('DEFENSE_CONFIRMATION','final_confirmation_owner','final_decision_owner_check',23),
            ('SCORE_ENTRY','advisor_score_owner','final_decision_owner_check',23),
            ('SUBMISSION_ASSET','final_pdf_no_weekly_submission','final_pdf_no_weekly_reuse',23),
            ('GUIDANCE_SUBMISSION_UPLOAD','final_pdf_no_weekly_upload','final_pdf_no_weekly_reuse',23))`;
    const found = new Set(guards.map((g) => g.name));
    return [
      "final_confirmation_version_fk",
      "advisor_score_version_fk",
      "final_report_revision_nonnegative",
      "final_confirmation_valid",
      "final_advisor_score_valid",
      "final_pdf_immutable",
      "final_pdf_asset_check",
      "final_pdf_asset_immutable",
      "final_confirmation_owner",
      "advisor_score_owner",
      "final_pdf_no_weekly_submission",
      "final_pdf_no_weekly_upload",
    ].every((n) => found.has(n));
  }
  policy(termId: string) {
    return this.finalDb.termParameter.findUnique({
      where: { termId_key: { termId, key: "UC17_POLICY" } },
    });
  }
  candidateIds(where: Prisma.ProposalWhereInput) {
    return this.finalDb.proposal.findMany({
      where,
      select: { id: true },
      orderBy: { id: "asc" },
    });
  }
  async progressEvidence(proposalId: string) {
    return this.finalDb.guidancePlan.findUnique({
      where: { proposalId },
      select: {
        advisorId: true,
        pr2bGuidancePlanWorkflowPlanId: {
          select: { assignmentId: true, assignmentRevision: true, state: true },
        },
        tasks: {
          select: {
            deadline: true,
            pr2bTaskWorkflowTaskId: {
              select: {
                state: true,
                refCurrentSubmissionId: {
                  select: {
                    pr2bSubmissionWorkflowSubmissionId: {
                      select: {
                        refEffectiveReviewId: {
                          select: { state: true, decision: true },
                        },
                      },
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
  windowTerm(id: string) {
    return this.finalDb.thesisTerm.findUnique({
      where: { id },
      include: termInclude,
    });
  }
  report(proposalId: string) {
    return this.finalDb.finalReport.findUnique({
      where: { proposalId },
      include: {
        versions: {
          include: { fileAsset: true },
          orderBy: { sequence: "desc" },
        },
      },
    });
  }
  legacyReport(proposalId: string) {
    return this.finalDb.finalReport.findUnique({
      where: { proposalId },
      select: { id: true, filePath: true, submittedAt: true },
    });
  }
  legacyDecision(proposalId: string) {
    return this.finalDb.defenseConfirmation.findUnique({
      where: { proposalId },
      select: { id: true, status: true },
    });
  }
  finalDecision(proposalId: string) {
    return this.finalDb.defenseConfirmation.findUnique({
      where: { proposalId },
    });
  }
  advisorScore(proposalId: string, scorerId: string) {
    return this.finalDb.scoreEntry.findUnique({
      where: {
        proposalId_scorerId_role: { proposalId, scorerId, role: "ADVISOR" },
      },
    });
  }
  events(proposalId: string) {
    return this.finalDb.auditLog.findMany({
      where: { resource: "final-defense", resourceId: proposalId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }
  event(
    actorId: string,
    proposalId: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    const json = (v: unknown) =>
      JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
    return this.finalDb.auditLog.create({
      data: {
        userId: actorId,
        resource: "final-defense",
        resourceId: proposalId,
        action,
        oldValue: json(oldValue),
        newValue: json(newValue),
      },
    });
  }
  async advanceReport(id: string, expected: number) {
    const changed = await this.finalDb.finalReport.updateMany({
      where: { id, revision: expected },
      data: { revision: { increment: 1 } },
    });
    if (changed.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Hồ sơ đã thay đổi; hãy tải lại.");
  }
}
@Injectable()
export class FinalDefenseRepository {
  constructor(private readonly prisma: PrismaService) {}
  read<T>(fn: (s: FinalDefenseSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new FinalDefenseSession(tx)), {
      isolationLevel: "RepeatableRead",
      timeout: 20000,
    });
  }
  write<T>(fn: (s: FinalDefenseSession) => Promise<T>) {
    return this.prisma
      .$transaction((tx) => fn(new FinalDefenseSession(tx)), {
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
            "Ghi đồng thời; tải lại hoặc thử lại với cùng Idempotency-Key.",
          );
        throw e;
      });
  }
}
