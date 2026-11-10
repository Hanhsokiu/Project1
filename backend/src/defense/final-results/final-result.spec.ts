import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FinalResultCommandSchema,
  FinalResultQuerySchema,
  calculateFinalResult,
  validateFinalResultPolicy,
} from "@doan/shared";
import { createFinalResultFixture } from "../../../test/final-result.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
let f: Awaited<ReturnType<typeof createFinalResultFixture>>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-11-07T01:05:00Z");
  f = await createFinalResultFixture();
});
afterEach(() => vi.useRealTimers());
describe("UC24 actual producer chain, isolated transaction adapter", () => {
  it("collects five actual members and does not accept four of five required sheets", async () => {
    const five = await createFinalResultFixture(5);
    expect((await five.detail()).requiredCount).toBe(7);
    expect(
      (await five.detail()).sources.filter((s) => s.source === "COMMITTEE"),
    ).toHaveLength(5);
    five.cg.state.scores.pop();
    const v = await five.detail();
    expect(v.missingCount).toBe(1);
    expect(v.calculation).toBeNull();
    await expect(five.command("finalize")).rejects.toMatchObject({
      status: 409,
    });
  });
  it("collects every independently assigned reviewer using UC20 and UC22 readers", async () => {
    const two = await createFinalResultFixture(3, ["l4", "l6"]),
      v = await two.detail();
    expect(v.blockers).toEqual([]);
    expect(v.requiredCount).toBe(6);
    expect(v.sources.filter((s) => s.source === "REVIEWER")).toHaveLength(2);
    two.cg.rg.state.scores.pop();
    expect((await two.detail()).calculation).toBeNull();
  });
  it("matches source revisions under commit lock, including a writer racing after initial authorization", async () => {
    const actor = f.cg.actor(),
      b = await f.body(actor);
    f.session.frLock = async () => {
      f.cg.state.scores[0].revision++;
    };
    await expect(
      f.service.command(actor, memberId, b, "race", "confirm"),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.row).toBeNull();
  });
  it("wrong department grant cannot view/finalize/publish", async () => {
    vi.spyOn(f.session, "grants").mockResolvedValue([]);
    await expect(f.detail()).rejects.toMatchObject({ status: 404 });
    await expect(f.command("finalize")).rejects.toMatchObject({ status: 404 });
  });
  it("legacy row never becomes official or gets adopted", async () => {
    await f.confirm();
    f.state.row!.context = null;
    expect((await f.detail()).state).toBe("LEGACY_UNVERIFIED");
    await expect(f.command("finalize")).rejects.toMatchObject({ status: 409 });
  });
  it("current member's revoked confirmation permission invalidates prior confirmation", async () => {
    await f.confirm();
    const actor = f.users.get(f.cg.actor("l1"))!;
    actor.userRoles[0].role.rolePermissions =
      actor.userRoles[0].role.rolePermissions.filter(
        (p) =>
          p.permission.resource !== "defense-result" ||
          p.permission.action !== "confirm",
      );
    expect((await f.detail()).state).toBe("STALE");
    await expect(f.command("finalize")).rejects.toMatchObject({ status: 409 });
  });
  it("student component release requires both explicit release policy and own permission", async () => {
    f.policy.publication.studentComponents = true;
    await f.confirm();
    await f.command("finalize");
    await f.command("publish");
    expect((await f.detail(ids.student)).calculation!.components).toEqual({});
    f.permit(ids.student, "STUDENT", ["components-read"]);
    expect(
      (await f.detail(ids.student)).calculation!.components.COMMITTEE,
    ).toBeDefined();
    f.users.get(ids.student)!.userRoles[0].role.rolePermissions = f.users
      .get(ids.student)!
      .userRoles[0].role.rolePermissions.filter(
        (p) =>
          p.permission.resource !== "defense-result" ||
          p.permission.action !== "final-read",
      );
    expect((await f.detail(ids.student)).calculation).toBeNull();
  });
  it("role-weighted committee aggregation is explicit and does not default a chair bonus", async () => {
    const v = await f.detail(),
      p = structuredClone(f.policy);
    p.committeeAggregate = {
      mode: "ROLE_WEIGHTED",
      rounding: { mode: "EXACT", decimalPlaces: 1 },
      weights: [
        { role: "CHAIR", weight: "0.2" },
        { role: "SECRETARY", weight: "0.3" },
        { role: "MEMBER", weight: "0.5" },
      ],
    };
    const sources = v.sources.map((s) =>
      s.source === "COMMITTEE"
        ? { ...s, totalScore: s.role === "CHAIR" ? "10" : "8" }
        : s,
    );
    expect(calculateFinalResult(p, sources).committeeScore).toBe("8.4");
    p.committeeAggregate.weights.pop();
    expect(() => calculateFinalResult(p, sources)).toThrow("INVALID_WEIGHTS");
  });
  it("weighted reviewers require exact lecturer identities and complete weights", async () => {
    const v = await f.detail(),
      p = structuredClone(f.policy),
      reviewer = v.sources.find((s) => s.source === "REVIEWER")!;
    p.reviewerAggregate = {
      mode: "WEIGHTED",
      rounding: { mode: "EXACT", decimalPlaces: 1 },
      weights: [{ lecturerId: reviewer.lecturerId, weight: "1" }],
    };
    expect(calculateFinalResult(p, v.sources).reviewerScore).toBe(
      reviewer.totalScore,
    );
    p.reviewerAggregate.weights[0].lecturerId = "outside";
    expect(() => calculateFinalResult(p, v.sources)).toThrow(
      "REVIEWER_WEIGHT_BINDING_MISMATCH",
    );
  });
  it("thresholds and classifications apply only when configured, with component elimination", async () => {
    const v = await f.detail(),
      p = structuredClone(f.policy);
    p.passRule = {
      minimumFinal: "1",
      minimumComponents: [{ source: "COMMITTEE", minimum: "10" }],
    };
    p.classifications = [{ minimum: "0", label: "TEST_ONLY configured band" }];
    const r = calculateFinalResult(p, v.sources);
    expect(r.isPassed).toBe(false);
    expect(r.classification).toBe("TEST_ONLY configured band");
    expect(calculateFinalResult(f.policy, v.sources).isPassed).toBeNull();
  });
  it("duplicate or unexpected sources cannot enter calculation", async () => {
    const v = await f.detail();
    expect(() =>
      calculateFinalResult(f.policy, [...v.sources, v.sources[0]]),
    ).toThrow("DUPLICATE_COMPONENT");
    expect(() =>
      calculateFinalResult(f.policy, [
        ...v.sources,
        {
          ...v.sources[0],
          source: "PROCESS_UC16",
          lecturerId: "outside",
          scoreEntryId: "outside",
        },
      ]),
    ).toThrow("UNEXPECTED_COMPONENT");
  });
  it("collects official UC17/22/23 independently and preview never writes", async () => {
    const v = await f.detail();
    expect(v.blockers).toEqual([]);
    expect(v.state).toBe("READY");
    expect(v.sources).toHaveLength(5);
    expect(v.requiredCount).toBe(5);
    expect(v.calculation?.finalScore).toBeDefined();
    expect(v.calculation?.isPassed).toBeNull();
    await f.service.preview(ids.faculty, memberId, ids.term);
    await f.service.list(
      ids.faculty,
      FinalResultQuerySchema.parse({ termId: ids.term }),
    );
    expect(f.state.row).toBeNull();
    expect(f.state.events).toEqual([]);
    expect(f.state.replay.size).toBe(0);
  });
  it("separates confirmation, faculty finalization and publication with private student result", async () => {
    expect((await f.detail(ids.student)).calculation).toBeNull();
    await expect(f.command("publish")).rejects.toMatchObject({ status: 409 });
    await expect(f.command("finalize")).rejects.toMatchObject({ status: 409 });
    await f.command("confirm", f.cg.actor("l1"));
    expect((await f.detail()).state).toBe("AWAITING_CONFIRMATION");
    await expect(f.command("finalize")).rejects.toMatchObject({ status: 409 });
    await f.command("confirm", f.cg.actor("l2"));
    expect((await f.detail()).state).toBe("CONFIRMED");
    await f.command("finalize");
    expect((await f.detail()).state).toBe("FINALIZED");
    expect((await f.detail(ids.student)).calculation).toBeNull();
    const before = structuredClone(f.state.row!.context);
    await f.command("publish");
    expect(f.state.row!.context).toEqual(before);
    const student = await f.detail(ids.student);
    expect(student.state).toBe("PUBLISHED");
    expect(student.calculation?.finalScore).toBeDefined();
    expect(student.calculation?.components).toEqual({});
    expect(student.sources).toEqual([]);
    expect(student.policy).toBeNull();
    expect(student.history).toEqual([]);
    expect(student.confirmations).toEqual([]);
    expect(f.state.events.map((e) => e.action)).toEqual([
      "RESULT_CONFIRM",
      "RESULT_CONFIRM",
      "RESULT_FINALIZE",
      "RESULT_PUBLISH",
    ]);
    expect(
      (
        await f.service.effectiveInSession(
          f.session,
          ids.faculty,
          ids.term,
          memberId,
          4,
        )
      ).effectiveStatus,
    ).toBe("CURRENT");
  });
  it.each(["confirm", "finalize", "publish"] as const)(
    "%s replay is scoped and body changes conflict",
    async (action) => {
      if (action !== "confirm") await f.confirm();
      if (action === "publish") await f.command("finalize");
      const actor = action === "confirm" ? f.cg.actor("l1") : ids.faculty,
        b = await f.body(actor),
        first = await f.service.command(actor, memberId, b, "same", action);
      expect(
        await f.service.command(actor, memberId, b, "same", action),
      ).toEqual(first);
      await expect(
        f.service.command(
          actor,
          memberId,
          { ...b, reason: "changed" },
          "same",
          action,
        ),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it.each(["auditFailure", "keyFailure"] as const)(
    "rolls result, audit and key back on %s",
    async (flag) => {
      await f.confirm();
      const before = structuredClone(f.state);
      f.control[flag] = true;
      await expect(f.command("finalize")).rejects.toThrow();
      expect(f.state).toEqual(before);
    },
  );
  it("two finalizers with same expected revision cannot both commit", async () => {
    await f.confirm();
    const b = await f.body(),
      results = await Promise.allSettled([
        f.service.command(ids.faculty, memberId, b, "one", "finalize"),
        f.service.command(ids.faculty, memberId, b, "two", "finalize"),
      ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it.each([
    "policy",
    "pdf",
    "membership",
    "schedule",
    "eligibility",
    "committeeGrade",
    "reviewerGrade",
  ])(
    "detects %s change after publication and retains snapshot/history",
    async (kind) => {
      await f.confirm();
      await f.command("finalize");
      await f.command("publish");
      const saved = structuredClone(f.state.row);
      if (kind === "policy") f.policy.version += "new";
      if (kind === "pdf") f.cg.control.corrupt = true;
      if (kind === "membership") f.cg.cc.control.schema = false;
      if (kind === "schedule") f.cg.sc.control.schema = false;
      if (kind === "eligibility") f.cg.cc.eligibility.control.schema = false;
      if (kind === "committeeGrade") f.cg.state.scores[0].revision++;
      if (kind === "reviewerGrade") f.cg.rg.state.scores[0].revision++;
      expect((await f.detail()).state).toBe("STALE");
      expect((await f.detail(ids.student)).calculation).toBeNull();
      await expect(
        f.service.effectiveInSession(
          f.session,
          ids.faculty,
          ids.term,
          memberId,
          4,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.state.row).toEqual(saved);
    },
  );
  it("requires every official committee grade including chair and secretary", async () => {
    f.cg.state.scores.splice(0, 1);
    const v = await f.detail();
    expect(v.state).toBe("INCOMPLETE");
    expect(v.missingCount).toBe(1);
    expect(v.calculation).toBeNull();
    await expect(f.command("finalize")).rejects.toMatchObject({ status: 409 });
  });
  it("missing reviewer is never zero", async () => {
    f.cg.rg.state.scores.splice(0);
    const v = await f.detail();
    expect(v.calculation).toBeNull();
    expect(v.blockers.some((b) => b.startsWith("REVIEWER_GRADE_MISSING"))).toBe(
      true,
    );
  });
  it("advisor grade requires matching summary and confirmation provenance", async () => {
    f.f.state.events.splice(0);
    const v = await f.detail();
    expect(v.calculation).toBeNull();
    expect(v.blockers.length).toBeGreaterThan(0);
  });
  it("new source between preview and commit conflicts", async () => {
    const actor = f.cg.actor("l1"),
      b = await f.body(actor);
    f.policy.version += "new";
    await expect(
      f.service.command(actor, memberId, b, "old", "confirm"),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.row).toBeNull();
  });
  it.each(["ready", "approved", "writes"] as const)(
    "safe gate %s blocks official writes",
    async (flag) => {
      f.control[flag] = false;
      await expect(f.command("confirm", f.cg.actor())).rejects.toMatchObject({
        status: 409,
      });
      expect(f.state.row).toBeNull();
    },
  );
  it("publication window is independent and cannot silently change policy", async () => {
    f.policy.publication.notBefore = "2030-11-07T02:00:00Z";
    await f.confirm();
    await f.command("finalize");
    await expect(f.command("publish")).rejects.toMatchObject({ status: 409 });
    expect(f.state.row!.state).toBe("FINALIZED");
  });
  it("does not confirm on behalf of member or bypass with admin", async () => {
    for (const actor of [ids.faculty, ids.admin, ids.student, ids.outsider])
      await expect(f.command("confirm", actor)).rejects.toBeDefined();
    await expect(f.command("finalize", f.cg.actor())).rejects.toMatchObject({
      status: 409,
    });
  });
  it("student own scope is required and unpublished data remain private", async () => {
    const student = f.users.get(ids.student)!;
    student.student!.id = "other-student";
    await expect(f.detail(ids.student)).rejects.toMatchObject({ status: 404 });
  });
  it("role permissions cannot be joined with ADMIN privileges", async () => {
    const faculty = f.users.get(ids.faculty)!,
      role = faculty.userRoles[0];
    role.role.rolePermissions = role.role.rolePermissions.filter(
      (p) =>
        !(
          p.permission.resource === "defense-result" &&
          p.permission.action === "finalize"
        ),
    );
    faculty.userRoles.push({
      role: {
        name: "ADMIN",
        rolePermissions: [
          { permission: { resource: "defense-result", action: "finalize" } },
        ],
      },
    } as never);
    await f.confirm();
    await expect(f.command("finalize")).rejects.toMatchObject({ status: 409 });
  });
  it("no component permission exposes only progress", async () => {
    f.users.get(ids.faculty)!.userRoles[0].role.rolePermissions = f.users
      .get(ids.faculty)!
      .userRoles[0].role.rolePermissions.filter(
        (p) =>
          p.permission.resource !== "defense-result" ||
          p.permission.action !== "components-read",
      );
    const v = await f.detail();
    expect(v.sources).toEqual([]);
    expect(v.calculation).toBeNull();
    expect(v.validCount).toBe(5);
  });
  it("policy may explicitly omit confirmation roles, but does not skip faculty finalization", async () => {
    f.policy.confirmation.roles = [];
    await f.command("finalize");
    expect((await f.detail()).state).toBe("FINALIZED");
    expect(f.state.row!.isPublished).toBe(false);
  });
  it("never changes source sheets during finalization/publication", async () => {
    const before = structuredClone({
      cg: f.cg.state.scores,
      rg: f.cg.rg.state.scores,
      advisor: f.f.state.score,
    });
    await f.confirm();
    await f.command("finalize");
    await f.command("publish");
    expect({
      cg: f.cg.state.scores,
      rg: f.cg.rg.state.scores,
      advisor: f.f.state.score,
    }).toEqual(before);
  });
  it("client cannot submit actor, final score or state", async () => {
    for (const extra of [
      { actorId: ids.admin },
      { finalScore: "10" },
      { state: "PUBLISHED" },
    ])
      expect(
        FinalResultCommandSchema.safeParse({ ...(await f.body()), ...extra })
          .success,
      ).toBe(false);
  });
  it.each([
    "unapproved",
    "unsupported",
    "weights",
    "UC16",
    "advisor",
    "precision",
  ])("rejects %s policy without formula fallback", async (kind) => {
    const p = structuredClone(f.policy) as unknown as Record<string, unknown>;
    if (kind === "unapproved") p.status = "DRAFT";
    if (kind === "unsupported") p.formula = "eval(x)";
    if (kind === "weights")
      p.components = [{ source: "COMMITTEE", weight: "0.6" }];
    if (kind === "UC16")
      p.components = [
        { source: "PROCESS_UC16", weight: "0.5" },
        { source: "COMMITTEE", weight: "0.5" },
      ];
    if (kind === "advisor") p.advisorSource = "PENDING_APPROVAL";
    if (kind === "precision")
      p.finalRounding = { mode: "HALF_UP", decimalPlaces: 2 };
    expect(() => validateFinalResultPolicy(p)).toThrow();
  });
  it.each(["EXACT", "HALF_UP", "HALF_EVEN", "DOWN"] as const)(
    "uses exact rational %s rounding",
    async (mode) => {
      const p = structuredClone(f.policy);
      p.advisorSource = "NOT_USED";
      p.components = [{ source: "COMMITTEE", weight: "1" }];
      p.committeeAggregate.rounding = { mode: "EXACT", decimalPlaces: 2 };
      p.finalRounding.mode = mode;
      const sources = (await f.detail()).sources
        .filter((s) => s.source === "COMMITTEE")
        .map((s) => ({ ...s, totalScore: "8.25" }));
      if (mode === "EXACT")
        expect(() => calculateFinalResult(p, sources)).toThrow(
          "ROUNDING_REQUIRED",
        );
      else
        expect(calculateFinalResult(p, sources).finalScore).toBe(
          mode === "HALF_UP" ? "8.3" : "8.2",
        );
    },
  );
});
