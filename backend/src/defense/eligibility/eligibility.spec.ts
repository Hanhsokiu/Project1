import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnvironment } from "../../config/environment";
import {
  AcademicAttestationInputSchema,
  EligibilityFinalizeSchema,
  EligibilityPolicySchema,
  EligibilityReviewSchema,
} from "@doan/shared";
import {
  createEligibilityFixture,
  memberId,
  academicInput,
  configureStrictEligibilityProgress,
} from "../../../test/eligibility.fixture";
import { ids, syntheticFile } from "../../../test/final-defense.fixture";
import { evaluateEligibility } from "./eligibility.validator";

let f: Awaited<ReturnType<typeof createEligibilityFixture>>;
beforeEach(async () => {
  f = await createEligibilityFixture();
});
const fail = (code: string) => ({ response: { error: { code } } });
const expected = (v: Awaited<ReturnType<typeof f.detail>>) => ({
  termId: ids.term,
  expectedRevision: v.revision,
  evidenceHash: v.evidenceHash,
});
describe("UC18 service integration with real UC17 producer and isolated transaction/storage adapters", () => {
  it.each(["FAIL", "REVISION_REQUIRED"])(
    "classifies a valid current progress %s separately from missing evidence",
    async (decision) => {
      f.policy.progressRule = "ALL_ACTIVE_TASKS_PASSED";
      const progress = configureStrictEligibilityProgress(f.session);
      progress.task.pr2bTaskWorkflowTaskId.state = "REVISION_REQUESTED";
      progress.review.decision = decision;
      await f.review();
      expect(
        (await f.detail()).checks.find((c) => c.key === "progress")?.state,
      ).toBe(decision === "FAIL" ? "NEGATIVE" : "PENDING");
    },
  );
  it("marks an unchanged finalized row stale when its academic evidence naturally expires", async () => {
    await f.review();
    await f.decide();
    await f.finalize();
    const rowBefore = structuredClone(f.state.row);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2100-01-01T00:00:00Z"));
      const v = await f.detail();
      expect(v.official.state).toBe("STALE");
      expect(v.downstream).toBeNull();
      expect(f.state.row).toEqual(rowBefore);
    } finally {
      vi.useRealTimers();
    }
  });
  it("does not accept bound-looking UC17 rows without matching summary provenance/context", async () => {
    f.f.state.score!.context = null;
    expect((await f.detail()).uc17).toBe("STALE");
  });
  it("evaluates strict UC14–UC16 progress using effective reviews, current plan and exact weekly coverage", async () => {
    f.policy.progressRule = "ALL_ACTIVE_TASKS_PASSED";
    const progress = configureStrictEligibilityProgress(f.session);
    await f.review();
    expect((await f.detail()).preview).toBe("QUALIFIED");
    await f.decide();
    await f.finalize();
    expect((await f.detail()).downstream).not.toBeNull();
    progress.review.revision++;
    expect((await f.detail()).official.state).toBe("STALE");
    expect((await f.detail()).downstream).toBeNull();
  });
  it.each([
    "missing-coverage",
    "wrong-reviewer",
    "legacy-submission",
    "stale-config",
    "not-pass",
  ])("blocks strict progress with %s", async (variant) => {
    f.policy.progressRule = "ALL_ACTIVE_TASKS_PASSED";
    const p = configureStrictEligibilityProgress(f.session);
    if (variant === "missing-coverage")
      f.session.eligibilityCoverage = (async () => [
        { periodId: "another-week" },
      ]) as unknown as typeof f.session.eligibilityCoverage;
    if (variant === "wrong-reviewer") p.review.reviewerUserId = ids.outsider;
    if (variant === "legacy-submission")
      p.submission.pr2bSubmissionWorkflowSubmissionId.state = "SUPERSEDED";
    if (variant === "stale-config") p.obligation.configRevision++;
    if (variant === "not-pass") p.review.decision = "FAIL";
    await f.review();
    expect(
      (await f.detail()).checks.find((c) => c.key === "progress")?.state,
    ).toBe("MISSING");
    await expect(f.decide()).rejects.toMatchObject(fail("NOT_QUALIFIED"));
  });
  it("invalidates a finalized roster when academic evidence expires or faculty audit is missing", async () => {
    await f.review();
    await f.decide();
    await f.finalize();
    const context = f.state.row!.context as unknown as {
      academic: { evidence: { validUntil: string } };
    };
    context.academic.evidence.validUntil = "2020-02-01T00:00:00Z";
    expect((await f.detail()).official.state).toBe("STALE");
    expect((await f.detail()).downstream).toBeNull();
    f.state.events.splice(0);
    expect((await f.detail()).downstream).toBeNull();
  });
  it("keeps GET read-only and UC17 CONFIRMED separate from faculty approval", async () => {
    const v = await f.detail();
    expect(v.uc17).toBe("CONFIRMED");
    expect(v.preview).toBe("UNVERIFIED");
    expect(v.official.state).toBe("NONE");
    expect(v.downstream).toBeNull();
    expect(v.checks.find((c) => c.key === "academic")?.state).toBe(
      "UNVERIFIED",
    );
    expect(f.state.row).toBeNull();
    expect(f.state.events).toHaveLength(0);
    expect(f.state.replay.size).toBe(0);
  });
  it("reviews verified academics, decides explicitly, finalizes, and exports only current provenance", async () => {
    await f.review();
    const preview = await f.detail();
    expect(preview.preview).toBe("QUALIFIED");
    expect(preview.official.state).toBe("REVIEWED");
    expect(preview.downstream).toBeNull();
    await f.decide();
    expect((await f.detail()).official.state).toBe("DECIDED");
    expect((await f.detail()).downstream).toBeNull();
    await f.finalize();
    const final = await f.detail();
    expect(final.downstream).toMatchObject({
      termId: ids.term,
      termStudentId: memberId,
      proposalId: ids.proposal,
      revision: 3,
      approvedBy: ids.faculty,
      finalizedBy: ids.faculty,
      policyVersion: f.policy.version,
      effectiveStatus: "CURRENT",
    });
    expect(final.history).toHaveLength(3);
    expect(final.actionBlockers.review).toContain("ELIGIBILITY_FINALIZED");
  });
  it.each(["missing", "rejected", "stale", "legacy", "audit-missing"])(
    "does not qualify %s UC17 evidence",
    async (variant) => {
      await f.review();
      if (variant === "missing") f.f.state.decision = null;
      if (variant === "rejected")
        await f.f.service.confirm(
          ids.lecturer,
          ids.proposal,
          {
            expectedRevision: 3,
            reportVersionId: f.f.state.report!.versions[0].id,
            status: "REJECTED",
            reason: "Synthetic refusal",
          },
          "reject",
        );
      if (variant === "stale")
        f.f.assignment.pr2bAssignmentChangeAssignmentId.push({
          assignmentRevision: 1,
          newAdvisorId: "official-advisor",
          effectiveAt: new Date(Date.now() - 1000),
        });
      if (variant === "legacy") f.f.state.decision!.reportVersionId = null;
      if (variant === "audit-missing") f.f.state.events.splice(0);
      const v = await f.detail();
      expect(v.preview).not.toBe("QUALIFIED");
      expect(v.downstream).toBeNull();
      expect(v.checks.find((c) => c.key === "uc17")?.state).not.toBe(
        "QUALIFIED",
      );
      await expect(f.decide()).rejects.toBeDefined();
    },
  );
  it.each(["missing-bytes", "checksum", "wrong-owner", "quarantined"])(
    "rejects invalid final PDF: %s",
    async (variant) => {
      const asset = [...f.f.state.assets.values()][0];
      if (variant === "missing-bytes") f.f.bytes.clear();
      if (variant === "checksum")
        f.f.bytes.set(asset.storageKey, Buffer.from("invalid"));
      if (variant === "wrong-owner") asset.createdByUserId = ids.outsider;
      if (variant === "quarantined") asset.state = "QUARANTINED";
      const v = await f.detail();
      expect(v.pdf).toBe("UNVERIFIED");
      expect(v.preview).not.toBe("QUALIFIED");
    },
  );
  it("rejects unfinalized dossier and invalid topic ownership", async () => {
    f.control.dossierFinalized = false;
    expect(
      (await f.detail()).checks.find((c) => c.key === "dossier")?.state,
    ).toBe("STALE");
    f.f.p.topic.pr2bTopicWorkflowTopicId!.refTermStudentId!.studentId =
      "other-student";
    expect(
      (await f.detail()).checks.find((c) => c.key === "advisor")?.state,
    ).toBe("STALE");
  });
  it("does not substitute academicEligible or GPA for an authority and requires negative evidence for refusal", async () => {
    f.student.academicEligible = false;
    f.student.gpa = 0;
    expect(
      (await f.detail()).checks.find((c) => c.key === "academic")?.state,
    ).toBe("UNVERIFIED");
    await f.review({ ...academicInput, outcome: "FAIL" });
    expect((await f.detail()).preview).toBe("NEGATIVE");
    await expect(f.decide()).rejects.toMatchObject(fail("NOT_QUALIFIED"));
    await f.decide("INELIGIBLE");
    expect((await f.detail()).official.status).toBe("INELIGIBLE");
    await expect(f.finalize()).rejects.toMatchObject(
      fail("ELIGIBILITY_BLOCKED"),
    );
  });
  it("permits audited deferral for missing evidence without manufacturing eligibility", async () => {
    const v = await f.detail();
    await f.service.reviewDossier(
      ids.faculty,
      memberId,
      { ...expected(v), reason: "Academic evidence pending" },
      "review-pending",
    );
    await f.decide("DEFERRED");
    expect((await f.detail()).official.status).toBe("DEFERRED");
    expect((await f.detail()).downstream).toBeNull();
  });
  it("invalidates downstream on a later PDF, changed policy, or expired academic source", async () => {
    await f.review();
    await f.decide();
    await f.finalize();
    expect((await f.detail()).downstream).not.toBeNull();
    await f.f.service.upload(
      ids.student,
      ids.proposal,
      3,
      syntheticFile(),
      "replacement",
    );
    expect((await f.detail()).downstream).toBeNull();
    f.policy.version = "synthetic-only-v2";
    expect((await f.detail()).official.state).toBe("STALE");
  });
  it.each([
    "schema",
    "uc17-schema",
    "policy",
    "writes",
    "locked",
    "expired-window",
  ])("blocks production writes when %s unavailable", async (variant) => {
    if (variant === "schema") f.control.schema = false;
    if (variant === "uc17-schema") f.f.control.schemaReady = false;
    if (variant === "policy") f.control.policy = false;
    if (variant === "writes") f.control.writes = false;
    if (variant === "locked") f.f.control.locked = true;
    if (variant === "expired-window")
      f.f.term.phases[0].endDate = new Date(Date.now() - 1000);
    await expect(f.review()).rejects.toMatchObject(fail("ELIGIBILITY_BLOCKED"));
    expect(f.state.row).toBeNull();
    expect(f.state.events).toHaveLength(0);
  });
  it("protects own student/advisor scope and never grants ADMIN an academic bypass", async () => {
    const student = await f.service.detail(ids.student, memberId, ids.term);
    expect(student.advisorSummary).toEqual({});
    expect(student.academic).toBeNull();
    expect(student.history).toEqual([]);
    await expect(
      f.service.detail(ids.admin, memberId, ids.term),
    ).rejects.toMatchObject(fail("COMMON_001"));
    await expect(
      f.service.detail(ids.outsider, memberId, ids.term),
    ).rejects.toMatchObject(fail("COMMON_001"));
    await expect(
      f.service.detail(ids.faculty, memberId, "other-term"),
    ).rejects.toMatchObject(fail("COMMON_001"));
    f.f.control.facultyDepartment = "other-department";
    await expect(f.detail()).rejects.toMatchObject(fail("COMMON_001"));
  });
  it("denies writes without the faculty-bound permission, even when a second role has it", async () => {
    const u = f.f.users.get(ids.faculty)!;
    u.userRoles[0].role.rolePermissions =
      u.userRoles[0].role.rolePermissions.filter(
        (p) => p.permission.action !== "review",
      );
    u.userRoles.push({
      role: {
        name: "ADMIN",
        rolePermissions: [
          { permission: { resource: "defense-eligibility", action: "review" } },
        ],
      },
    } as (typeof u.userRoles)[number]);
    await expect(f.review()).rejects.toMatchObject(fail("AUTH_004"));
  });
  it("replays idempotently, rejects payload changes, and rechecks scope on replay", async () => {
    const v = await f.detail(),
      body = {
        ...expected(v),
        reason: "Synthetic review",
        academic: academicInput,
      };
    const first = await f.service.reviewDossier(
      ids.faculty,
      memberId,
      body,
      "same",
    );
    expect(
      await f.service.reviewDossier(ids.faculty, memberId, body, "same"),
    ).toEqual(first);
    expect(f.state.events).toHaveLength(1);
    await expect(
      f.service.reviewDossier(
        ids.faculty,
        memberId,
        { ...body, reason: "Different" },
        "same",
      ),
    ).rejects.toMatchObject(fail("IDEMPOTENCY_CONFLICT"));
    f.f.control.facultyDepartment = "other-department";
    await expect(
      f.service.reviewDossier(ids.faculty, memberId, body, "same"),
    ).rejects.toMatchObject(fail("COMMON_001"));
  });
  it("allows only one concurrent decision for the same expected revision", async () => {
    await f.review();
    const v = await f.detail(),
      body = {
        ...expected(v),
        reason: "Decision",
        status: "ELIGIBLE" as const,
      };
    const results = await Promise.allSettled([
      f.service.decide(ids.faculty, memberId, body, "first"),
      f.service.decide(ids.faculty, memberId, body, "second"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(f.state.row!.revision).toBe(2);
    expect(f.state.events).toHaveLength(2);
  });
  it.each(["audit", "idempotency"])(
    "rolls back the entire transaction on %s failure",
    async (failure) => {
      f.control.auditFailure = failure === "audit";
      f.control.rememberFailure = failure === "idempotency";
      await expect(f.review()).rejects.toThrow();
      expect(f.state.row).toBeNull();
      expect(f.state.events).toHaveLength(0);
      expect(f.state.replay.size).toBe(0);
    },
  );
  it("checks evidence hash and finalize atomically; a bad member rolls back the batch", async () => {
    await f.review();
    await f.decide();
    const v = await f.detail();
    await expect(
      f.service.finalize(
        ids.faculty,
        {
          termId: ids.term,
          reason: "Batch",
          members: [
            {
              termStudentId: memberId,
              expectedRevision: v.revision,
              evidenceHash: "0".repeat(64),
            },
          ],
        },
        "bad-hash",
      ),
    ).rejects.toMatchObject(fail("EVIDENCE_CHANGED"));
    expect(f.state.row!.finalizedAt).toBeNull();
    f.control.auditFailure = true;
    await expect(f.finalize()).rejects.toThrow();
    expect(f.state.row!.revision).toBe(2);
    expect(f.state.row!.finalizedAt).toBeNull();
  });
  it("filters scoped rows before paging and represents absent/ambiguous dossiers without fabrication", async () => {
    const query = {
      termId: ids.term,
      page: 1,
      limit: 20,
      search: "sYnThEtIc01",
    };
    expect((await f.service.list(ids.faculty, query)).total).toBe(1);
    expect(
      (await f.service.list(ids.faculty, { ...query, search: "absent" })).total,
    ).toBe(0);
    expect(
      (await f.service.list(ids.faculty, { ...query, preview: "QUALIFIED" }))
        .total,
    ).toBe(0);
    f.control.ambiguous = true;
    f.control.allDepartments = true;
    expect((await f.detail()).proposalId).toBeNull();
    expect(f.state.row).toBeNull();
  });
  it("keeps legacy eligibility isolated, without auto-adopting its ELIGIBLE status", async () => {
    await f.review();
    f.state.row!.revision = 0;
    f.state.row!.context = null;
    expect((await f.detail()).official.state).toBe("LEGACY_UNVERIFIED");
    await expect(f.review(academicInput, "again")).rejects.toMatchObject(
      fail("ELIGIBILITY_BLOCKED"),
    );
  });
});
describe("UC18 pure contracts/evaluator", () => {
  it("defaults UC18 production writes to disabled without reading configuration files", () => {
    expect(
      validateEnvironment({
        DATABASE_URL:
          "postgresql://synthetic:synthetic@example.invalid/synthetic",
        DIRECT_URL:
          "postgresql://synthetic:synthetic@example.invalid/synthetic",
        JWT_SECRET: "synthetic-unit-secret-only",
        JWT_REFRESH_SECRET: "synthetic-refresh-secret-only",
      }).UC18_WRITES_ENABLED,
    ).toBe("false");
  });
  it("rejects forged actors, invalid windows, duplicate roster members and unsupported academic import modes", () => {
    expect(
      EligibilityReviewSchema.safeParse({
        termId: ids.term,
        expectedRevision: 0,
        evidenceHash: "f".repeat(64),
        reason: "r",
        reviewedBy: ids.admin,
      }).success,
    ).toBe(false);
    expect(
      AcademicAttestationInputSchema.safeParse({
        ...academicInput,
        validUntil: academicInput.effectiveFrom,
      }).success,
    ).toBe(false);
    expect(EligibilityPolicySchema.safeParse({}).success).toBe(false);
    const m = {
      termStudentId: memberId,
      expectedRevision: 1,
      evidenceHash: "f".repeat(64),
    };
    expect(
      EligibilityFinalizeSchema.safeParse({
        termId: ids.term,
        reason: "r",
        members: [m, m],
      }).success,
    ).toBe(false);
  });
  it.each([
    "QUALIFIED",
    "NEGATIVE",
    "PENDING",
    "MISSING",
    "STALE",
    "UNVERIFIED",
  ] as const)("preserves %s evidence as a preview only", (state) => {
    expect(
      evaluateEligibility([{ key: "test", state, message: "synthetic" }]),
    ).toBe(state);
  });
});
