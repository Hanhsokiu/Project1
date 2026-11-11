import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommitteeGradeCommandSchema,
  CommitteeGradeQuerySchema,
} from "@doan/shared";
import { createCommitteeGradeFixture } from "../../../test/committee-grade.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
let f: Awaited<ReturnType<typeof createCommitteeGradeFixture>>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-11-07T01:05:00Z");
  f = await createCommitteeGradeFixture();
});
afterEach(() => vi.useRealTimers());
const fail = (p: Promise<unknown>, status = 409) =>
  expect(p).rejects.toMatchObject({ status });
const query = () => CommitteeGradeQuerySchema.parse({ termId: ids.term });
describe("UC23 official independent committee rubric grading", () => {
  it("an approved GRADING_WINDOW policy expiry blocks new writes without expiring a valid finalized grade", async () => {
    f.policy.effectiveUntil = "2030-11-07T01:10:00Z";
    await f.command("finalize");
    vi.setSystemTime("2030-11-07T01:11:00Z");
    const v = await f.detail();
    expect(v.state).toBe("FINALIZED");
    expect(v.blockers).toContain("UC23_POLICY_NOT_EFFECTIVE");
    expect(
      (
        await f.service.effectiveInSession(
          f.session,
          f.actor(),
          ids.term,
          f.committeeId,
          memberId,
          "l1",
          1,
        )
      ).effectiveStatus,
    ).toBe("CURRENT");
  });
  it.each([
    "DRAFT",
    "STALE",
    "LEGACY",
    "UC18",
    "advisor",
    "membership",
    "role",
  ])(
    "revalidates official source %s instead of trusting raw membership",
    async (kind) => {
      const b = await f.body(),
        row = f.cc.state.rows.get(f.committeeId)!;
      if (kind === "DRAFT") row.state = "DRAFT";
      if (kind === "STALE") f.cc.policy.version = "changed";
      if (kind === "LEGACY") row.revision = 0;
      if (kind === "UC18") f.cc.eligibility.policy.version = "changed";
      if (kind === "advisor") f.f.assignment.advisorId = "l1";
      if (kind === "membership") row.members[2].lecturerId = "l5";
      if (kind === "role") row.members[0].role = "MEMBER";
      await fail(f.service.command(f.actor(), memberId, b, "source", "save"));
      expect(f.state.scores).toEqual([]);
    },
  );
  it("checks the official reader in the caller transaction and never opens nested UC19 reads", async () => {
    const reader = vi.spyOn(f.cc.service, "effectiveInSession"),
      nested = vi.spyOn(f.cc.repo, "read"),
      schedule = vi.spyOn(f.sc.service, "effectiveInSession");
    await f.command();
    expect(reader).toHaveBeenCalled();
    expect(reader.mock.calls.every((c) => c[0] === f.session)).toBe(true);
    expect(schedule.mock.calls.every((c) => c[0] === f.session)).toBe(true);
    expect(nested).not.toHaveBeenCalled();
  });
  it("cannot change target term/member/committee or browser identity", async () => {
    const b = await f.body();
    await fail(
      f.service.command(f.actor(), "missing", b, "missing", "save"),
      404,
    );
    await fail(
      f.service.command(
        f.actor(),
        memberId,
        { ...b, termId: "other" },
        "term",
        "save",
      ),
      404,
    );
    await fail(
      f.service.command(
        f.actor(),
        memberId,
        { ...b, committeeId: "other" },
        "cc",
        "save",
      ),
      404,
    );
    expect(
      CommitteeGradeCommandSchema.safeParse({ ...b, scorerId: "l2" }).success,
    ).toBe(false);
    f.cc.state.assignments.get(memberId)!.state = "REMOVED";
    await fail(
      f.service.command(f.actor(), memberId, b, "removed", "save"),
      404,
    );
  });
  it.each([
    "committeeRevision",
    "assignmentRevision",
    "committeeEvidenceHash",
    "membershipHash",
    "policyHash",
    "rubricHash",
    "scheduleHash",
    "reportVersionId",
    "reportChecksum",
  ] as const)("rejects changed expected binding %s", async (field) => {
    const b = await f.body();
    const patch = field.endsWith("Revision")
      ? 999
      : field.endsWith("Hash") || field === "reportChecksum"
        ? "f".repeat(64)
        : "different";
    await fail(
      f.service.command(
        f.actor(),
        memberId,
        { ...b, [field]: patch },
        "changed",
        "save",
      ),
    );
  });
  it.each(["DRAFT", "STALE", "LEGACY", "missing"])(
    "requires finalized CURRENT UC21 schedule %s",
    async (kind) => {
      const b = await f.body();
      if (kind === "DRAFT") f.sc.state.rows[0].state = "DRAFT";
      if (kind === "STALE") f.sc.policy.version = "changed";
      if (kind === "LEGACY") f.sc.state.rows[0].revision = 0;
      if (kind === "missing") f.sc.state.rows.length = 0;
      await fail(f.service.command(f.actor(), memberId, b, "schedule", "save"));
    },
  );
  it("enforces publication only if approved, and preserves a finalized grade after window closes", async () => {
    f.policy.schedule.requirePublished = true;
    await fail(f.command());
    f.f.term.status = "IN_PROGRESS";
    await f.sc.transition(f.sessionId, "publish");
    f.f.term.status = "DEFENDING";
    await f.command("finalize");
    vi.setSystemTime("2030-11-07T04:00:00Z");
    const v = await f.detail();
    expect(v.state).toBe("FINALIZED");
    expect(v.blockers).toContain("GRADING_WINDOW_CLOSED");
    expect(
      (
        await f.service.effectiveInSession(
          f.session,
          f.actor(),
          ids.term,
          f.committeeId,
          memberId,
          "l1",
          1,
        )
      ).effectiveStatus,
    ).toBe("CURRENT");
  });
  it("does not manufacture defense-performance evidence when policy requires it", async () => {
    f.policy.defenseEvidence = "REQUIRED";
    await f.command();
    expect((await f.detail()).finalizeBlockers).toContain(
      "DEFENSE_PERFORMANCE_PRODUCER_REQUIRED",
    );
    await fail(f.command("finalize"));
    expect(f.state.scores[0].isLocked).toBe(false);
  });
  it.each(["checksum", "unavailable", "notready", "kind", "owner", "version"])(
    "rejects invalid/future PDF %s",
    async (kind) => {
      const b = await f.body(),
        v = f.f.state.report!.versions[0];
      if (kind === "checksum") f.control.corrupt = true;
      if (kind === "unavailable") f.control.storageFailure = true;
      if (kind === "notready") v.fileAsset.state = "QUARANTINED";
      if (kind === "kind") v.fileAsset.kind = "SOURCE";
      if (kind === "owner") v.fileAsset.createdByUserId = ids.outsider;
      if (kind === "version") v.id = "different";
      await fail(f.service.command(f.actor(), memberId, b, "file", "finalize"));
    },
  );
  it("keeps a finalized sheet stale/history when source or PDF changes", async () => {
    await f.command("finalize");
    f.f.state.report!.versions[0].id = "new-pdf-version";
    expect((await f.detail()).state).toBe("STALE");
    expect(f.state.scores).toHaveLength(1);
    expect(f.state.events).toHaveLength(1);
    await fail(
      f.service.effectiveInSession(
        f.session,
        f.actor(),
        ids.term,
        f.committeeId,
        memberId,
        "l1",
        1,
      ),
    );
  });
  it.each([
    "policy",
    "version",
    "weights",
    "precision",
    "db-rubric",
    "inactive-policy",
  ])("blocks invalid/incompatible rubric %s", async (kind) => {
    if (kind === "policy") f.control.approved = false;
    if (kind === "version") {
      await f.command();
      f.policy.rubric.version = "changed";
    }
    if (kind === "weights") f.policy.rubric.criteria[0].weight = "0.8";
    if (kind === "precision") f.policy.rubric.rounding.decimalPlaces = 2;
    if (kind === "db-rubric") f.control.rubricMismatch = true;
    if (kind === "inactive-policy")
      f.policy.effectiveUntil = "2029-01-01T00:00:00Z";
    await fail(f.command());
  });
  it.each([
    "missing",
    "duplicate",
    "unknown",
    "min",
    "max",
    "step",
    "precision",
    "comment",
  ])("validates required content %s", async (kind) => {
    const b = await f.body();
    if (kind === "missing") b.criterionScores.pop();
    if (kind === "duplicate")
      b.criterionScores.push({ ...b.criterionScores[0] });
    if (kind === "unknown") b.criterionScores[0].criterionId = "unknown";
    if (kind === "min") {
      f.policy.rubric.criteria[0].minScore = "1";
      b.policyHash = (await f.detail()).policyHash;
      b.rubricHash = (await f.detail()).rubricHash;
      b.criterionScores[0].score = "0.5";
    }
    if (kind === "max") b.criterionScores[0].score = "11";
    if (kind === "step") b.criterionScores[0].score = "8.1";
    if (kind === "precision") b.criterionScores[0].score = "8.25";
    if (kind === "comment") b.comment = "";
    if (kind === "duplicate")
      expect(CommitteeGradeCommandSchema.safeParse(b).success).toBe(false);
    else
      await fail(
        f.service.command(f.actor(), memberId, b, "content", "finalize"),
        400,
      );
  });
  it.each([
    ["HALF_UP", "8.3"],
    ["HALF_EVEN", "8.2"],
    ["DOWN", "8.2"],
  ] as const)(
    "uses approved %s rounding with exact rational intermediates",
    async (mode, expected) => {
      f.policy.rubric.criteria.forEach((c) => {
        c.weight = "0.5";
      });
      f.policy.rubric.rounding.mode = mode;
      const b = await f.body();
      b.criterionScores[1].score = "8.5";
      await f.service.command(f.actor(), memberId, b, "rounding", "finalize");
      expect((await f.detail()).score!.totalScore).toBe(expected);
    },
  );
  it("rejects nonrepresentable exact total, keeps drafts incomplete and allows direct finalize", async () => {
    f.policy.rubric.criteria.forEach((c) => {
      c.weight = "0.5";
      c.maxScore = "3";
      c.step = "1";
    });
    const b = await f.body();
    b.criterionScores.forEach((c) => {
      c.score = "1";
    });
    await fail(
      f.service.command(f.actor(), memberId, b, "exact", "finalize"),
      400,
    );
    b.criterionScores[1].score = "2";
    await f.service.command(
      f.actor(),
      memberId,
      b,
      "representable",
      "finalize",
    );
    expect((await f.detail()).score!.totalScore).toBe("5");
  });
  it("draft and optional criterion rules are explicit, not automatic production assumptions", async () => {
    const b = await f.body();
    b.criterionScores.pop();
    await f.service.command(f.actor(), memberId, b, "partial", "save");
    expect((await f.detail()).score!.totalScore).toBeNull();
    f.policy.draftAllowed = false;
    await fail(f.command());
  });
  it("optional ZERO policy fills only approved missing optional criteria", async () => {
    f.policy.rubric.criteria[1].required = false;
    f.policy.rubric.missingOptional = "ZERO";
    const b = await f.body();
    b.criterionScores.pop();
    await f.service.command(f.actor(), memberId, b, "optional", "finalize");
    expect((await f.detail()).score).toEqual({
      totalScore: "4.8",
      criterionScores: { c1: "8", c2: "0" },
    });
  });
  it("faculty sees progress only, content permissions and grants remain independent", async () => {
    await f.command("finalize");
    let view = await f.detail(ids.faculty, "l1");
    expect(view.score).toBeNull();
    expect(view.comment).toBeNull();
    expect(view.history).toEqual([]);
    const p = (await f.service.progress(ids.faculty, query())).items[0];
    expect(p.requiredCount).toBe(3);
    expect(p.finalized).toBe(1);
    expect(p.missingRequired).toBe(2);
    f.permit(ids.faculty, ["score-read"]);
    view = await f.detail(ids.faculty, "l1");
    expect(view.score!.totalScore).toBe("8.4");
    expect(view.comment).toBeNull();
    f.permit(ids.faculty, ["comment-read", "history-read"]);
    expect((await f.detail(ids.faculty, "l1")).comment).toContain("TEST_ONLY");
    f.f.control.facultyDepartment = "other";
    await fail(f.detail(ids.faculty, "l1"), 404);
    expect((await f.service.progress(ids.faculty, query())).items).toEqual([]);
  });
  it("counts only scoring roles from approved policy, not assumed chair/secretary exceptions", async () => {
    f.policy.gradingRoles = ["CHAIR", "MEMBER"];
    await fail(f.command("save", f.actor("l2")));
    expect(
      (await f.service.progress(ids.faculty, query())).items[0].requiredCount,
    ).toBe(2);
    f.control.approved = false;
    expect(
      (await f.service.progress(ids.faculty, query())).items[0].requiredCount,
    ).toBeNull();
  });
  it("a permitted dual reviewer/member has two different records, never copies the reviewer grade", async () => {
    f = await createCommitteeGradeFixture(true);
    const before = JSON.stringify(f.rg.state.scores),
      advisor = JSON.stringify(f.f.state.score);
    await f.command("finalize");
    expect(JSON.stringify(f.rg.state.scores)).toBe(before);
    expect(JSON.stringify(f.f.state.score)).toBe(advisor);
    expect(f.rg.state.scores[0].role).toBe("REVIEWER");
    expect(f.state.scores[0].role).toBe("COMMITTEE_MEMBER");
    expect(f.state.scores[0].scorerId).toBe(f.rg.state.scores[0].scorerId);
    expect(f.state.scores[0].id).not.toBe(f.rg.state.scores[0].id);
  });
  it("unapproved/forbidden dual reviewer duty blocks UC23", async () => {
    f = await createCommitteeGradeFixture(true);
    f.rw.policy.committeeMembership = "FORBID";
    expect((await f.detail()).blockers).toContain(
      "DUAL_REVIEWER_ROLE_UNVERIFIED",
    );
    await fail(f.command());
  });
  it.each([
    "flag",
    "schema",
    "term-lock",
    "phase-lock",
    "status",
    "deadline",
    "outside-session",
  ])("checks write readiness %s", async (kind) => {
    const b = await f.body();
    if (kind === "flag") f.control.writes = false;
    if (kind === "schema") f.control.schema = false;
    if (kind === "term-lock") f.f.control.locked = true;
    if (kind === "status") f.f.term.status = "IN_PROGRESS";
    if (kind === "outside-session") vi.setSystemTime("2030-11-07T05:00:00Z");
    if (kind === "phase-lock" || kind === "deadline") {
      const t = (await f.session.windowTerm(ids.term))!;
      vi.spyOn(f.session, "windowTerm").mockResolvedValue({
        ...t,
        phases: t.phases.map((p) =>
          p.code === "DEFENSE"
            ? {
                ...p,
                isLocked: kind === "phase-lock",
                endDate:
                  kind === "deadline" ? new Date("2020-01-01") : p.endDate,
              }
            : p,
        ),
      });
    }
    await fail(f.service.command(f.actor(), memberId, b, "gated", "save"));
  });
  it("replay, changed payload, and concurrent CAS preserve exactly one revision per operation", async () => {
    const b = await f.body(),
      result = await f.service.command(f.actor(), memberId, b, "same", "save");
    expect(
      await f.service.command(f.actor(), memberId, b, "same", "save"),
    ).toEqual(result);
    await fail(
      f.service.command(
        f.actor(),
        memberId,
        { ...b, comment: "changed" },
        "same",
        "save",
      ),
    );
    const next = await f.body();
    const out = await Promise.allSettled([
      f.service.command(f.actor(), memberId, next, "one", "save"),
      f.service.command(f.actor(), memberId, next, "two", "save"),
    ]);
    expect(out.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(f.state.events).toHaveLength(2);
  });
  it.each(["auditFailure", "rememberFailure"] as const)(
    "rolls back score/details/audit/key on %s",
    async (kind) => {
      f.control[kind] = true;
      await expect(f.command()).rejects.toThrow();
      expect(f.state.scores).toEqual([]);
      expect(f.state.events).toEqual([]);
      expect(f.state.replays.size).toBe(0);
    },
  );
  it("legacy role and missing provenance cannot be adopted or duplicated", async () => {
    await f.command();
    f.state.scores[0].role = "COMMITTEE_CHAIR";
    f.state.scores[0].context = null;
    expect((await f.detail()).state).toBe("LEGACY_UNVERIFIED");
    await fail(f.command());
    expect(f.state.scores).toHaveLength(1);
  });
  it("does not union an admin permission into the lecturer role", async () => {
    const u = f.users.get(f.actor())!;
    u.userRoles[0].role.rolePermissions =
      u.userRoles[0].role.rolePermissions.filter(
        (x) => x.permission.action !== "finalize-own",
      );
    u.userRoles.push({
      role: {
        name: "ADMIN",
        rolePermissions: [
          {
            permission: {
              resource: "defense-committee-grade",
              action: "finalize-own",
            },
          },
        ],
      },
    } as never);
    await fail(f.command("finalize"), 403);
  });
  it("student never sees unpublished content and paging stays after own scope/filter", async () => {
    f.permit(ids.student, [
      "read",
      "read-own",
      "progress-read",
      "score-read",
      "comment-read",
    ]);
    await fail(f.service.list(ids.student, query()), 403);
    await fail(f.service.progress(f.actor(), query()), 403);
    await f.command();
    const p = await f.service.list(f.actor(), {
      ...query(),
      state: "DRAFT",
      page: 2,
      limit: 1,
    });
    expect(p.total).toBe(1);
    expect(p.items).toEqual([]);
    expect(
      (await f.service.list(f.actor(), { ...query(), search: "outside" }))
        .total,
    ).toBe(0);
  });
  it("chair draft/edit/finalize produces a bound exact own grade and keeps GET read only", async () => {
    const before = JSON.stringify(f.state),
      v = await f.detail();
    expect(v.memberRole).toBe("CHAIR");
    expect(v.blockers).toEqual([]);
    expect((await f.service.options(f.actor())).committees[0].role).toBe(
      "CHAIR",
    );
    expect((await f.service.list(f.actor(), query())).total).toBe(1);
    expect(
      (
        await f.service.download(
          f.actor(),
          memberId,
          ids.term,
          f.committeeId,
          v.report!.id,
        )
      ).bytes
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    expect(JSON.stringify(f.state)).toBe(before);
    await f.command();
    expect((await f.detail()).score!.totalScore).toBe("8.4");
    await f.command();
    await f.command("finalize");
    expect((await f.detail()).history).toHaveLength(3);
    const ef = await f.service.effectiveInSession(
      f.session,
      f.actor(),
      ids.term,
      f.committeeId,
      memberId,
      "l1",
      3,
    );
    expect(ef.totalScore).toBe("8.4");
    expect(ef.locked).toBe(true);
    expect(ef.memberRole).toBe("CHAIR");
    await fail(f.command());
  });
  it.each([
    ["l2", "SECRETARY"],
    ["l3", "MEMBER"],
  ])("%s scores a separate official %s sheet", async (id, role) => {
    await f.command("finalize", f.actor(id));
    expect((await f.detail(f.actor(id))).memberRole).toBe(role);
    expect(f.state.scores[0].scorerId).toBe(id);
  });
  it("members never share or overwrite one sheet", async () => {
    await Promise.all([
      f.command("finalize"),
      f.command("save", f.actor("l2")),
    ]);
    expect(f.state.scores).toHaveLength(2);
    await fail(
      f.service.detail(f.actor(), memberId, ids.term, f.committeeId, "l2"),
      404,
    );
    expect(
      (await f.service.list(f.actor(), query())).items.every(
        (v) => v.lecturerId === "l1",
      ),
    ).toBe(true);
  });
  it.each([ids.admin, ids.outsider, ids.lecturer, ids.student])(
    "%s cannot substitute another member",
    async (actor) => {
      f.permit(actor, ["read", "read-own", "save-own", "finalize-own"]);
      await fail(
        f.service.command(actor, memberId, await f.body(), "other", "save"),
        actor === ids.admin || actor === ids.student ? 403 : 404,
      );
    },
  );
  it("supports rubric preview/precision and only actual finalized CURRENT downstream", async () => {
    await f.command();
    await fail(
      f.service.effectiveInSession(
        f.session,
        f.actor(),
        ids.term,
        f.committeeId,
        memberId,
        "l1",
        1,
      ),
    );
    expect(f.state.scores.every((s) => s.role === "COMMITTEE_MEMBER")).toBe(
      true,
    );
  });
});
