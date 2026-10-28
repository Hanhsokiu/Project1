import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import type { CalculationPolicy } from "@doan/shared";
import {
  calculateGrades,
  hashJson,
  type ResultSnapshot,
} from "./grading.policy";
import {
  gradeEvidenceHash,
  verifyAdvisorGrade,
  verifyCouncilConfirmation,
} from "./grading-evidence";
import { gradingFixture, calculationForTest } from "./grading.test-fixtures";

const now = new Date("2026-11-02T02:10:00Z");
const ref = (id: string) => ({ id, revision: 1, hash: "a".repeat(64) });
const refs = [ref("review"), ref("chair")];
const schedule = ref("schedule");
function advisorEvidence() {
  const a = {
    state: "VERIFIED",
    id: "advisor-grade",
    revision: 1,
    score: 9,
    advisorUserId: "advisor-user",
    assignment: { assignmentId: "assignment", revision: 0 },
    pdf: { finalReportId: "report", revision: 1, checksum: "a".repeat(64) },
    evidence: {
      schemaVersion: 1,
      termId: "term",
      proposalId: "proposal",
      recordedAt: now.toISOString(),
      recordedByUserId: "advisor-user",
      authorityReference: "UNIT TEST ONLY",
    },
  };
  return { ...a, hash: gradeEvidenceHash(a) };
}
function councilEvidence() {
  const a = {
    state: "VERIFIED",
    id: "confirmation",
    revision: 1,
    scheduleArtifactId: schedule.id,
    gradeRevisionIds: refs.map((r) => r.id),
    evidence: {
      schemaVersion: 1,
      termId: "term",
      proposalId: "proposal",
      recordedAt: now.toISOString(),
      recordedByUserId: "chair-user",
      authorityReference: "UNIT TEST ONLY",
      schedule,
      grades: refs,
    },
  };
  return { ...a, contentHash: gradeEvidenceHash(a) };
}
describe("UC24 versioned evidence boundary, no trust in a hash-shaped string", () => {
  it("accepts exact canonical, scoped advisor and collective evidence", () => {
    expect(
      verifyAdvisorGrade(advisorEvidence(), "term", "proposal", now).state,
    ).toBe("VERIFIED");
    expect(
      verifyCouncilConfirmation(
        councilEvidence(),
        "term",
        "proposal",
        now,
        schedule,
        refs,
      ).state,
    ).toBe("VERIFIED");
  });
  it.each([
    "term",
    "proposal",
    "actor",
    "future",
    "version",
    "hash",
    "score",
    "legacy",
  ])("advisor rejects %s", (fault) => {
    const a = advisorEvidence();
    if (fault === "term") a.evidence.termId = "other";
    if (fault === "proposal") a.evidence.proposalId = "other";
    if (fault === "actor") a.evidence.recordedByUserId = "other";
    if (fault === "future") a.evidence.recordedAt = "2027-01-01T00:00:00Z";
    if (fault === "version") a.evidence.schemaVersion = 99;
    if (fault === "score") a.score = Number.NaN;
    a.hash = fault === "hash" ? "b".repeat(64) : gradeEvidenceHash(a);
    expect(
      verifyAdvisorGrade(
        fault === "legacy" ? { score: 10, state: "VERIFIED" } : a,
        "term",
        "proposal",
        now,
      ),
    ).toEqual({ state: "UNKNOWN" });
  });
  it.each([
    "term",
    "proposal",
    "future",
    "schedule-revision",
    "schedule-hash",
    "grade-hash",
    "missing",
    "duplicate",
    "hash",
    "authority",
  ])("collective evidence rejects %s", (fault) => {
    const a = structuredClone(councilEvidence());
    if (fault === "term") a.evidence.termId = "other";
    if (fault === "proposal") a.evidence.proposalId = "other";
    if (fault === "future") a.evidence.recordedAt = "2027-01-01T00:00:00Z";
    if (fault === "schedule-revision") a.evidence.schedule.revision++;
    if (fault === "schedule-hash") a.evidence.schedule.hash = "b".repeat(64);
    if (fault === "grade-hash") a.evidence.grades[0].hash = "b".repeat(64);
    if (fault === "missing") {
      a.gradeRevisionIds.pop();
      a.evidence.grades.pop();
    }
    if (fault === "duplicate") {
      a.gradeRevisionIds.push(a.gradeRevisionIds[0]);
      a.evidence.grades.push(a.evidence.grades[0]);
    }
    if (fault === "authority") a.evidence.authorityReference = " ";
    a.contentHash = fault === "hash" ? "b".repeat(64) : gradeEvidenceHash(a);
    expect(
      verifyCouncilConfirmation(a, "term", "proposal", now, schedule, refs),
    ).toEqual({ state: "UNKNOWN" });
  });
  it("canonical evidence survives JSONB-style key reordering", () => {
    const a = advisorEvidence();
    const reversed = Object.fromEntries(Object.entries(a).reverse());
    expect(verifyAdvisorGrade(reversed, "term", "proposal", now).state).toBe(
      "VERIFIED",
    );
  });
});
describe("Calculation scheme contract, candidate profiles are test data only", () => {
  it.each(["scheme", "rounding", "quorum", "approval"])(
    "fails closed on missing/unsupported %s instead of using Decimal defaults",
    (fault) => {
      const p = structuredClone(calculationForTest) as unknown as Record<
        string,
        unknown
      >;
      if (fault === "scheme") p.scheme = "UNKNOWN_VERSION";
      if (fault === "rounding") p.rounding = { mode: "HALF_EVEN" };
      if (fault === "quorum") delete p.quorum;
      if (fault === "approval") delete p.approvalReference;
      expect(() =>
        calculateGrades(p as CalculationPolicy, 9, 7, [8]),
      ).toThrow();
    },
  );
  it("V1 explicitly rounds intermediate inputs; no unversioned formula switch", () => {
    const p = structuredClone(calculationForTest);
    p.rounding.processDecimals = 1;
    p.rounding.committeeDecimals = 1;
    expect(calculateGrades(p, 8.14, 8.15, [8.24, 8.25, 8.26])).toEqual({
      process: 8.1,
      committee: 8.3,
      final: 8.22,
      passed: true,
    });
    expect(calculateGrades(calculationForTest, 5, 5, [5, 5, 5])).toEqual({
      process: 5,
      committee: 5,
      final: 5,
      passed: true,
    });
  });
  it("exact Decimal arithmetic does not depend on committee score order", () => {
    const scores = [7.11, 8.22, 9.33, 6.44, 9.99];
    expect(calculateGrades(calculationForTest, 9.01, 7.03, scores)).toEqual(
      calculateGrades(calculationForTest, 9.01, 7.03, [...scores].reverse()),
    );
  });
});
describe("Immutable grading provenance and publication separation", () => {
  it.each([
    "actor",
    "state",
    "term",
    "rubric",
    "total",
    "artifact-hash",
    "policy",
  ])("history rejects rehashed bad %s and exposes no marks", async (fault) => {
    const f = await gradingFixture();
    await f.configure();
    await f.save();
    const h = f.state.sheetHistory[0];
    const a = JSON.parse(JSON.stringify(h.snapshot));
    if (fault === "actor") h.recordedByUserId = "other";
    if (fault === "state") h.state = "SEALED";
    if (fault === "term") a.termId = "other";
    if (fault === "rubric") {
      a.rubric[0].code = a.rubric[1].code;
    }
    if (fault === "total") a.total = 1;
    if (fault === "artifact-hash") a.source.reviewer.hash = "b".repeat(64);
    if (fault === "policy") a.policyRevision = 999;
    h.snapshot = a;
    h.contentHash = hashJson(a);
    const item = (
      await f.service.history(
        "reviewer-user",
        "term",
        "proposal",
        "REVIEWER",
        0,
        25,
      )
    ).items[0];
    expect(item).toMatchObject({
      integrity: "UNKNOWN",
      draft: null,
      total: null,
    });
    expect((await f.context()).grade.state).toBe("INVALID");
  });
  it("reports specific window blocker, not a generic lost HttpException code", async () => {
    const f = await gradingFixture();
    await f.configure();
    f.base.fault.time = new Date("2027-01-01T00:00:00Z");
    expect((await f.context()).blockers).toContain("GRADING_WINDOW_CLOSED");
  });
  it("fully sealed sheets do not publish or disclose scores to the student", async () => {
    const f = await gradingFixture();
    await f.configure();
    await f.allScores();
    expect(
      await f.service.published("student-user", "term", "proposal"),
    ).toMatchObject({ state: "NOT_PUBLISHED", result: null });
    expect(f.state.results).toHaveLength(0);
    expect(
      (await f.service.preview("faculty-user", "term")).items[0],
    ).toMatchObject({ final: null, canPublish: false });
  });
  it.each([
    "missing-sheet",
    "fabricated-values",
    "legacy-evidence",
    "wrong-scope",
  ])(
    "published reader rejects %s, even with recomputed outer hash",
    async (fault) => {
      const f = await gradingFixture();
      await f.configure();
      f.approveForTest();
      await f.allScores();
      await f.resultCommand();
      await f.resultCommand(true);
      const h = f.state.results[0].current!;
      const a = JSON.parse(JSON.stringify(h.snapshot)) as ResultSnapshot;
      if (fault === "missing-sheet") f.state.sheetHistory.splice(0);
      if (fault === "fabricated-values") {
        a.gradeValues.reviewer = 0;
        const totals = calculateGrades(
          a.policy,
          a.advisor.score,
          0,
          a.gradeValues.committee,
        );
        Object.assign(a, {
          process: totals.process,
          committeeScore: totals.committee,
          final: totals.final,
          passed: totals.passed,
        });
      }
      if (fault === "legacy-evidence")
        Reflect.deleteProperty(a.advisor, "evidence");
      if (fault === "wrong-scope") {
        a.advisor.evidence.evidence.proposalId = "other";
        a.advisor.evidence.hash = gradeEvidenceHash(a.advisor.evidence);
        a.advisor.hash = a.advisor.evidence.hash;
      }
      h.snapshot = a as unknown as Prisma.JsonValue;
      h.contentHash = hashJson(a);
      expect(
        (await f.service.published("student-user", "term", "proposal")).result,
      ).toBe(null);
    },
  );
  it("valid historical publication survives newer live PDF and assignment metadata", async () => {
    const f = await gradingFixture();
    await f.configure();
    f.approveForTest();
    await f.allScores();
    await f.resultCommand();
    await f.resultCommand(true);
    f.base.base.f.f.report.revision++;
    f.session.advisor.mockResolvedValue(null as never);
    expect(
      (await f.service.published("student-user", "term", "proposal")).state,
    ).toBe("PUBLISHED");
    expect(
      (
        await f.service.resultHistory("faculty-user", "term", "proposal", 0, 25)
      ).items.map((r) => r.integrity),
    ).toEqual(["VERIFIED", "VERIFIED"]);
  });
});
