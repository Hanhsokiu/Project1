import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { buildAcceptancePolicies } from "../../acceptance/policy-bundle";
import { preparePolicyRelease, policyKeys, policyReleaseHash, PolicySetSchema } from "./policy-release";
import type { PolicyReleaseFacts, PolicySet } from "./policy-release";
import { applicationPolicyRuntimeAllowed, readRuntimeFinalResultPolicy } from "../../common/security/application-policy-runtime";
import { FinalDefenseValidator } from "../../guidance/final-defense/final-defense.validator";
import { EligibilityValidator } from "../eligibility/eligibility.validator";
import { CommitteeValidator } from "../committees/committee.validator";
import { ReviewerValidator } from "../reviewers/reviewer.validator";
import { ScheduleValidator } from "../scheduling/schedule.validator";
import { ReviewerGradeValidator } from "../reviewer-grading/reviewer-grade.validator";
import { CommitteeGradeValidator } from "../committee-grading/committee-grade.validator";
import { ReportTemplates } from "../../report/defense-reporting/report-templates";
import { createOfficialPolicyDraft, officialPolicyDraftSummary, unresolvedPolicyFields } from "./policy-draft";
import { readFileSync } from "fs";
import { resolve } from "path";

// Synthetic unit fixtures never connect, insert or constitute an approval record.
function fixture(acceptance = false) {
  const termId = randomUUID(), departmentId = randomUUID(), roomId = randomUUID(), actorId = randomUUID();
  const runId = "DATN-E2E-B1B10-TEST-policy-unit";
  const source = buildAcceptancePolicies({
    runId, termId, departmentId, roomId, approvedBy: actorId,
    approvedAt: new Date(Date.now() - 60000).toISOString(),
    startAt: "2020-01-01T00:00:00Z", endAt: "2035-01-01T00:00:00Z", defenseDate: "2030-01-02",
    reviewerCriteriaIds: Array.from({ length: 5 }, () => randomUUID()),
    committeeCriteriaIds: Array.from({ length: 5 }, () => randomUUID()),
  }).policies;
  const policies: PolicySet = acceptance ? source : JSON.parse(JSON.stringify(source)
    .replaceAll(runId, "unit-v1")
    .replaceAll("PROJECT_ACCEPTANCE_ONLY", "UNIT_REFERENCE")
    .replaceAll("PROJECT_ACCEPTANCE_TEST", "UNIT_OWNER"));
  const facts: PolicyReleaseFacts = {
    term: { id: termId, code: "UNIT-TERM", status: "IN_PROGRESS", purpose: "OFFICIAL", departmentIds: [departmentId],
      phases: [{ code: "FINAL", startAt: "2019-01-01T00:00:00Z", endAt: "2020-01-01T00:00:00Z" },
        { code: "DEFENSE", startAt: "2020-01-01T00:00:00Z", endAt: "2035-01-01T00:00:00Z" }] },
    actor: { id: actorId, active: true, faculty: true, termGrant: true, departmentIds: [departmentId] },
    approval: { status: "APPROVED", id: "unit-decision", actorId, termId, purpose: "OFFICIAL", reference: "UNIT EVIDENCE ONLY",
      approvedAt: policies.UC17_POLICY.approvedAt, contentHash: policyReleaseHash({ termId, policies }) },
    existing: [], rooms: [{ id: roomId, capacity: 30 }], isolation: null,
    rubric: [...policies.UC22_POLICY.rubric!.criteria, ...policies.UC23_POLICY.rubric.criteria].map(c => ({
      id: c.id, termId, name: c.name, maxScore: c.maxScore, weight: c.weight,
      description: "description" in c ? c.description as string : null,
    })),
  };
  return { policies, facts };
}
function bind(f: ReturnType<typeof fixture>) {
  f.facts.approval!.contentHash = policyReleaseHash({ termId: f.facts.term.id, policies: f.policies });
  return f;
}

