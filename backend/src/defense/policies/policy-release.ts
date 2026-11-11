import { createHash } from "crypto";
import { z } from "zod";
import {
  FinalDefensePolicySchema, EligibilityPolicySchema, CommitteePolicySchema,
  ReviewerPolicySchema, SchedulePolicySchema, ReviewerGradePolicySchema,
  CommitteeGradePolicySchema, FinalResultPolicySchema, ReportPolicySchema,
} from "@doan/shared";
import { FinalDefenseValidator } from "../../guidance/final-defense/final-defense.validator";
import { EligibilityValidator } from "../eligibility/eligibility.validator";
import { CommitteeValidator } from "../committees/committee.validator";
import { ReviewerValidator } from "../reviewers/reviewer.validator";
import { ScheduleValidator } from "../scheduling/schedule.validator";
import { ReviewerGradeValidator } from "../reviewer-grading/reviewer-grade.validator";
import { CommitteeGradeValidator } from "../committee-grading/committee-grade.validator";
import { ReportTemplates } from "../../report/defense-reporting/report-templates";
import { readRuntimeFinalResultPolicy } from "../../common/security/application-policy-runtime";

export const PolicySetSchema = z.object({
  UC17_POLICY: FinalDefensePolicySchema,
  UC18_POLICY: EligibilityPolicySchema,
  UC19_POLICY: CommitteePolicySchema,
  UC20_POLICY: ReviewerPolicySchema,
  UC21_POLICY: SchedulePolicySchema,
  UC22_POLICY: ReviewerGradePolicySchema,
  UC23_POLICY: CommitteeGradePolicySchema,
  UC24_POLICY: FinalResultPolicySchema,
  UC25_POLICY: ReportPolicySchema,
}).strict();
export type PolicySet = z.infer<typeof PolicySetSchema>;
export type PolicyKey = keyof PolicySet;
export const policyKeys = Object.keys(PolicySetSchema.shape) as PolicyKey[];

/** Canonical fingerprints bind the approval to every actual configuration value. */
export function policyReleaseHash(value: unknown): string {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, x]) => [k, canonical(x)]));
    return v;
  }
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

/** Fetch these facts independently from DB / the approved decision register.
 * They are NOT trusted merely because a configuration file contains them.
 */
export type PolicyReleaseFacts = {
  term: {
    id: string; code: string; status: string; departmentIds: string[];
    purpose: "OFFICIAL" | "INTEGRATION";
    phases: { code: string; startAt: string; endAt: string }[];
  };
  actor: { id: string; active: boolean; faculty: boolean; termGrant: boolean; departmentIds: string[] };
  approval: {
    status: "APPROVED" | "PENDING"; id: string; actorId: string;
    approvedAt: string; reference: string; termId: string; contentHash: string;
    purpose: "OFFICIAL" | "INTEGRATION";
  } | null;
  existing: { key: string; value: string }[];
  rubric: { id: string; termId: string; name: string; description: string | null; maxScore: string; weight: string }[];
  rooms: { id: string; capacity: number }[];
  // For an integration run, these must come from a verified ID manifest and DB joins.
  isolation: { verified: boolean; namespace: string; exclusiveAccounts: boolean; noOfficialRecords: boolean } | null;
};

export type PolicyReleasePlan = {
  ready: boolean; action: "INSERT_ONLY" | "NOOP" | "BLOCKED";
  termId: string; contentHash: string; snapshotHash: string;
  blockers: string[]; rows: { termId: string; key: PolicyKey; value: string }[];
};

