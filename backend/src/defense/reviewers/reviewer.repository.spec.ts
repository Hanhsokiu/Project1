import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ReviewerRepository, ReviewerSession } from "./reviewer.repository";
import type { PrismaService } from "../../prisma/prisma.service";
describe("UC20 Prisma adapter boundaries, no database", () => {
  it("capability-checks columns before reading new fields and caches only within a session", async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([{ column_name: "id" }]),
    };
    const s = new ReviewerSession(db as never);
    expect(await s.rwReady()).toBe(false);
    expect(await s.rwReady()).toBe(false);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(await new ReviewerSession(db as never).rwReady()).toBe(false);
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it("requires provenance guards and real unique pair index", async () => {
    const columns =
      "id proposal_id reviewer_id assigned_at term_id term_student_id committee_id revision state selected context created_by updated_by updated_at finalized_by finalized_at"
        .split(" ")
        .map((column_name) => ({ column_name }));
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce(columns)
        .mockResolvedValueOnce(
          [
            "rw_provenance_valid",
            "rw_transition_guard",
            "rw_group_guard",
            "rw_unique_pair",
          ].map((name) => ({ name })),
        ),
    };
    expect(await new ReviewerSession(db as never).rwReady()).toBe(true);
    db.$queryRaw
      .mockResolvedValueOnce(columns)
      .mockResolvedValueOnce([{ name: "rw_provenance_valid" }]);
    expect(await new ReviewerSession(db as never).rwReady()).toBe(false);
  });
  it("uses explicit legacy projection and queries full term load before scope/paging", async () => {
    const db = {
      proposal: { findMany: vi.fn().mockResolvedValue([{ id: "p" }]) },
      reviewerAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const s = new ReviewerSession(db as never);
    await s.rwLegacy("t");
    expect(db.reviewerAssignment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          proposalId: true,
          reviewerId: true,
          assignedAt: true,
        },
      }),
    );
    await s.rwRows("t");
    expect(db.reviewerAssignment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { OR: [{ termId: "t" }, { proposalId: { in: ["p"] } }] },
      }),
    );
  });
  it("CAS guards every existing pair and inserts only absent pairs without deleting history", async () => {
    const db = {
      reviewerAssignment: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: "row",
              reviewerId: "old",
              revision: 2,
              state: "DRAFT",
              finalizedAt: null,
            },
          ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
    };
    const s = new ReviewerSession(db as never);
    await s.rwSave("p", 2, ["new"], {
      proposalId: "p",
      revision: 3,
      state: "DRAFT",
    });
    expect(db.reviewerAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row", revision: 2, state: "DRAFT", finalizedAt: null },
        data: expect.objectContaining({ revision: 3, selected: false }),
      }),
    );
    expect(db.reviewerAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        proposalId: "p",
        reviewerId: "new",
        selected: true,
        revision: 3,
      }),
    });
    db.reviewerAssignment.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      s.rwSave("p", 2, ["new"], { proposalId: "p" }),
    ).rejects.toThrow();
  });
  it("uses RepeatableRead/Serializable and maps unique/serialization conflicts to 409", async () => {
    const tx = { $transaction: vi.fn(async (fn) => fn({})) },
      repo = new ReviewerRepository(tx as unknown as PrismaService);
    await repo.read(async (s) => s instanceof ReviewerSession);
    expect(tx.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
      timeout: 30000,
    });
    await repo.write(async () => true);
    expect(tx.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      timeout: 30000,
    });
    for (const code of ["P2002", "P2034"]) {
      tx.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Synthetic", {
          code,
          clientVersion: "test",
        }),
      );
      await expect(repo.write(async () => true)).rejects.toMatchObject({
        status: 409,
      });
    }
  });
  it("reads full official-plan history, detects broken/future chains, and records former advisors", async () => {
    const changes = [
      {
        assignmentRevision: 1,
        oldAdvisorId: "old",
        newAdvisorId: "current",
        actorId: "faculty",
        effectiveAt: new Date("2020-01-01"),
      },
    ];
    const row = {
      id: "a",
      advisorId: "current",
      assignmentPlanId: "plan",
      assignmentPlan: {
        status: "FINALIZED",
        pr2bAssignmentPlanWorkflowPlanId: {
          finalizedAt: new Date("2019-01-01"),
          finalizedByUserId: "f",
        },
      },
      pr2bAssignmentChangeAssignmentId: changes,
    };
    const db = {
      proposal: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            termId: "t",
            studentId: "s",
            topic: { researchAreaId: "area" },
          }),
      },
      advisorAssignment: { findMany: vi.fn().mockResolvedValue([row]) },
    };
    const s = new ReviewerSession(db as never);
    expect(await s.rwAdvisorHistory("p", "t")).toMatchObject({
      valid: true,
      advisorIds: ["current", "old"],
      areaId: "area",
    });
    changes[0].assignmentRevision = 2;
    expect((await s.rwAdvisorHistory("p", "t")).valid).toBe(false);
    changes[0].assignmentRevision = 1;
    changes[0].effectiveAt = new Date("2099-01-01");
    expect((await s.rwAdvisorHistory("p", "t")).valid).toBe(false);
    expect((await s.rwAdvisorHistory("p", "other-term")).valid).toBe(false);
  });
});