describe("production application policy release", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://unit@db.invalid/postgres");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("prepares exactly nine term-bound insert-only rows with the real runtime readers", () => {
    const f = fixture(), plan = preparePolicyRelease(f.policies, f.facts);
    expect(plan.blockers).toEqual([]);
    expect(plan.action).toBe("INSERT_ONLY");
    expect(plan.rows.map(r => r.key)).toEqual(policyKeys);
    expect(plan.rows.every(r => r.termId === f.facts.term.id)).toBe(true);
    expect(plan.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("never invents approval or lets a renamed status promote acceptance settings", () => {
    const f = fixture(); f.facts.approval = null;
    expect(preparePolicyRelease(f.policies, f.facts)).toMatchObject({ ready: false, rows: [] });
    const a = fixture(true);
    expect(preparePolicyRelease(a.policies, a.facts).blockers).toContain("ACCEPTANCE_OR_PENDING_CONFIGURATION");
  });
  it("binds approval to exact term, actor, purpose, timestamp and every body field", () => {
    const cases = [
      (f: ReturnType<typeof fixture>) => { f.facts.approval!.termId = randomUUID(); },
      (f: ReturnType<typeof fixture>) => { f.facts.approval!.actorId = randomUUID(); },
      (f: ReturnType<typeof fixture>) => { f.facts.approval!.purpose = "INTEGRATION"; },
      (f: ReturnType<typeof fixture>) => { f.facts.approval!.approvedAt = "2099-01-01T00:00:00Z"; },
      (f: ReturnType<typeof fixture>) => { f.policies.UC17_POLICY.scoreStep = 0.5; },
    ];
    for (const change of cases) { const f = fixture(); change(f); expect(preparePolicyRelease(f.policies, f.facts).ready).toBe(false); }
  });
  it("never persists a trimmed body different from the hash that was approved", () => {
    const f = fixture(); f.policies.UC17_POLICY.version = ` ${f.policies.UC17_POLICY.version} `; bind(f);
    expect(preparePolicyRelease(f.policies, f.facts).blockers).toContain("POLICY_NORMALIZATION_REQUIRES_REVIEW");
    expect(preparePolicyRelease(f.policies, f.facts).rows).toEqual([]);
  });
  it("requires active FACULTY, the actual term grant and every department", () => {
    for (const patch of [{ active: false }, { faculty: false }, { termGrant: false }, { departmentIds: [] }]) {
      const f = fixture(); Object.assign(f.facts.actor, patch);
      expect(preparePolicyRelease(f.policies, f.facts).blockers).toContain("APPROVER_TERM_DEPARTMENT_SCOPE_REQUIRED");
    }
  });
  it("detects DB rubric ownership/metadata drift and room scope/capacity failures", () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => { f.facts.rubric[0].termId = randomUUID(); },
      (f: ReturnType<typeof fixture>) => { f.facts.rubric[5].description = "drift"; },
      (f: ReturnType<typeof fixture>) => { f.facts.rooms[0].capacity = 1; },
      (f: ReturnType<typeof fixture>) => { f.policies.UC21_POLICY.roomAccess[0].departmentIds = [randomUUID()]; bind(f); },
    ]) { const f = fixture(); change(f); expect(preparePolicyRelease(f.policies, f.facts).ready).toBe(false); }
  });
  it("checks UTC phase windows and Vietnam schedule dates without changing business status", () => {
    const f = fixture(), before = JSON.stringify(f.facts.term);
    f.policies.UC21_POLICY.allowedDates = ["2036-01-02"];
    f.policies.UC24_POLICY.finalizeWindow.before = "2036-01-01T00:00:00Z";
    f.policies.UC23_POLICY.effectiveUntil = null; bind(f);
    const plan = preparePolicyRelease(f.policies, f.facts);
    expect(plan.blockers).toEqual(expect.arrayContaining(["UC21_DATE_OUTSIDE_PLAN", "UC24_WINDOW_OUTSIDE_PLAN:finalizeWindow", "UC23_WINDOW_OUTSIDE_PLAN"]));
    expect(JSON.stringify(f.facts.term)).toBe(before);
  });
  it("rejects unresolved choices and runtime-invalid grading precision/weights", () => {
    const f = fixture(); f.policies.UC20_POLICY.committeeMembership = "PENDING_APPROVAL"; bind(f);
    expect(preparePolicyRelease(f.policies, f.facts).blockers).toContain("ACCEPTANCE_OR_PENDING_CONFIGURATION");
    const g = fixture(); g.policies.UC23_POLICY.rubric.criteria[0].weight = "0.25"; bind(g);
    expect(preparePolicyRelease(g.policies, g.facts).blockers).toContain("RUNTIME_REJECTED:UC23_POLICY");
  });
  it("is idempotent for identical rows and never overwrites an existing version", () => {
    const f = fixture();
    f.facts.existing = policyKeys.map(key => ({ key, value: JSON.stringify(f.policies[key]) }));
    expect(preparePolicyRelease(f.policies, f.facts)).toMatchObject({ ready: true, action: "NOOP", rows: [] });
    f.facts.existing[0].value = "{}";
    expect(preparePolicyRelease(f.policies, f.facts).blockers).toContain("EXISTING_POLICY_REQUIRES_SEPARATE_VERSIONED_REVIEW");
    f.facts.existing.pop();
    expect(preparePolicyRelease(f.policies, f.facts).ready).toBe(false);
  });
  it("does not accept a mere integration namespace as isolation evidence", () => {
    const f = fixture(); f.facts.term.purpose = "INTEGRATION"; f.facts.approval!.purpose = "INTEGRATION";
    expect(preparePolicyRelease(f.policies, f.facts).blockers).toContain("INTEGRATION_ISOLATION_NOT_VERIFIED");
    const namespace = "DATN-INTEGRATION-unit"; f.facts.term.code = namespace;
    f.facts.isolation = { namespace, verified: true, exclusiveAccounts: true, noOfficialRecords: true };
    expect(preparePolicyRelease(f.policies, f.facts).ready).toBe(true);
  });
  it("rejects missing, unknown and DRAFT policies without filling academic defaults", () => {
    const f = fixture();
    expect(PolicySetSchema.safeParse({ ...f.policies, UC26_POLICY: {} }).success).toBe(false);
    expect(preparePolicyRelease({ ...f.policies, UC17_POLICY: { ...f.policies.UC17_POLICY, status: "DRAFT" } }, f.facts).rows).toEqual([]);
    expect(preparePolicyRelease({ ...f.policies, UC25_POLICY: undefined }, f.facts).ready).toBe(false);
  });
  it("ships a complete nine-policy DRAFT without invented approval or academic defaults", () => {
    const summary = officialPolicyDraftSummary(), draft = createOfficialPolicyDraft();
    expect(Object.keys(draft.policies)).toEqual(policyKeys);
    expect(JSON.parse(readFileSync(resolve(__dirname, "../../../prisma/deployment/application-policies/draft.template.json"), "utf8"))).toEqual(draft);
    expect(summary.runtimeValid).toBe(false);
    expect(summary.unresolved).toContain("policies.UC24_POLICY.components.0.weight");
    expect(summary.unresolved).toContain("policies.UC17_POLICY.scoreStep");
    expect(policyKeys.every(k => draft.policies[k].status === "DRAFT" && draft.policies[k].approvedBy === null)).toBe(true);
    expect(unresolvedPolicyFields({ nullableChoice: null })).toEqual(["nullableChoice"]);
    const f = fixture(); expect(preparePolicyRelease(draft.policies, f.facts).ready).toBe(false);
  });
  it("rejects malformed/ambiguous plan phases and database rubric identities", () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => { f.facts.term.phases[0].startAt = "not-a-time"; },
      (f: ReturnType<typeof fixture>) => { f.facts.term.phases.push(f.facts.term.phases[0]); },
      (f: ReturnType<typeof fixture>) => { f.facts.rubric.push(f.facts.rubric[0]); },
    ]) { const f = fixture(); change(f); expect(preparePolicyRelease(f.policies, f.facts).ready).toBe(false); }
  });
  it("rejects impossible publication ordering and expired/unapproved report template windows", () => {
    const f = fixture(); f.policies.UC24_POLICY.finalizeWindow.notBefore = "2032-01-01T00:00:00Z";
    f.policies.UC24_POLICY.publication.before = "2031-01-01T00:00:00Z"; bind(f);
    expect(preparePolicyRelease(f.policies, f.facts).blockers).toContain("UC24_PUBLICATION_ENDS_BEFORE_FINALIZATION");
    const g = fixture(); g.policies.UC25_POLICY.templates[0].effectiveUntil = g.policies.UC25_POLICY.templates[0].effectiveFrom; bind(g);
    expect(preparePolicyRelease(g.policies, g.facts).blockers).toContain(`UC25_TEMPLATE_APPROVAL_OR_WINDOW:${g.policies.UC25_POLICY.templates[0].code}`);
  });
  it("compares report template instants in UTC rather than ISO string ordering", () => {
    const f = fixture(), t = f.policies.UC25_POLICY.templates[0];
    t.effectiveFrom = "2030-01-02T00:00:00+07:00";
    t.effectiveUntil = "2030-01-01T18:00:00Z";
    expect(new ReportTemplates().policy(JSON.stringify(f.policies.UC25_POLICY))).not.toBeNull();
    t.effectiveUntil = "2030-01-01T16:00:00Z";
    expect(new ReportTemplates().policy(JSON.stringify(f.policies.UC25_POLICY))).toBeNull();
  });
});