/** Pure preflight; does not approve, connect, insert, enable flags or grant roles. */
export function preparePolicyRelease(raw: unknown, facts: PolicyReleaseFacts): PolicyReleasePlan {
  const blockers: string[] = [];
  const termId = facts.term.id, contentHash = policyReleaseHash({ termId, policies: raw });
  const snapshotHash = policyReleaseHash(facts);
  const parsed = PolicySetSchema.safeParse(raw);
  const done = (action: PolicyReleasePlan["action"], rows: PolicyReleasePlan["rows"] = []): PolicyReleasePlan => ({
    ready: !blockers.length, action: blockers.length ? "BLOCKED" : action,
    termId, contentHash, snapshotHash, blockers: [...new Set(blockers)], rows: blockers.length ? [] : rows,
  });
  if (!parsed.success) {
    blockers.push(...parsed.error.issues.map(i => `CONTRACT:${i.path.join(".")}`));
    return done("BLOCKED");
  }
  const p = parsed.data;
  if (policyReleaseHash({ termId, policies: p }) !== contentHash)
    blockers.push("POLICY_NORMALIZATION_REQUIRES_REVIEW");
  // No acceptance producer/technical example becomes a production decision by renaming status.
  if (/PROJECT_ACCEPTANCE|DATN-E2E-B1B10-TEST|\bTEST_ONLY\b|PENDING_APPROVAL/i.test(JSON.stringify(p)))
    blockers.push("ACCEPTANCE_OR_PENDING_CONFIGURATION");
  if (!termId || !facts.term.departmentIds.length || new Set(facts.term.departmentIds).size !== facts.term.departmentIds.length)
    blockers.push("TERM_DEPARTMENT_SCOPE_REQUIRED");
  if (new Set(facts.term.phases.map(x => x.code)).size !== facts.term.phases.length)
    blockers.push("DUPLICATE_PLAN_PHASE");
  if (new Set(facts.rubric.map(x => x.id)).size !== facts.rubric.length)
    blockers.push("DUPLICATE_DATABASE_RUBRIC");
  if (["LOCKED", "ARCHIVED", "CLOSED"].includes(facts.term.status)) blockers.push("TERM_NOT_WRITABLE");
  if (!facts.actor.active || !facts.actor.faculty || !facts.actor.termGrant ||
      facts.term.departmentIds.some(d => !facts.actor.departmentIds.includes(d)))
    blockers.push("APPROVER_TERM_DEPARTMENT_SCOPE_REQUIRED");
  const a = facts.approval;
  if (!a || a.status !== "APPROVED" || !a.id.trim() || !a.reference.trim() ||
      a.actorId !== facts.actor.id || a.termId !== termId || a.contentHash !== contentHash ||
      a.purpose !== facts.term.purpose || !Number.isFinite(Date.parse(a.approvedAt)) || Date.parse(a.approvedAt) > Date.now())
    blockers.push("VERIFIED_APPROVAL_FOR_EXACT_BUNDLE_REQUIRED");
  if (a && policyKeys.some(k => p[k].approvedBy !== a.actorId || p[k].approvedAt !== a.approvedAt))
    blockers.push("POLICY_APPROVAL_IDENTITY_OR_TIME_MISMATCH");
  if (facts.term.purpose === "INTEGRATION" && (!facts.isolation?.verified ||
      !facts.isolation.namespace.startsWith("DATN-INTEGRATION-") ||
      !facts.term.code.startsWith(facts.isolation.namespace) ||
      !facts.isolation.exclusiveAccounts || !facts.isolation.noOfficialRecords))
    blockers.push("INTEGRATION_ISOLATION_NOT_VERIFIED");

  const readers = [
    ["UC17_POLICY", new FinalDefenseValidator()], ["UC18_POLICY", new EligibilityValidator()],
    ["UC19_POLICY", new CommitteeValidator()], ["UC20_POLICY", new ReviewerValidator()],
    ["UC21_POLICY", new ScheduleValidator()], ["UC22_POLICY", new ReviewerGradeValidator()],
    ["UC23_POLICY", new CommitteeGradeValidator()], ["UC25_POLICY", new ReportTemplates()],
  ] as const;
  for (const [key, reader] of readers)
    if (!reader.policy(JSON.stringify(p[key]))) blockers.push(`RUNTIME_REJECTED:${key}`);
  try { readRuntimeFinalResultPolicy(p.UC24_POLICY); } catch { blockers.push("RUNTIME_REJECTED:UC24_POLICY"); }

  const phase = (code: string) => facts.term.phases.find(x => x.code === code);
  const within = (code: string, start: string, end: string) => {
    const w = phase(code), from = Date.parse(start), until = Date.parse(end);
    return !!w && from < until && from >= Date.parse(w.startAt) && until <= Date.parse(w.endAt);
  };
  for (const code of ["FINAL", "DEFENSE", p.UC18_POLICY.phaseCode, p.UC19_POLICY.phaseCode, p.UC20_POLICY.phaseCode, p.UC21_POLICY.phaseCode, p.UC22_POLICY.phaseCode])
    if (!phase(code) || !Number.isFinite(Date.parse(phase(code)!.startAt)) ||
        !Number.isFinite(Date.parse(phase(code)!.endAt)) ||
        Date.parse(phase(code)!.startAt) >= Date.parse(phase(code)!.endAt)) blockers.push(`PHASE_REQUIRED:${code}`);
  const cg = p.UC23_POLICY;
  if (!cg.effectiveUntil || !within("DEFENSE", cg.effectiveFrom, cg.effectiveUntil)) blockers.push("UC23_WINDOW_OUTSIDE_PLAN");
  for (const key of ["finalizeWindow", "publication"] as const) {
    const w = p.UC24_POLICY[key];
    if (!within(w.phaseCode, w.notBefore, w.before)) blockers.push(`UC24_WINDOW_OUTSIDE_PLAN:${key}`);
  }
  for (const date of p.UC21_POLICY.allowedDates) {
    const morning = `${date}T${p.UC21_POLICY.periods.MORNING.start}:00+07:00`;
    const afternoon = `${date}T${p.UC21_POLICY.periods.AFTERNOON.end}:00+07:00`;
    if (!within(p.UC21_POLICY.phaseCode, morning, afternoon)) blockers.push("UC21_DATE_OUTSIDE_PLAN");
  }
  const schedulePhase = phase(p.UC21_POLICY.phaseCode);
  if (!schedulePhase || Date.parse(p.UC21_POLICY.publishNotBefore) >= Date.parse(schedulePhase.endAt))
    blockers.push("UC21_PUBLICATION_AFTER_PHASE");
  if (Date.parse(p.UC24_POLICY.publication.before) <= Date.parse(p.UC24_POLICY.finalizeWindow.notBefore))
    blockers.push("UC24_PUBLICATION_ENDS_BEFORE_FINALIZATION");
  for (const t of p.UC25_POLICY.templates) {
    if (t.status !== "APPROVED" || !t.approval || !t.effectiveFrom || !t.effectiveUntil ||
        Date.parse(t.effectiveFrom) >= Date.parse(t.effectiveUntil)) blockers.push(`UC25_TEMPLATE_APPROVAL_OR_WINDOW:${t.code}`);
    if (t.approval && (!Number.isFinite(Date.parse(t.approval.at)) || Date.parse(t.approval.at) > Date.now()))
      blockers.push(`UC25_TEMPLATE_APPROVAL_TIME:${t.code}`);
  }
  for (const access of p.UC21_POLICY.roomAccess)
    if (!facts.rooms.some(r => r.id === access.roomId && r.capacity >= p.UC21_POLICY.minRoomCapacity) ||
        access.departmentIds.some(d => !facts.term.departmentIds.includes(d))) blockers.push("UC21_ROOM_SCOPE_OR_CAPACITY_MISMATCH");
  for (const [key, rubric] of [["UC22_POLICY", p.UC22_POLICY.rubric], ["UC23_POLICY", p.UC23_POLICY.rubric]] as const)
    for (const c of rubric?.criteria ?? []) {
      const row = facts.rubric.find(r => r.id === c.id);
      if (!row || row.termId !== termId || row.name !== c.name || Number(row.maxScore) !== Number(c.maxScore) ||
          Number(row.weight) !== Number(c.weight) || (key === "UC23_POLICY" && row.description !== ("description" in c ? c.description : null)))
        blockers.push(`RUBRIC_DATABASE_BINDING_MISMATCH:${key}`);
    }
  if (p.UC24_POLICY.committeeAggregate.mode === "ROLE_WEIGHTED" &&
      p.UC24_POLICY.committeeAggregate.weights.some(w => !p.UC23_POLICY.gradingRoles.includes(w.role)))
    blockers.push("UC24_WEIGHTED_ROLE_NOT_GRADED");
  if (p.UC24_POLICY.confirmation.roles.some(r => !p.UC23_POLICY.gradingRoles.includes(r)))
    blockers.push("UC24_CONFIRMATION_ROLE_NOT_GRADED");
  const existing = facts.existing.filter(e => policyKeys.includes(e.key as PolicyKey));
  if (existing.length) {
    const identical = existing.length === policyKeys.length && new Set(existing.map(e => e.key)).size === policyKeys.length &&
      existing.every(e => { try { return policyReleaseHash(JSON.parse(e.value)) === policyReleaseHash(p[e.key as PolicyKey]); } catch { return false; } });
    if (!identical) blockers.push("EXISTING_POLICY_REQUIRES_SEPARATE_VERSIONED_REVIEW");
    return done("NOOP");
  }
  return done("INSERT_ONLY", policyKeys.map(key => ({ termId, key, value: JSON.stringify(p[key]) })));
}
