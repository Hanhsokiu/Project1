import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewerAssignSchema, ReviewerPolicySchema } from "@doan/shared";
import { createReviewerFixture } from "../../../test/reviewer.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
import { allocateReviewers } from "./reviewer-allocation";
import { ReviewerValidator, reviewerConflicts } from "./reviewer.validator";
import type { ReviewerLecturer } from "@doan/shared";
let f: Awaited<ReturnType<typeof createReviewerFixture>>;
beforeEach(async () => {
  f = await createReviewerFixture();
});
describe("UC20 real synthetic upstream workflow", () => {
  it("saves, replaces, removes draft, retains history, reactivates and finalizes current assignments", async () => {
    const ccBefore = structuredClone(f.cc.state);
    await f.assign();
    expect((await f.workspace()).students[0].state).toBe("DRAFT");
    await f.assign(["l5"]);
    expect(f.state.rows).toHaveLength(2);
    expect(f.state.rows.find((r) => r.reviewerId === "l4")!.selected).toBe(
      false,
    );
    await f.assign([]);
    expect((await f.workspace()).students[0].issues).toContain(
      "REVIEWER_COUNT_REQUIRED",
    );
    await f.assign(["l4"]);
    await f.finalize();
    const c = (await f.workspace()).students[0];
    expect(c.state).toBe("FINALIZED");
    expect(c.downstream?.[0]).toMatchObject({
      lecturerId: "l4",
      effectiveStatus: "CURRENT",
      termId: ids.term,
      termStudentId: memberId,
    });
    expect(c.history).toHaveLength(5);
    expect(f.cc.state).toEqual(ccBefore);
    expect(
      await f.service.effectiveInSession(
        f.session,
        ids.faculty,
        ids.term,
        memberId,
        c.revision,
        c.evidenceHash,
      ),
    ).toEqual(c.downstream);
    expect(JSON.stringify(c)).not.toContain("totalScore");
    expect(JSON.stringify(c)).not.toContain("Synthetic advisor review");
    await expect(f.assign()).rejects.toThrow();
    await expect(f.finalize()).rejects.toThrow();
  });
  it("supports approved multiple reviewers and refuses incomplete finalization", async () => {
    f.policy.reviewersPerStudent = 2;
    await f.assign(["l4"]);
    await expect(f.finalize()).rejects.toThrow();
    await f.assign(["l4", "l5"]);
    await f.finalize();
    expect((await f.workspace()).students[0].downstream).toHaveLength(2);
  });
  it("rejects current advisor and duplicate, forged actor, too many or empty new assignments", async () => {
    await expect(f.assign(["official-advisor"])).rejects.toThrow();
    expect(
      ReviewerAssignSchema.safeParse(await f.assignBody(["l4", "l4"])).success,
    ).toBe(false);
    expect(
      ReviewerAssignSchema.safeParse({
        ...(await f.assignBody()),
        actor: ids.faculty,
      }).success,
    ).toBe(false);
    await expect(f.assign(["l4", "l5"])).rejects.toThrow();
    await expect(f.assign([])).rejects.toThrow();
    expect(f.state.rows).toHaveLength(0);
  });
  it.each(["inactive", "roster", "department", "title", "area"] as const)(
    "rejects reviewer qualification %s",
    async (type) => {
      const l = f.cc.lecturers.find((l) => l.id === "l4")!;
      if (type === "inactive") l.isActive = false;
      if (type === "roster") l.termLecturers = [];
      if (type === "department") l.departmentId = "other-department";
      if (type === "title") f.policy.allowedTitleIds = ["professor"];
      if (type === "area") {
        f.policy.expertiseRule = "REQUIRED_AREA_MATCH";
        f.control.history.areaId = "unknown-area";
      }
      await expect(f.assign()).rejects.toThrow();
    },
  );
  it.each(["ALLOW", "FORBID", "PENDING_APPROVAL"] as const)(
    "enforces committee membership rule %s",
    async (rule) => {
      f.policy.committeeMembership = rule;
      if (rule === "ALLOW") {
        await f.assign(["l1"]);
        await f.finalize();
        expect(
          (await f.workspace()).students[0].downstream?.[0].lecturerId,
        ).toBe("l1");
      } else await expect(f.assign(["l1"])).rejects.toThrow();
    },
  );
  it.each(["ALLOW", "FORBID", "PENDING_APPROVAL"] as const)(
    "enforces former advisor rule %s",
    async (rule) => {
      f.policy.formerAdvisorRule = rule;
      f.control.history.advisorIds.push("l4");
      if (rule === "ALLOW") await f.assign();
      else await expect(f.assign()).rejects.toThrow();
    },
  );
  it("fails closed on unknown history, missing policy/schema and disabled writes", async () => {
    f.control.history.valid = false;
    await expect(f.assign()).rejects.toThrow();
    f.control.history.valid = true;
    f.control.approved = false;
    await expect(f.assign()).rejects.toThrow();
    f.control.approved = true;
    f.control.schema = false;
    expect((await f.workspace()).schemaReady).toBe(false);
    await expect(f.assign()).rejects.toThrow();
    f.control.schema = true;
    f.control.writes = false;
    await expect(f.assign()).rejects.toThrow();
    expect(new ReviewerValidator().policy("{}")).toBeNull();
    expect(
      ReviewerPolicySchema.safeParse({
        ...f.policy,
        reviewersPerStudent: undefined,
      }).success,
    ).toBe(false);
  });
  it.each(["advisor", "eligibility", "committee", "member-advisor"] as const)(
    "marks finalized assignment stale after upstream %s changes without mutating it",
    async (type) => {
      await f.assign();
      await f.finalize();
      const before = structuredClone(f.state.rows),
        source = f.cc.eligibility.f;
      if (type === "advisor") source.assignment.advisorId = "l4";
      if (type === "eligibility")
        f.cc.eligibility.state.row!.finalizedAt = null;
      if (type === "committee")
        f.cc.state.rows.get(f.committeeId)!.state = "DRAFT";
      if (type === "member-advisor")
        f.cc.state.rows.get(f.committeeId)!.members[2].lecturerId =
          "official-advisor";
      const c = (await f.workspace()).students[0];
      expect(c.state).toBe("STALE");
      expect(c.downstream).toBeNull();
      expect(f.state.rows).toEqual(before);
      await expect(
        f.service.effectiveInSession(
          f.session,
          ids.faculty,
          ids.term,
          memberId,
          c.revision,
          c.evidenceHash,
        ),
      ).rejects.toThrow();
      await expect(f.finalize()).rejects.toThrow();
    },
  );
  it("rejects stale preview binding, roster, revision and wrong term", async () => {
    const b = await f.assignBody();
    f.control.history.hash = "f".repeat(64);
    await expect(f.service.assign(ids.faculty, b, "stale")).rejects.toThrow();
    const good = await f.assignBody();
    good.placements[0].expectedRevision = 8;
    await expect(f.service.assign(ids.faculty, good, "rev")).rejects.toThrow();
    const wrong = await f.assignBody();
    wrong.termId = "wrong-term";
    await expect(
      f.service.assign(ids.faculty, wrong, "term"),
    ).rejects.toThrow();
    const evidence = await f.assignBody();
    evidence.placements[0].committeeEvidenceHash = "0".repeat(64);
    await expect(
      f.service.assign(ids.faculty, evidence, "evidence"),
    ).rejects.toThrow();
  });
  it("blocks UC18 non-finalized/legacy and unfinalized UC19 before first save", async () => {
    f.cc.eligibility.state.row!.revision = 0;
    expect((await f.workspace()).students[0].binding).toBeNull();
    f.cc.eligibility.state.row!.revision = 3;
    f.cc.state.rows.get(f.committeeId)!.state = "DRAFT";
    expect((await f.workspace()).students[0].issues).toContain(
      "UC19_FINALIZED_CURRENT_REQUIRED",
    );
  });
  it("reserves whole-term legacy and other assignments for load, not just current page", async () => {
    const b = await f.assignBody();
    f.state.rows.push({
      id: "outside",
      proposalId: "other-proposal",
      reviewerId: "l4",
      revision: 0,
      assignedAt: new Date(),
    } as never);
    f.policy.maxReviewsPerLecturer = 1;
    await expect(f.assign()).rejects.toThrow();
    expect(
      (await f.workspace()).lecturers.find((l) => l.id === "l4")!.reviewLoad,
    ).toBe(1);
    expect(
      (await f.service.propose(ids.faculty, ids.term)).placements[0]
        .reviewerIds,
    ).not.toContain("l4");
    await expect(
      f.service.assign(ids.faculty, b, "stale-load"),
    ).rejects.toThrow();
  });
  it("enforces total duties including committee/advisor load", async () => {
    f.policy.committeeMembership = "ALLOW";
    f.policy.maxTotalStudentDuties = 1;
    await expect(f.assign(["l1"])).rejects.toThrow();
    await f.assign(["l4"]);
  });
  it("idempotency replay is atomic, changed payload conflicts and no extra events", async () => {
    const b = await f.assignBody(),
      result = await f.service.assign(ids.faculty, b, "same");
    expect(await f.service.assign(ids.faculty, b, "same")).toEqual(result);
    expect(f.state.events).toHaveLength(1);
    await expect(
      f.service.assign(ids.faculty, { ...b, reason: "changed" }, "same"),
    ).rejects.toThrow();
  });
  it("replays an initial assignment with assign-only permission but requires update for later edits", async () => {
    const role = f.cc.eligibility.f.users.get(ids.faculty)!.userRoles[0].role;
    role.rolePermissions = role.rolePermissions.filter(
      (p) =>
        p.permission.resource !== "defense-reviewer" ||
        p.permission.action !== "update",
    );
    const b = await f.assignBody();
    await f.service.assign(ids.faculty, b, "assign-only");
    await expect(
      f.service.assign(ids.faculty, b, "assign-only"),
    ).resolves.toBeTruthy();
    await expect(f.assign(["l5"])).rejects.toMatchObject({ status: 403 });
  });
  it.each(["auditFailure", "rememberFailure"] as const)(
    "rolls back rows and idempotency on %s",
    async (flag) => {
      f.control[flag] = true;
      await expect(f.assign()).rejects.toThrow();
      expect(f.state.rows).toHaveLength(0);
      expect(f.state.events).toHaveLength(0);
      expect(f.state.replays.size).toBe(0);
    },
  );
  it("serializes concurrent synthetic commands and rejects stale revision", async () => {
    const b = await f.assignBody(),
      results = await Promise.allSettled([
        f.service.assign(ids.faculty, b, "a"),
        f.service.assign(ids.faculty, b, "b"),
      ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(f.state.rows).toHaveLength(1);
  });
  it("legacy rows/provenance mismatches cannot be adopted", async () => {
    f.state.rows.push({
      id: "legacy",
      proposalId: ids.proposal,
      reviewerId: "l4",
      revision: 0,
      assignedAt: new Date(),
    } as never);
    expect((await f.workspace()).students[0].state).toBe("LEGACY_UNVERIFIED");
    await expect(f.assign()).rejects.toThrow();
    f.state.rows.length = 0;
    await f.assign();
    f.state.rows[0].updatedBy = "unknown";
    await expect(f.assign()).rejects.toThrow();
  });
  it("GETs do not create rows, events, scores or mutate committee state", async () => {
    const before = structuredClone(f.cc.state);
    await f.workspace();
    await f.service.options(ids.faculty);
    expect((await f.service.propose(ids.faculty, ids.term)).status).toBe(
      "FEASIBLE",
    );
    await f.service.detail(ids.faculty, memberId, ids.term);
    await f.service.list(ids.faculty, {
      termId: ids.term,
      search: "missing",
      page: 1,
      limit: 20,
    });
    expect(f.state.rows).toHaveLength(0);
    expect(f.state.events).toHaveLength(0);
    expect(f.cc.state).toEqual(before);
  });
  it("returns UNSAT when the sole qualified lecturer is the official advisor", async () => {
    f.policy.allowedTitleIds = ["synthetic-advisor-title"];
    f.cc.lecturers.find((l) => l.id === "official-advisor")!.titleId =
      "synthetic-advisor-title";
    const result = await f.service.propose(ids.faculty, ids.term);
    expect(result.status).toBe("UNSAT");
    expect(result.placements).toEqual([]);
    expect(f.state.rows).toHaveLength(0);
  });
  it("enforces role-bound permissions and cross-scope incl idempotent replay", async () => {
    for (const actor of [ids.student, ids.lecturer, ids.outsider, ids.admin])
      await expect(f.service.workspace(actor, ids.term)).rejects.toThrow();
    const b = await f.assignBody();
    await f.service.assign(ids.faculty, b, "scope");
    vi.spyOn(f.session, "grants").mockResolvedValue([]);
    await expect(f.service.assign(ids.faculty, b, "scope")).rejects.toThrow();
  });
  it("uses caller session for UC19 evidence, never nested repository reads", async () => {
    const reader = vi.spyOn(f.cc.service, "effectiveInSession"),
      nested = vi.spyOn(f.cc.repo, "read");
    await f.assign();
    expect(reader.mock.calls.every((c) => c[0] === f.session)).toBe(true);
    expect(nested).not.toHaveBeenCalled();
  });
});
describe("UC20 constraint search", () => {
  const input = (n = 6) => ({
    lecturers: ["a", "b", "c"].map((id) => ({
      id,
      fixedReviewLoad: 0,
      otherDuties: 0,
      reviewCapacity: null as number | null,
      totalCapacity: null as number | null,
    })),
    students: Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      needed: 1,
      allowed: ["a", "b", "c"],
      current: [] as string[],
    })),
  });
  it("balances uneven loads and returns deterministic results under input permutations", () => {
    const b = input();
    b.lecturers[0].fixedReviewLoad = 3;
    const r = allocateReviewers(b);
    expect(r.status).toBe("FEASIBLE");
    expect(r.loads.map((l) => l.reviews)).toEqual([3, 3, 3]);
    expect(
      allocateReviewers({
        ...b,
        lecturers: [...b.lecturers].reverse(),
        students: [...b.students]
          .reverse()
          .map((s) => ({ ...s, allowed: [...s.allowed].reverse() })),
      }),
    ).toEqual(r);
  });
  it("handles only one choice, no choices and multiple distinct reviewers", () => {
    const b = input(1);
    b.students[0].allowed = ["a"];
    expect(allocateReviewers(b).placements[0].reviewerIds).toEqual(["a"]);
    b.students[0].allowed = [];
    expect(allocateReviewers(b).status).toBe("UNSAT");
    b.students[0].allowed = ["a", "b"];
    b.students[0].needed = 2;
    expect(allocateReviewers(b).placements[0].reviewerIds).toEqual(["a", "b"]);
  });
  it("distinguishes exhaustive UNSAT from search limit without partial output", () => {
    const b = input();
    for (const l of b.lecturers) l.reviewCapacity = 1;
    expect(allocateReviewers(b).status).toBe("UNSAT");
    const limited = allocateReviewers({ ...input(), nodeLimit: 0 });
    expect(limited.status).toBe("SEARCH_LIMIT");
    expect(limited.placements).toEqual([]);
  });
  it("backtracks rather than greedily failing and preserves feasible existing assignment", () => {
    const b = input(2);
    b.lecturers = b.lecturers.slice(0, 2);
    b.lecturers.forEach((l) => (l.reviewCapacity = 1));
    b.students[0].allowed = ["a", "b"];
    b.students[1].allowed = ["a", "b"];
    b.students[0].current = ["b"];
    expect(allocateReviewers(b).placements).toEqual([
      { studentId: "s0", reviewerIds: ["b"] },
      { studentId: "s1", reviewerIds: ["a"] },
    ]);
  });
  it("enforces combined capacity and does not exceed fixed whole-term loads", () => {
    const b = input(1);
    b.students[0].allowed = ["a"];
    b.lecturers[0].otherDuties = 2;
    b.lecturers[0].totalCapacity = 2;
    expect(allocateReviewers(b).status).toBe("UNSAT");
  });
  it("never accepts unknown roster ids", () => {
    const b = input(1);
    b.students[0].allowed = ["unknown"];
    expect(allocateReviewers(b).status).toBe("UNSAT");
  });
  it("does not call an allocation feasible when fixed loads already violate approved limits", () => {
    const b = input(1);
    b.lecturers[0].fixedReviewLoad = 3;
    b.lecturers[0].reviewCapacity = 2;
    b.students[0].allowed = ["b"];
    expect(allocateReviewers(b).status).toBe("UNSAT");
  });
  it("backtracks an initially preferred choice when later constrained students need it", () => {
    const b = input(3);
    b.lecturers.forEach((l) => (l.reviewCapacity = 1));
    b.students[0].allowed = ["a", "b"];
    b.students[1].allowed = ["a", "c"];
    b.students[2].allowed = ["a", "c"];
    const r = allocateReviewers(b);
    expect(r.status).toBe("FEASIBLE");
    expect(r.placements[0].reviewerIds).toEqual(["b"]);
    expect(r.exploredNodes).toBeGreaterThan(3);
  });
  it("current advisor always conflicts even when former-advisor rule allows", () => {
    const l = {
      id: "a",
      active: true,
      inRoster: true,
      departmentId: "d",
      areaIds: [],
      titleId: null,
    } as unknown as ReviewerLecturer;
    expect(
      reviewerConflicts(
        l,
        {
          departmentId: "d",
          advisorId: "a",
          history: { valid: true, advisorIds: ["a"], areaId: null },
          committeeMembers: [],
        },
        { ...f.policy, formerAdvisorRule: "ALLOW" },
      ),
    ).toContain("ADVISOR_CONFLICT");
  });
});