describe("TEST policy runtime isolation at all nine readers", () => {
  afterEach(() => vi.unstubAllEnvs());
  function readers(p: PolicySet) {
    return [
      new FinalDefenseValidator().policy(JSON.stringify(p.UC17_POLICY)),
      new EligibilityValidator().policy(JSON.stringify(p.UC18_POLICY)),
      new CommitteeValidator().policy(JSON.stringify(p.UC19_POLICY)),
      new ReviewerValidator().policy(JSON.stringify(p.UC20_POLICY)),
      new ScheduleValidator().policy(JSON.stringify(p.UC21_POLICY)),
      new ReviewerGradeValidator().policy(JSON.stringify(p.UC22_POLICY)),
      new CommitteeGradeValidator().policy(JSON.stringify(p.UC23_POLICY)),
      (() => { try { return readRuntimeFinalResultPolicy(p.UC24_POLICY); } catch { return null; } })(),
      new ReportTemplates().policy(JSON.stringify(p.UC25_POLICY)),
    ];
  }
  it("denies every TEST policy on production even with a loopback URL", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DATABASE_URL", "postgresql://unit@127.0.0.1/btl_pr2b_acceptance_unit");
    expect(readers(fixture(true).policies)).toEqual(Array(9).fill(null));
  });
  it("denies every TEST policy on a shared database even if NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("DATABASE_URL", "postgresql://unit@db.invalid/postgres");
    expect(readers(fixture(true).policies)).toEqual(Array(9).fill(null));
  });
  it("keeps the verified loopback acceptance runner compatible", () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("DATABASE_URL", "postgresql://unit@127.0.0.1/btl_pr2b_acceptance_unit");
    expect(readers(fixture(true).policies).every(Boolean)).toBe(true);
  });
  it("does not use malformed URLs or NODE_ENV alone as proof of isolation", () => {
    const p = fixture(true).policies.UC17_POLICY;
    for (const url of ["invalid", "postgresql://unit@localhost/postgres", "postgresql://unit@127.0.0.1/postgres"]) {
      expect(applicationPolicyRuntimeAllowed(p, { NODE_ENV: "test", DATABASE_URL: url })).toBe(false);
    }
  });
});
