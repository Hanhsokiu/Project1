import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  workflowFixture,
  approvedPolicy,
} from "./defense-workflow.test-fixtures";
import { defenseListSnapshotV2Schema } from "../../common/uc18-finalization/defense-list-snapshot";
import { hashJson } from "./defense-workflow.policy";

describe("Official UC18–21 transactions on isolated in-memory repository (no PostgreSQL)", () => {
  it("runs evidence → UC18 → committees → reviewer → schedule → publish → amendment, preserving seals", async () => {
    const f = workflowFixture();
    await f.through("SCHEDULE");
    const published = await f.service.sealStage(
      f.userId,
      "term",
      "SCHEDULE",
      "publish",
      await f.command(2),
    );
    expect(published).toMatchObject({ changed: true, revision: 3, version: 2 });
    expect(f.state.finalizations[0].snapshotSchemaVersion).toBe(2);
    expect(
      defenseListSnapshotV2Schema.safeParse(f.state.finalizations[0].snapshot)
        .success,
    ).toBe(true);
    expect(
      (await f.context()).stages.find((s) => s.stage === "SCHEDULE"),
    ).toMatchObject({ state: "PUBLISHED", sourceCurrent: true });
    const old = structuredClone(f.state.artifacts);
    const amended = await f.service.sealStage(
      f.userId,
      "term",
      "SCHEDULE",
      "amend",
      {
        ...(await f.command(3)),
        draft: {
          slots: [
            {
              ...f.base.slot,
              startsAt: "2026-11-02T03:00:00Z",
              endsAt: "2026-11-02T04:00:00Z",
            },
          ],
        },
        reason: "Điều chỉnh phòng đào tạo TEST",
      },
    );
    expect(amended).toMatchObject({ revision: 4, version: 3 });
    expect(f.state.artifacts.slice(0, old.length)).toEqual(old);
    expect(f.state.notifications).toHaveLength(3);
    expect(f.session.resources).toHaveBeenCalled();
    expect(f.state.events[0]).toBe("TERM_FIRST");
    expect(f.state.audit.length).toBeGreaterThan(0);
  });
  it("unknown academic evidence never admits, default Student flags are ignored", async () => {
    const f = workflowFixture();
    await f.configured();
    expect((await f.context()).students[0]).toMatchObject({
      admitted: false,
      reasons: expect.arrayContaining(["ACADEMIC_UNKNOWN"]),
    });
    await f.service.finalizeList(f.userId, "term", await f.command(1));
    expect(
      (
        f.state.finalizations[0].snapshot as {
          students: { admitted: boolean }[];
        }
      ).students[0].admitted,
    ).toBe(false);
  });
  it("full roster retains missing proposal, PDF, decision and rejected/special evidence with reasons", async () => {
    const f = workflowFixture();
    await f.configured();
    f.base.f.data.proposals = [];
    await f.service.academic(f.userId, "term", {
      ...(await f.command(0)),
      termStudentId: "member",
      verdict: "SPECIAL",
      sourceReference: "TEST bảo lưu cần đối soát",
      note: "Chưa giải quyết ngoại lệ",
    });
    const c = await f.context();
    expect(c.students).toHaveLength(1);
    expect(c.students[0]).toMatchObject({
      proposalId: null,
      admitted: false,
      reasons: expect.arrayContaining([
        "PROPOSAL_MISSING",
        "SPECIAL_REVIEW_REQUIRED",
        "PDF_NOT_VERIFIED",
      ]),
    });
  });
  it.each(["permission", "grant", "other-term", "inactive", "admin"])(
    "fails closed for %s before mutation",
    async (kind) => {
      const f = workflowFixture(),
        input = { ...(await f.command(0)), policy: approvedPolicy };
      if (kind === "permission")
        f.base.f.f.user.userRoles[0].role.rolePermissions = [];
      if (kind === "grant") f.base.f.grant.allDepartments = false;
      if (kind === "other-term") f.base.f.grant.termId = "other";
      if (kind === "inactive") f.base.f.f.user.status = "LOCKED";
      if (kind === "admin") {
        f.base.f.f.user.userRoles[0].role.name = "ADMIN";
        f.base.f.grant.allDepartments = false;
      }
      await expect(
        f.service.configure(f.userId, "term", input),
      ).rejects.toMatchObject({ status: 403 });
      expect(f.state.idempotency).toHaveLength(0);
      expect(f.state.list.workflowPolicyRevision).toBe(0);
    },
  );
  it.each(["missing-policy", "closed", "locked", "term-locked"])(
    "blocks commands with %s",
    async (kind) => {
      const f = workflowFixture();
      if (kind !== "missing-policy") await f.configured();
      if (kind === "closed") f.fault.time = new Date("2027-01-02T00:00:00Z");
      if (kind === "locked")
        (
          f.state.list.workflowPolicy as unknown as typeof approvedPolicy
        ).windows.UC18.isLocked = true;
      if (kind === "term-locked") f.base.f.f.term.isLocked = true;
      await expect(
        f.service.academic(f.userId, "term", {
          ...(await f.command(0)),
          termStudentId: "member",
          verdict: "SATISFIED",
          sourceReference: "TEST",
          note: "",
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.state.evidence).toHaveLength(0);
    },
  );
  it("same checksum and newer PDF revision makes a seal stale without reopening UC18", async () => {
    const f = workflowFixture();
    await f.finalized();
    f.base.f.data.proposals[0].finalReport.revision++;
    expect((await f.context()).list.state).toBe("FINALIZED");
    expect((await f.context()).blockers).toContain("UC18_EVIDENCE_STALE_OR_V1");
    await expect(f.save("COMMITTEES")).rejects.toMatchObject({ status: 409 });
  });
  it.each(["proposal", "pdf", "decision", "advisor", "unfinalized"])(
    "does not admit %s missing/stale official evidence",
    async (kind) => {
      const f = workflowFixture();
      await f.eligible();
      if (kind === "proposal") f.base.f.data.proposals[0].status = "SUBMITTED";
      if (kind === "pdf")
        f.storage.readPrivateFinalReport.mockRejectedValue(
          new Error("test missing bytes"),
        );
      if (kind === "decision")
        f.base.f.data.proposals[0].defenseConfirmation.status = "REJECTED";
      if (kind === "advisor")
        f.base.f.f.registration.advisorAssignment!.advisorId = "new-advisor";
      if (kind === "unfinalized")
        f.base.f.f.registration.advisorAssignment!.assignmentPlan.status =
          "PUBLISHED";
      expect((await f.context()).students[0].admitted).toBe(false);
    },
  );
  it("CAS, stale context and repeated requests cannot double-commit", async () => {
    const f = workflowFixture();
    await f.eligible();
    const input = await f.command(1);
    const first = await f.service.finalizeList(f.userId, "term", input);
    expect(await f.service.finalizeList(f.userId, "term", input)).toMatchObject(
      { changed: false, artifactId: first.artifactId },
    );
    expect(f.state.finalizations).toHaveLength(1);
    expect(
      f.state.audit.filter(
        (a) => (a as { action: string }).action === "FINALIZE_DEFENSE_LIST",
      ),
    ).toHaveLength(1);
    await expect(
      f.service.finalizeList(f.userId, "term", {
        ...input,
        requestId: "another-request-id",
      }),
    ).rejects.toMatchObject({ status: 409 });
    f.base.f.grant.allDepartments = false;
    await expect(
      f.service.finalizeList(f.userId, "term", input),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("two mock transactions with the same expected revision commit at most once (not a PostgreSQL race test)", async () => {
    const f = workflowFixture();
    await f.eligible();
    const input = await f.command(1);
    const results = await Promise.allSettled([
      f.service.finalizeList(f.userId, "term", input),
      f.service.finalizeList(f.userId, "term", {
        ...input,
        requestId: "second-request-id",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(f.state.finalizations).toHaveLength(1);
  });
  it.each(["artifact", "audit", "idempotency"])(
    "rolls back UC18 on %s failure",
    async (kind) => {
      const f = workflowFixture();
      await f.eligible();
      const before = structuredClone(f.state);
      f.fault.at = kind;
      await expect(
        f.service.finalizeList(f.userId, "term", await f.command(1)),
      ).rejects.toThrow();
      expect(f.state.finalizations).toEqual(before.finalizations);
      expect(f.state.list).toEqual(before.list);
      expect(f.state.idempotency).toEqual(before.idempotency);
    },
  );
  it("reopens only before downstream finalization and retains UC18 history", async () => {
    const f = workflowFixture();
    await f.finalized();
    await f.save("COMMITTEES");
    await f.service.reopenList(f.userId, "term", {
      ...(await f.command(2)),
      reason: "Đối soát lại TEST",
    });
    expect(f.state.list).toMatchObject({
      state: "OPEN",
      currentFinalizationId: null,
      revision: 3,
    });
    expect(f.state.finalizations).toHaveLength(1);
    const g = workflowFixture();
    await g.through("COMMITTEES");
    await expect(
      g.service.reopenList(g.userId, "term", {
        ...(await g.command(2)),
        reason: "TEST",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(g.state.list.state).toBe("FINALIZED");
  });
  it("requires complete UC20 before schedule finalization, but permits draft preparation after UC19", async () => {
    const f = workflowFixture();
    await f.through("COMMITTEES");
    await f.save("SCHEDULE");
    await expect(f.seal("SCHEDULE")).rejects.toMatchObject({ status: 409 });
    expect(f.state.stages.find((r) => r.stage === "SCHEDULE")?.state).toBe(
      "DRAFT",
    );
  });
  it("notification failure rolls back the reviewer artifact, revision, audit and idempotency", async () => {
    const f = workflowFixture();
    await f.through("COMMITTEES");
    await f.save("REVIEWERS");
    const before = structuredClone(f.state);
    f.fault.at = "notification";
    await expect(f.seal("REVIEWERS")).rejects.toThrow();
    expect(f.state.artifacts).toEqual(before.artifacts);
    expect(f.state.stages).toEqual(before.stages);
    expect(f.state.notifications).toEqual(before.notifications);
    expect(f.state.audit).toEqual(before.audit);
  });
  it("published reader exposes only own/assigned rows, no snapshot or storage identifiers", async () => {
    const f = workflowFixture();
    await f.through("SCHEDULE");
    await f.service.sealStage(
      f.userId,
      "term",
      "SCHEDULE",
      "publish",
      await f.command(2),
    );
    const user = f.base.f.f.user;
    user.userRoles = user.userRoles.map((r) => ({
      ...r,
      role: {
        ...r.role,
        rolePermissions: r.role.rolePermissions.filter(
          (p) => p.permission.resource === "defense-schedule",
        ),
      },
    }));
    user.lecturer = null;
    user.student = { ...f.base.f.f.proposal.student };
    const own = await f.service.published(f.userId, "term");
    expect(own.items).toHaveLength(1);
    expect(JSON.stringify(own)).not.toMatch(
      /storageKey|filePath|snapshot|academic|contentHash/,
    );
    user.student.id = "other-student";
    expect((await f.service.published(f.userId, "term")).items).toEqual([]);
  });
  it("detects known external bookings and stale upstream artifacts before publishing", async () => {
    const f = workflowFixture();
    await f.through("REVIEWERS");
    await f.save("SCHEDULE");
    f.base.s.busySessions.mockResolvedValue([
      {
        id: "foreign",
        committeeId: "foreign",
        roomId: "room",
        scheduledAt: new Date(f.base.slot.startsAt),
        durationMin: 30,
        committee: { members: [] },
        committeeStudents: [],
      },
    ]);
    await expect(f.seal("SCHEDULE")).rejects.toMatchObject({ status: 422 });
    expect(f.state.stages.find((r) => r.stage === "SCHEDULE")?.state).toBe(
      "DRAFT",
    );
  });
  it("rejects invalid academic hashes instead of trusting the verdict", async () => {
    const f = workflowFixture();
    await f.eligible();
    f.state.evidence[0].contentHash = hashJson({ forged: true });
    expect((await f.context()).students[0].reasons).toContain(
      "ACADEMIC_UNKNOWN",
    );
  });
});
