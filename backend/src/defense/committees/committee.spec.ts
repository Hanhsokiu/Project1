import { beforeEach, describe, expect, it } from "vitest";
import { CommitteeSaveSchema } from "@doan/shared";
import { createCommitteeFixture } from "../../../test/committee.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
import { advisorConflict, committeeStructure } from "./committee.validator";
import { allocateCommittees } from "./committee-allocation";
import { validateEnvironment } from "../../config/environment";
let f: Awaited<ReturnType<typeof createCommitteeFixture>>;
beforeEach(async () => {
  f = await createCommitteeFixture();
});
const fail = (code: string) => ({ response: { error: { code } } });
describe("UC19 integration using real UC17/UC18 producers and isolated transactional persistence", () => {
  it("defaults writes off and exposes a current contract reader in the caller transaction", async () => {
    expect(
      validateEnvironment({
        DATABASE_URL: "postgresql://synthetic:synthetic@example.invalid/db",
        DIRECT_URL: "postgresql://synthetic:synthetic@example.invalid/db",
        JWT_SECRET: "synthetic-unit-secret",
        JWT_REFRESH_SECRET: "synthetic-refresh-secret",
      }).UC19_WRITES_ENABLED,
    ).toBe("false");
    const id = await f.create();
    await f.assign(id);
    await f.finalize(id);
    const c = (await f.workspace()).committees[0];
    expect(
      await f.service.effectiveInSession(
        f.session,
        ids.faculty,
        ids.term,
        id,
        c.revision,
        c.downstream!.evidenceHash,
      ),
    ).toEqual(c.downstream);
    f.eligibility.f.bytes.clear();
    await expect(
      f.service.effectiveInSession(
        f.session,
        ids.faculty,
        ids.term,
        id,
        c.revision,
        c.downstream!.evidenceHash,
      ),
    ).rejects.toMatchObject(fail("COMMITTEE_NOT_CURRENT"));
  });
  it("can explicitly replace an inactive member in a draft without mistaking changed lecturer facts for missing audit", async () => {
    const id = await f.create();
    await f.assign(id);
    f.lecturers[2].isActive = false;
    const w = await f.workspace(),
      c = w.committees[0];
    expect(c.blockers.update).not.toContain("COMMITTEE_PROVENANCE_REQUIRED");
    await f.service.save(
      ids.faculty,
      id,
      {
        ...(await f.createBody()),
        expectedRevision: c.revision,
        rosterHash: w.rosterHash,
        members: c.members.map((m) => ({
          lecturerId: m.lecturerId === "l3" ? "l4" : m.lecturerId,
          role: m.role,
        })),
      },
      "replace-inactive",
    );
    expect((await f.workspace()).committees[0].issues).toEqual([]);
  });
  it("requires upstream approved policy even for empty committees and honors configured empty finalization", async () => {
    const b = await f.createBody();
    f.eligibility.control.policy = false;
    await expect(
      f.service.save(ids.faculty, null, b, "missing-upstream-policy"),
    ).rejects.toBeDefined();
    f.eligibility.control.policy = true;
    f.policy.allowEmptyFinalization = false;
    const id = await f.create();
    await expect(f.finalize(id)).rejects.toBeDefined();
    await f.assign(id);
    await expect(f.finalize(id)).resolves.toBeDefined();
  });
  it("reactivates a removed assignment elsewhere without invalidating the former finalized active roster", async () => {
    const one = await f.create("H1"),
      two = await f.create("H2");
    await f.assign(one);
    const w = await f.workspace(),
      c = w.committees.find((c) => c.id === one)!;
    await f.service.unassign(
      ids.faculty,
      one,
      {
        termId: ids.term,
        expectedRevision: c.revision,
        rosterHash: w.rosterHash,
        reason: "Explicit removal",
        termStudentId: memberId,
        expectedAssignmentRevision: c.students[0].revision,
      },
      "remove-first",
    );
    await f.finalize(one);
    await f.assign(two);
    expect(
      (await f.workspace()).committees.find((c) => c.id === one)?.state,
    ).toBe("FINALIZED");
  });
  it("uses the supplied UC18 transaction without a nested repository read and rechecks replay scope", async () => {
    f.eligibility.repo.read = () => {
      throw Error("Nested UC18 transaction forbidden");
    };
    const b = await f.createBody();
    await f.service.save(ids.faculty, null, b, "replay-scope");
    f.eligibility.f.control.facultyDepartment = "other";
    await expect(
      f.service.save(ids.faculty, null, b, "replay-scope"),
    ).rejects.toMatchObject(fail("COMMON_001"));
  });
  it("allows explicit removal from a stale draft but never silently reassigns", async () => {
    const id = await f.create();
    await f.assign(id);
    f.eligibility.f.bytes.clear();
    const w = await f.workspace(),
      c = w.committees[0];
    await f.service.unassign(
      ids.faculty,
      id,
      {
        termId: ids.term,
        expectedRevision: c.revision,
        rosterHash: w.rosterHash,
        reason: "Explicit removal",
        termStudentId: memberId,
        expectedAssignmentRevision: c.students[0].revision,
      },
      "remove",
    );
    expect(f.state.assignments.get(memberId)?.state).toBe("REMOVED");
    expect((await f.workspace()).committees[0].students).toEqual([]);
  });
  it("creates a draft, assigns an effective UC18 candidate and finalizes a downstream contract", async () => {
    const id = await f.create();
    expect((await f.workspace()).committees[0].downstream).toBeNull();
    await f.assign(id);
    await f.finalize(id);
    const c = (await f.workspace()).committees[0];
    expect(c.state).toBe("FINALIZED");
    expect(c.downstream).toMatchObject({
      committeeId: id,
      termId: ids.term,
      effectiveStatus: "CURRENT",
      students: [
        {
          termStudentId: memberId,
          advisorId: "official-advisor",
          eligibility: { decision: "ELIGIBLE", effectiveStatus: "CURRENT" },
        },
      ],
    });
  });
  it.each([2, 3, 5, 6])(
    "finalization enforces the explicit 3–5 bound for %i members",
    async (count) => {
      const id = await f.create("H1", Math.min(count, 5));
      if (count === 6) {
        const r = f.state.rows.get(id)!;
        r.members.push({ ...r.members[2], lecturerId: "l6" });
      }
      if (count < 3 || count > 5)
        await expect(f.finalize(id)).rejects.toBeDefined();
      else await expect(f.finalize(id)).resolves.toBeDefined();
    },
  );
  it.each(["CHAIR", "SECRETARY", "MEMBER"] as const)(
    "checks conflict when the advisor is %s, not just the chair",
    async (role) => {
      const b = await f.createBody();
      b.members = b.members.map((m) =>
        m.role === role ? { ...m, lecturerId: "official-advisor" } : m,
      );
      const result = (await f.service.save(
        ids.faculty,
        null,
        b,
        "advisor-committee",
      )) as { id: string };
      await expect(f.assign(result.id)).rejects.toMatchObject(
        fail("ADVISOR_CONFLICT"),
      );
      expect(f.state.assignments.size).toBe(0);
    },
  );
  it("rolls back a member change that introduces the advisor of an existing student", async () => {
    const id = await f.create();
    await f.assign(id);
    const w = await f.workspace(),
      c = w.committees[0],
      before = structuredClone(f.state);
    await expect(
      f.service.save(
        ids.faculty,
        id,
        {
          ...(await f.createBody()),
          expectedRevision: c.revision,
          rosterHash: w.rosterHash,
          members: c.members.map((m) => ({
            lecturerId: m.role === "MEMBER" ? "official-advisor" : m.lecturerId,
            role: m.role,
          })),
        },
        "bad-member",
      ),
    ).rejects.toBeDefined();
    expect(f.state).toEqual(before);
  });
  it("rejects duplicates, inactive members, wrong roster, title and department qualification", async () => {
    const b = await f.createBody();
    expect(
      CommitteeSaveSchema.safeParse({
        ...b,
        members: [b.members[0], b.members[0]],
      }).success,
    ).toBe(false);
    f.lecturers[0].termLecturers = [];
    await expect(f.create()).rejects.toMatchObject(
      fail("MEMBER_NOT_QUALIFIED_OR_ROSTER"),
    );
    f.lecturers[0].termLecturers = [{ termId: ids.term }];
    f.lecturers[0].isActive = false;
    await expect(f.create()).rejects.toMatchObject(
      fail("MEMBER_NOT_QUALIFIED_OR_ROSTER"),
    );
    f.lecturers[0].isActive = true;
    f.policy.allowedTitleIds = ["approved-title"];
    await expect(f.create()).rejects.toMatchObject(
      fail("MEMBER_NOT_QUALIFIED_OR_ROSTER"),
    );
  });
  it.each(["not-finalized", "stale", "legacy", "wrong-term"])(
    "does not accept %s UC18 input",
    async (variant) => {
      const id = await f.create();
      if (variant === "not-finalized")
        f.eligibility.state.row!.finalizedAt = null;
      if (variant === "legacy") f.eligibility.state.row!.revision = 0;
      if (variant === "stale")
        f.eligibility.policy.version = "synthetic-changed";
      if (variant === "wrong-term")
        f.eligibility.control.memberTerm = "other-term";
      if (variant === "wrong-term")
        expect((await f.workspace()).candidates).toHaveLength(0);
      else
        await expect(f.assign(id)).rejects.toMatchObject(
          fail("ELIGIBILITY_CHANGED"),
        );
    },
  );
  it("rechecks an advisor handover after preview and leaves saved assignments intact when sources stale", async () => {
    const id = await f.create(),
      body = await f.assignBody(id);
    f.eligibility.f.assignment.pr2bAssignmentChangeAssignmentId.push({
      assignmentRevision: 1,
      newAdvisorId: "official-advisor",
      effectiveAt: new Date(Date.now() - 1000),
    });
    await expect(
      f.service.assign(ids.faculty, body, "stale-preview"),
    ).rejects.toMatchObject(fail("ELIGIBILITY_CHANGED"));
    expect(f.state.assignments.size).toBe(0);
  });
  it("supports explicit transfer, maintains one assignment per student and forbids transfers out of a finalized committee", async () => {
    const one = await f.create("H1"),
      two = await f.create("H2");
    await f.assign(one);
    await f.assign(two);
    expect(f.state.assignments.size).toBe(1);
    expect(f.state.assignments.get(memberId)?.committeeId).toBe(two);
    await f.finalize(two);
    await expect(f.assign(one)).rejects.toMatchObject(
      fail("COMMITTEE_BLOCKED"),
    );
  });
  it("invalidates finalized output after UC18 evidence changes without deleting/moving students", async () => {
    const id = await f.create();
    await f.assign(id);
    await f.finalize(id);
    f.eligibility.f.bytes.clear();
    const c = (await f.workspace()).committees[0];
    expect(c.state).toBe("STALE");
    expect(c.downstream).toBeNull();
    expect(f.state.assignments.size).toBe(1);
    await expect(f.finalize(id, "again")).rejects.toBeDefined();
  });
  it("reserves legacy session claims instead of duplicating them or adopting legacy committee rows", async () => {
    const id = await f.create();
    f.control.legacyClaims.push({
      proposalId: ids.proposal,
      session: { committeeId: "legacy" },
    });
    await expect(f.assign(id)).rejects.toMatchObject(
      fail("ELIGIBILITY_CHANGED"),
    );
    const row = f.state.rows.get(id)!;
    row.revision = 0;
    row.state = null;
    expect((await f.workspace()).committees[0].state).toBe("LEGACY_UNVERIFIED");
    await expect(f.finalize(id)).rejects.toBeDefined();
  });
  it("protects faculty scope/role rights and never grants an ADMIN academic bypass", async () => {
    await expect(
      f.service.workspace(ids.student, ids.term),
    ).rejects.toMatchObject(fail("AUTH_004"));
    await expect(
      f.service.workspace(ids.admin, ids.term),
    ).rejects.toMatchObject(fail("AUTH_004"));
    const body = await f.createBody();
    await expect(
      f.service.save(
        ids.faculty,
        null,
        { ...body, departmentId: "other-department" },
        "scope",
      ),
    ).rejects.toMatchObject(fail("COMMON_001"));
    await expect(
      f.service.workspace(ids.faculty, "other-term"),
    ).rejects.toMatchObject(fail("COMMON_001"));
  });
  it.each(["schema", "policy", "flag", "window"])(
    "fails closed with missing %s",
    async (variant) => {
      const body = await f.createBody();
      if (variant === "schema") f.control.schema = false;
      if (variant === "policy") f.control.approved = false;
      if (variant === "flag") f.control.writes = false;
      if (variant === "window") f.eligibility.f.control.locked = true;
      await expect(
        f.service.save(ids.faculty, null, body, "blocked"),
      ).rejects.toBeDefined();
      expect(f.state.rows.size).toBe(0);
    },
  );
  it("checks explicit role counts and approved workload limits", async () => {
    f.policy.maxCommitteesPerLecturer = 1;
    await f.create("H1");
    await expect(f.create("H2")).rejects.toBeDefined();
    f.policy.maxCommitteesPerLecturer = null;
    const id = await f.create("H3");
    f.policy.chairCount = 2;
    await expect(f.finalize(id)).rejects.toBeDefined();
  });
  it("does not write during GET or turn a proposal into assignments", async () => {
    await f.create();
    const before = structuredClone(f.state);
    const p = await f.service.propose(ids.faculty, ids.term);
    expect(p.status).toBe("FEASIBLE");
    expect(p.placements).toHaveLength(1);
    expect(f.state).toEqual(before);
    await f.service.list(ids.faculty, {
      termId: ids.term,
      search: "missing",
      page: 1,
      limit: 20,
    });
    expect(f.state).toEqual(before);
  });
  it("reports UNSAT when all committees contain the student's advisor", async () => {
    const body = await f.createBody();
    body.members[2].lecturerId = "official-advisor";
    await f.service.save(ids.faculty, null, body, "conflicting");
    const p = await f.service.propose(ids.faculty, ids.term);
    expect(p.status).toBe("UNSAT");
    expect(p.placements).toEqual([]);
    expect(f.state.assignments.size).toBe(0);
  });
  it("replays idempotently, rejects changed payloads and revision/race conflicts", async () => {
    const b = await f.createBody(),
      first = await f.service.save(ids.faculty, null, b, "same");
    expect(await f.service.save(ids.faculty, null, b, "same")).toEqual(first);
    expect(f.state.rows.size).toBe(1);
    await expect(
      f.service.save(ids.faculty, null, { ...b, name: "Different" }, "same"),
    ).rejects.toMatchObject(fail("IDEMPOTENCY_CONFLICT"));
    const id = [...f.state.rows.keys()][0],
      w = await f.workspace(),
      update = {
        ...b,
        rosterHash: w.rosterHash,
        expectedRevision: w.committees[0].revision,
      };
    const results = await Promise.allSettled([
      f.service.save(ids.faculty, id, update, "one"),
      f.service.save(ids.faculty, id, update, "two"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const latest = await f.workspace();
    await expect(
      f.service.save(
        ids.faculty,
        id,
        { ...update, rosterHash: latest.rosterHash, expectedRevision: 1 },
        "rev",
      ),
    ).rejects.toMatchObject(fail("REVISION_CONFLICT"));
  });
  it.each(["audit", "idempotency"])(
    "rolls back rows, membership and revisions on %s failure",
    async (variant) => {
      const b = await f.createBody();
      f.control.auditFailure = variant === "audit";
      f.control.rememberFailure = variant === "idempotency";
      await expect(
        f.service.save(ids.faculty, null, b, "failure"),
      ).rejects.toThrow();
      expect(f.state.rows.size).toBe(0);
      expect(f.state.events).toHaveLength(0);
      expect(f.state.replay.size).toBe(0);
    },
  );
});
describe("UC19 deterministic constraint engine", () => {
  it("handles initially uneven loads and enforces lecturer capacity shared across committees", () => {
    const committees = [
      { id: "A", memberIds: ["a"], fixedStudents: 4, capacity: null },
      { id: "B", memberIds: ["b"], fixedStudents: 0, capacity: null },
    ];
    const students = Array.from({ length: 4 }, (_, i) => ({
      id: `s${i}`,
      allowed: ["A", "B"],
    }));
    expect(
      allocateCommittees({
        committees,
        students,
        lecturerLoads: { a: 4, b: 0 },
        maxStudentsPerLecturer: null,
      }).loads.map((l) => l.students),
    ).toEqual([4, 4]);
    expect(
      allocateCommittees({
        committees: committees.map((c) => ({
          ...c,
          fixedStudents: 0,
          memberIds: ["shared"],
        })),
        students,
        lecturerLoads: {},
        maxStudentsPerLecturer: 1,
      }),
    ).toMatchObject({ status: "UNSAT", placements: [] });
  });
  it("balances eligible students and is stable under input permutations", () => {
    const committees = ["A", "B", "C"].map((id) => ({
      id,
      memberIds: [`${id}-m`],
      fixedStudents: 0,
      capacity: 4,
    }));
    const students = Array.from({ length: 9 }, (_, i) => ({
      id: `s${i}`,
      allowed: ["A", "B", "C"],
    }));
    const first = allocateCommittees({
      committees,
      students,
      lecturerLoads: {},
      maxStudentsPerLecturer: null,
    });
    expect(first.status).toBe("FEASIBLE");
    expect(first.loads.map((l) => l.students)).toEqual([3, 3, 3]);
    expect(
      allocateCommittees({
        committees: [...committees].reverse(),
        students: [...students]
          .reverse()
          .map((s) => ({ ...s, allowed: [...s.allowed].reverse() })),
        lecturerLoads: {},
        maxStudentsPerLecturer: null,
      }),
    ).toEqual(first);
  });
  it("never emits violating placements on UNSAT and distinguishes a search limit", () => {
    const input = {
      committees: [
        { id: "A", memberIds: ["shared"], fixedStudents: 0, capacity: 1 },
      ],
      students: [
        { id: "s1", allowed: ["A"] },
        { id: "s2", allowed: ["A"] },
      ],
      lecturerLoads: {},
      maxStudentsPerLecturer: 1,
    };
    expect(allocateCommittees(input)).toMatchObject({
      status: "UNSAT",
      placements: [],
    });
    expect(allocateCommittees(input, 0)).toMatchObject({
      status: "SEARCH_LIMIT",
      placements: [],
    });
  });
  it("checks every role for advisor conflicts and preserves feasible current choices", () => {
    for (const role of ["CHAIR", "SECRETARY", "MEMBER"]) {
      const member = { lecturerId: "advisor", role };
      expect(advisorConflict([member], "advisor")).toBe(true);
    }
    expect(committeeStructure([], f.policy)).toContain("COMMITTEE_SIZE_3_TO_5");
    expect(
      allocateCommittees({
        committees: [
          { id: "A", memberIds: ["x"], fixedStudents: 0, capacity: null },
          { id: "B", memberIds: ["y"], fixedStudents: 0, capacity: null },
        ],
        students: [{ id: "s", allowed: ["A", "B"], currentCommitteeId: "B" }],
        lecturerLoads: {},
        maxStudentsPerLecturer: null,
      }).placements,
    ).toEqual([{ studentId: "s", committeeId: "B" }]);
  });
});
