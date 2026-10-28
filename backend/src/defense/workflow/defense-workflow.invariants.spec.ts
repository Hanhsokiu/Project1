import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  workflowFixture,
  approvedPolicy,
} from "./defense-workflow.test-fixtures";
import {
  defenseListSnapshotV2Schema,
  defenseListSnapshotHash,
} from "../../common/uc18-finalization/defense-list-snapshot";
import { PrismaUc18FinalizationReader } from "../../common/uc18-finalization/prisma-uc18-finalization.reader";
import { Uc18FinalizationRepository } from "../../common/uc18-finalization/uc18-finalization.repository";
import { Uc18FinalizationValidator } from "../../common/uc18-finalization/uc18-finalization.validator";
import { uc18Fixture } from "../../common/uc18-finalization/uc18-finalization.test-fixtures";
import type { Prisma } from "@prisma/client";
import type { CommitteePlan } from "@doan/shared";

describe("MVP official stage validation and source invariants", () => {
  it("audited deadline adjustment after publication preserves sealed source and enables a valid amendment", async () => {
    const f = workflowFixture();
    await f.through("SCHEDULE");
    await f.service.sealStage(
      f.userId,
      "term",
      "SCHEDULE",
      "publish",
      await f.command(2),
    );
    const oldSeal = structuredClone(f.state.finalizations[0]),
      policy = structuredClone(approvedPolicy);
    policy.windows.SCHEDULE.isLocked = true;
    await f.service.configure(f.userId, "term", {
      ...(await f.command(1)),
      policy,
    });
    expect(
      (await f.context()).stages.find((s) => s.stage === "SCHEDULE"),
    ).toMatchObject({ sourceCurrent: true, capabilities: { amend: false } });
    policy.windows.SCHEDULE.isLocked = false;
    await f.service.configure(f.userId, "term", {
      ...(await f.command(2)),
      policy,
    });
    expect(
      (await f.context()).stages.find((s) => s.stage === "SCHEDULE")
        ?.capabilities.amend,
    ).toBe(true);
    await f.service.sealStage(f.userId, "term", "SCHEDULE", "amend", {
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
      reason: "TEST adjusted operational window",
    });
    expect(f.state.finalizations[0]).toEqual(oldSeal);
    expect(f.state.list.state).toBe("FINALIZED");
  });
  it("cannot change structural committee policy after a seal by extending a window", async () => {
    const f = workflowFixture();
    await f.finalized();
    await expect(
      f.service.configure(f.userId, "term", {
        ...(await f.command(1)),
        policy: { ...approvedPolicy, committeeSize: 4 },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.list.workflowPolicyRevision).toBe(1);
  });
  it("can bootstrap explicit policy for a legacy V1 seal before a legitimate REOPEN", async () => {
    const f = workflowFixture(),
      old = uc18Fixture();
    f.state.list = old.list;
    f.state.finalizations = [old.finalization];
    expect((await f.context()).list.state).toBe("FINALIZED");
    await f.configured();
    await f.service.reopenList(f.userId, "term", {
      ...(await f.command(old.list.revision)),
      reason: "Re-evaluate legacy with explicit policy TEST",
    });
    expect(f.state.list.state).toBe("OPEN");
    expect(f.state.finalizations[0]).toEqual(old.finalization);
  });
  it("accepts an explicit positive committee capacity without inventing an academic maximum", async () => {
    const f = workflowFixture();
    await f.service.configure(f.userId, "term", {
      ...(await f.command(0)),
      policy: { ...approvedPolicy, committeeCapacity: 2000 },
    });
    expect((await f.context()).policy?.committeeCapacity).toBe(2000);
  });
  it("source fingerprint rejects a non-cooperating source update before commit", async () => {
    const f = workflowFixture();
    await f.through("COMMITTEES");
    await f.save("REVIEWERS");
    const before = structuredClone(f.state.artifacts);
    f.session.notifyRecipients.mockImplementationOnce(async () => {
      f.base.f.data.members[0].student.isActive = false;
    });
    await expect(f.seal("REVIEWERS")).rejects.toMatchObject({ status: 409 });
    expect(f.state.artifacts).toEqual(before);
    expect(f.state.stages.find((s) => s.stage === "REVIEWERS")?.state).toBe(
      "DRAFT",
    );
  });
  it("department-only faculty reads are checked against current proposal routing, without snapshot scope bypass", async () => {
    const f = workflowFixture();
    const topic = f.base.f.data.proposals[0].topic;
    topic.researchArea = {
      pr2bResearchAreaWorkflowResearchAreaId: { departmentId: "department" },
    } as unknown as NonNullable<typeof topic.researchArea>;
    await f.through("SCHEDULE");
    await f.service.sealStage(
      f.userId,
      "term",
      "SCHEDULE",
      "publish",
      await f.command(2),
    );
    f.base.f.f.user.lecturer = null;
    f.base.f.grant.allDepartments = false;
    f.base.f.grant.pr2bGrantDepartmentGrantId = [
      { departmentId: "department" },
    ];
    expect((await f.service.published(f.userId, "term")).items).toHaveLength(1);
    topic.researchArea.pr2bResearchAreaWorkflowResearchAreaId!.departmentId =
      "outside-grant";
    expect((await f.service.published(f.userId, "term")).items).toEqual([]);
  });
  it("idempotency does not bypass private PDF verification on a repeated finalization", async () => {
    const f = workflowFixture();
    await f.eligible();
    const input = await f.command(1);
    await f.service.finalizeList(f.userId, "term", input);
    f.storage.readPrivateFinalReport.mockRejectedValue(
      new Error("test corrupted private PDF"),
    );
    await expect(
      f.service.finalizeList(f.userId, "term", input),
    ).rejects.toMatchObject({ status: 409 });
    expect((await f.reader.read("term", f.tx)).state).toBe("FINALIZED");
    expect(f.state.finalizations).toHaveLength(1);
  });
  it("history is read-only and keeps previous publication versions verifiable", async () => {
    const f = workflowFixture();
    await f.through("SCHEDULE");
    await f.service.sealStage(
      f.userId,
      "term",
      "SCHEDULE",
      "publish",
      await f.command(2),
    );
    const before = f.state.audit.length,
      h = await f.service.history(f.userId, "term");
    expect(
      h.items.filter((i) => i.stage === "SCHEDULE").map((i) => i.state),
    ).toEqual(["FINALIZED", "PUBLISHED"]);
    expect(h.items.every((i) => i.integrity === "VERIFIED")).toBe(true);
    expect(f.state.audit.length).toBe(before);
    expect(JSON.stringify(h)).not.toMatch(
      /storageKey|filePath|students|snapshot/,
    );
  });
  it("an old GVHD loses the advisor read relationship after official reassignment", async () => {
    const f = workflowFixture();
    await f.through("SCHEDULE");
    await f.service.sealStage(
      f.userId,
      "term",
      "SCHEDULE",
      "publish",
      await f.command(2),
    );
    f.base.f.data.grants = [];
    expect((await f.service.published(f.userId, "term")).items).toHaveLength(1);
    f.base.f.f.registration.advisorAssignment!.advisorId = "changed-advisor";
    expect((await f.service.published(f.userId, "term")).items).toEqual([]);
  });
  it.each(["size", "chair", "duplicate", "capacity", "advisor", "coverage"])(
    "UC19 blocks %s",
    async (kind) => {
      const f = workflowFixture();
      await f.finalized();
      const c: CommitteePlan = structuredClone(f.base.committee);
      if (kind === "size") c.members.pop();
      if (kind === "chair") c.members[1].role = "CHAIR" as "SECRETARY";
      if (kind === "duplicate")
        c.members[2].lecturerId = c.members[0].lecturerId;
      if (kind === "capacity") c.maxStudents = 99;
      if (kind === "advisor") c.members[2].lecturerId = "advisor";
      if (kind === "coverage") c.proposalIds = [];
      await f.service.saveStage(f.userId, "term", "COMMITTEES", {
        ...(await f.command(0)),
        draft: { committees: [c] },
      });
      await expect(f.seal("COMMITTEES")).rejects.toMatchObject({ status: 422 });
      expect(f.state.artifacts).toHaveLength(0);
    },
  );
  it.each(["zero", "many", "advisor", "duplicate-row"])(
    "UC20 blocks %s reviewer cardinality/conflict",
    async (kind) => {
      const f = workflowFixture();
      await f.through("COMMITTEES");
      const reviewers =
        kind === "duplicate-row"
          ? [...f.base.reviewers, ...f.base.reviewers]
          : [
              {
                proposalId: "proposal",
                reviewerIds:
                  kind === "zero"
                    ? []
                    : kind === "many"
                      ? ["reviewer", "chair"]
                      : ["advisor"],
              },
            ];
      await f.service.saveStage(f.userId, "term", "REVIEWERS", {
        ...(await f.command(0)),
        draft: { reviewers },
      });
      await expect(f.seal("REVIEWERS")).rejects.toMatchObject({ status: 422 });
      expect(f.state.notifications).toHaveLength(0);
    },
  );
  it.each(["missing", "time", "outside-term", "capacity", "room"])(
    "UC21 blocks %s",
    async (kind) => {
      const f = workflowFixture();
      await f.through("REVIEWERS");
      const slot = { ...f.base.slot };
      if (kind === "time") slot.endsAt = slot.startsAt;
      if (kind === "outside-term") slot.endsAt = "2028-01-01T00:00:00Z";
      if (kind === "room") slot.roomId = "foreign-room";
      if (kind === "capacity")
        f.base.s.rooms.mockResolvedValue([
          { id: "room", code: "P101", capacity: 1 },
        ]);
      await f.service.saveStage(f.userId, "term", "SCHEDULE", {
        ...(await f.command(0)),
        draft: { slots: kind === "missing" ? [] : [slot] },
      });
      await expect(f.seal("SCHEDULE")).rejects.toMatchObject({ status: 422 });
    },
  );
  it("uses configured policy, not a client-selected capacity or attendance assumption", async () => {
    const f = workflowFixture();
    await f.through("REVIEWERS");
    expect((await f.context()).suggestions[0].reviewerIds).not.toContain(
      "advisor",
    );
    expect((await f.context()).policy?.committeeCapacity).toBe(10);
    expect(f.state.notifications).toHaveLength(1);
  });
  it("UC18 V2 verifies hash and academic coverage; V1 remains readable historically", async () => {
    const f = workflowFixture();
    await f.finalized();
    expect((await f.reader.read("term", f.tx)).state).toBe("FINALIZED");
    const snap = structuredClone(f.state.finalizations[0].snapshot) as Record<
      string,
      unknown
    >;
    snap.academicEvidence = [];
    expect(defenseListSnapshotV2Schema.safeParse(snap).success).toBe(false);
    f.state.finalizations[0].contentHash = "0".repeat(64);
    expect((await f.reader.read("term", f.tx)).state).toBe("UNKNOWN");
    const legacy = uc18Fixture();
    const reader = new PrismaUc18FinalizationReader(
      new Uc18FinalizationRepository(),
      new Uc18FinalizationValidator(),
    );
    const tx = {
      defenseList: { findUnique: async () => legacy.list },
      defenseListFinalization: { findUnique: async () => legacy.finalization },
    } as unknown as Prisma.TransactionClient;
    expect((await reader.read("term", tx)).state).toBe("FINALIZED");
  });
  it("V2 cannot admit on an academic or PDF snapshot mismatch even if outer hash is recomputed", async () => {
    const f = workflowFixture();
    await f.finalized();
    const snapshot = defenseListSnapshotV2Schema.parse(
      f.state.finalizations[0].snapshot,
    );
    snapshot.students[0].pdf!.revision++;
    f.state.finalizations[0].snapshot = snapshot;
    f.state.finalizations[0].contentHash = defenseListSnapshotHash(snapshot);
    expect((await f.reader.read("term", f.tx)).state).toBe("UNKNOWN");
  });
  it("revision/CAS failure rolls back a new artifact; replay cannot bypass a closed window", async () => {
    const f = workflowFixture();
    await f.eligible();
    const input = await f.command(1);
    f.fault.cas = true;
    await expect(
      f.service.finalizeList(f.userId, "term", input),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.finalizations).toHaveLength(0);
    f.fault.cas = false;
    await f.service.finalizeList(f.userId, "term", input);
    f.fault.time = new Date("2027-01-01T00:00:00Z");
    await expect(
      f.service.finalizeList(f.userId, "term", input),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.finalizations).toHaveLength(1);
  });
  it("append-only academic revision preserves old proof and permits replacement of unverified current proof", async () => {
    const f = workflowFixture();
    await f.eligible();
    const old = structuredClone(f.state.evidence[0]);
    f.state.evidence[0].contentHash = "0".repeat(64);
    expect((await f.context()).students[0]).toMatchObject({
      academic: null,
      academicRevision: 1,
    });
    await f.service.academic(f.userId, "term", {
      ...(await f.command(1)),
      termStudentId: "member",
      verdict: "SATISFIED",
      sourceReference: "Replacement TEST",
      note: "Sửa chứng cứ",
    });
    expect(f.state.evidence).toHaveLength(2);
    expect(f.state.evidence[0].id).toBe(old.id);
    expect((await f.context()).students[0].academic?.revision).toBe(2);
  });
});
