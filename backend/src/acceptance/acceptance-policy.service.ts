import { randomUUID } from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { AcceptanceContext, buildAcceptancePolicies } from "./policy-bundle";
import { ReviewerGradePolicySchema, CommitteeGradePolicySchema } from "@doan/shared";
import { performance } from "perf_hooks";
import { defaultColumns, ReportTemplates } from "../report/defense-reporting/report-templates";
import { ReportPolicySchema } from "@doan/shared";

// Deliberately NOT registered in AppModule: only the guarded local staging runner uses this producer.
export class AcceptancePolicyService {
  constructor(private readonly db: PrismaClient) {}
  async repairUnusedReportTemplates(termId: string, actorId: string) {
    const target = new URL(process.env.DATABASE_URL ?? "");
    if (target.hostname !== "127.0.0.1" || !/^\/btl_pr2b_acceptance_[a-z0-9_]+$/.test(target.pathname)) throw new Error("TEST database only");
    return this.db.$transaction(async tx => {
      const actor = await tx.userAccount.findUnique({ where: { id: actorId }, include: { userRoles: { include: { role: true } } } });
      const term = await tx.thesisTerm.findUniqueOrThrow({ where: { id: termId } });
      const grant = await tx.academicTermGrant.findUnique({ where: { userId_termId: { userId: actorId, termId } } });
      const row = await tx.termParameter.findUniqueOrThrow({ where: { termId_key: { termId, key: "UC25_POLICY" } } });
      const old = ReportPolicySchema.parse(JSON.parse(row.value));
      if (!actor?.username.startsWith("acpt_") || actor.status !== "ACTIVE" || !actor.userRoles.some(r => r.role.name === "FACULTY") || !grant || old.approvedBy !== actorId || !term.code.startsWith(old.version.toUpperCase()) || !old.reference?.startsWith("PROJECT_ACCEPTANCE_ONLY:")) throw new Error("Owned TEST policy required");
      if (new ReportTemplates().policy(row.value)) return { changed: false };
      if (await tx.auditLog.count({ where: { action: { in: ["EXPORT_GENERATED", "GENERATION_FAILED"] }, newValue: { path: ["termId"], equals: termId } } })) throw new Error("Cannot revise templates after use");
      const at = new Date(performance.timeOrigin + performance.now()).toISOString(), version = old.version + "-reports-v2";
      const next = ReportPolicySchema.parse({ ...old, version, approvedAt: at, templates: old.templates.map(t => ({ ...t, version, columns: defaultColumns(t.code), approval: { ...t.approval, by: actorId, at, reference: old.reference } })) });
      if (!new ReportTemplates().policy(JSON.stringify(next))) throw new Error("Corrected templates do not satisfy runtime validation");
      await tx.termParameter.update({ where: { id: row.id }, data: { value: JSON.stringify(next) } });
      await tx.auditLog.create({ data: { userId: actorId, action: "PROJECT_ACCEPTANCE_REPORT_POLICY_REVISED", resource: "term", resourceId: termId, oldValue: { policy: old }, newValue: { policy: next, stagingOnly: true, reason: "Use renderer-supported columns exactly; no grade policy changed" } } });
      return { changed: true, version, approvedBy: actorId, approvedAt: at, productionConnected: false };
    }, { isolationLevel: "Serializable" });
  }
  async approve(context: Omit<AcceptanceContext, "approvedBy" | "approvedAt" | "reviewerCriteriaIds" | "committeeCriteriaIds">, actorId: string) {
    const target = new URL(process.env.DATABASE_URL ?? "");
    if (target.hostname !== "127.0.0.1" || !/^\/btl_pr2b_acceptance_[a-z0-9_]+$/.test(target.pathname))
      throw new Error("Acceptance approval is restricted to isolated local staging");
    return this.db.$transaction(async tx => {
      const actor = await tx.userAccount.findUnique({ where: { id: actorId }, include: { userRoles: { include: { role: true } } } });
      const term = await tx.thesisTerm.findUnique({ where: { id: context.termId } });
      const grant = await tx.academicTermGrant.findUnique({ where: { userId_termId: { userId: actorId, termId: context.termId } }, include: { pr2bGrantDepartmentGrantId: true } });
      if (!actor || actor.status !== "ACTIVE" || !actor.username.startsWith("acpt_") ||
          !actor.userRoles.some(r => r.role.name === "FACULTY") ||
          !term?.code.startsWith(context.runId.toUpperCase()) ||
          !grant || (!grant.allDepartments && !grant.pr2bGrantDepartmentGrantId.some(g => g.departmentId === context.departmentId)))
        throw new Error("Acceptance actor/term/department scope is invalid");
      if (await tx.termParameter.count({ where: { termId: term.id, key: { in: Array.from({length:9},(_,i)=>`UC${i+17}_POLICY`) } } }))
        throw new Error("Policies already exist: replacement requires a separate versioned review");
      const room = await tx.room.findUnique({ where: { id: context.roomId } });
      if (!room || !room.code.startsWith("ACPT-") || room.capacity < 10)
        throw new Error("Acceptance requires a dedicated TEST room");
      const reviewerCriteriaIds = Array.from({length:5},()=>randomUUID()), committeeCriteriaIds = Array.from({length:5},()=>randomUUID());
      // Approval records use wall time, even when later grading uses a simulated staging calendar.
      const approvedAt = new Date(performance.timeOrigin + performance.now()).toISOString();
      const bundle = buildAcceptancePolicies({ ...context, approvedBy: actor.id, approvedAt, reviewerCriteriaIds, committeeCriteriaIds });
      for (const c of [...bundle.policies.UC22_POLICY.rubric!.criteria, ...bundle.policies.UC23_POLICY.rubric.criteria])
        await tx.rubricCriteria.create({ data: { id: c.id, termId: term.id, name: c.name, description: "description" in c && typeof c.description === "string" ? c.description : null, weight: new Prisma.Decimal(c.weight), maxScore: c.maxScore } });
      for (const [key, value] of Object.entries(bundle.policies))
        await tx.termParameter.create({ data: { termId: term.id, key, value: JSON.stringify(value), description: "PROJECT_ACCEPTANCE_ONLY — technical assumptions; no faculty regulation asserted" } });
      await tx.termParameter.create({ data: { termId: term.id, key: "PROJECT_ACCEPTANCE", value: JSON.stringify({ runId: bundle.runId, policyHash: bundle.hash, approvedBy: actor.id, approvedAt: bundle.approval.at, approvalScope: "SYNTHETIC_STAGING_ONLY", facultyOfficialApproval: false }) } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "PROJECT_ACCEPTANCE_POLICIES_APPROVED", resource: "term", resourceId: term.id, newValue: { runId: bundle.runId, policyHash: bundle.hash, approvalScope: "SYNTHETIC_STAGING_ONLY", authenticatedTestActor: true, facultyOfficialApproval: false } } });
      return bundle;
    }, { isolationLevel: "Serializable", timeout: 30000 });
  }
  async repairUnscoredRubric(termId: string, actorId: string) {
    const target = new URL(process.env.DATABASE_URL ?? "");
    if (target.hostname !== "127.0.0.1" || !/^\/btl_pr2b_acceptance_[a-z0-9_]+$/.test(target.pathname))
      throw new Error("Rubric configuration repair is isolated staging only");
    return this.db.$transaction(async tx => {
      const actor = await tx.userAccount.findUnique({ where: { id: actorId }, include: { userRoles: { include: { role: true } } } });
      const term = await tx.thesisTerm.findUnique({ where: { id: termId } });
      const grant = await tx.academicTermGrant.findUnique({ where: { userId_termId: { userId: actorId, termId } } });
      if (!actor?.username.startsWith("acpt_") || actor.status !== "ACTIVE" || !actor.userRoles.some(r => r.role.name === "FACULTY") || !term?.code.startsWith("DATN-E2E-B1B10-TEST-") || !grant)
        throw new Error("TEST actor/term scope required");
      const proposals = await tx.proposal.findMany({ where: { termId }, select: { id: true } });
      if (await tx.scoreEntry.count({ where: { proposalId: { in: proposals.map(p => p.id) }, role: { in: ["REVIEWER", "COMMITTEE_MEMBER", "COMMITTEE_CHAIR"] } } }))
        throw new Error("Refuse rubric changes after a reviewer/committee sheet exists");
      const params = await tx.termParameter.findMany({ where: { termId, key: { in: ["UC22_POLICY", "UC23_POLICY"] } } });
      if (params.length !== 2) throw new Error("Expected two TEST rubric policies");
      const changes = [];
      for (const p of params) {
        const policy = p.key === "UC22_POLICY" ? ReviewerGradePolicySchema.parse(JSON.parse(p.value)) : CommitteeGradePolicySchema.parse(JSON.parse(p.value));
        if (!policy.version.startsWith("DATN-E2E-B1B10-TEST-") || policy.approvedBy !== actor.id || !term.code.startsWith(policy.version.toUpperCase()) || !policy.rubric) throw new Error("Not this actor's TEST policy");
        for (const c of policy.rubric.criteria) {
          const row = await tx.rubricCriteria.findUniqueOrThrow({ where: { id: c.id } });
          const weight = new Prisma.Decimal(c.weight), description = "description" in c && typeof c.description === "string" ? c.description : null;
          if (row.termId !== termId || row.name !== c.name || !row.maxScore.eq(c.maxScore) || (!row.weight.eq(weight) && !row.weight.eq(weight.mul(100))))
            throw new Error("Unexpected rubric contents; do not repair automatically");
          if (row.description !== null && row.description !== description) throw new Error("Unexpected rubric description");
          if (!row.weight.eq(weight) || row.description !== description) {
            await tx.rubricCriteria.update({ where: { id: row.id }, data: { weight, description } });
            changes.push({ id: row.id, before: { weight: row.weight.toString(), description: row.description }, after: { weight: weight.toString(), description } });
          }
        }
      }
      if (changes.length) await tx.auditLog.create({ data: { userId: actor.id, action: "PROJECT_ACCEPTANCE_RUBRIC_CONFIG_CORRECTED", resource: "term", resourceId: termId, newValue: { stagingOnly: true, reason: "Match actual UC22/UC23 reader contracts: fractional weights and exact descriptions", changes } } });
      return { termId, changed: changes.length, scoreRowsModified: 0, productionConnected: false };
    }, { isolationLevel: "Serializable", timeout: 30000 });
  }
}
