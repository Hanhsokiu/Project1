import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ScheduleRepository, ScheduleSession } from "./schedule.repository";
import type { PrismaService } from "../../prisma/prisma.service";
import { CommitteeService } from "../service/committee.service";
describe("UC21 Prisma boundaries, no database connection", () => {
  it("keeps legacy committee API on baseline fields and excludes UC21 drafts without requiring the new schema", async () => {
    const db = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        defenseCommittee: { findMany: vi.fn().mockResolvedValue([]) },
      },
      service = new CommitteeService(db as unknown as PrismaService);
    await service.findByTerm("t", ["c"]);
    let query = db.defenseCommittee.findMany.mock.calls[0][0];
    expect(query.select.defenseSessions.select.context).toBeUndefined();
    expect(query.select.defenseSessions.where).toBeUndefined();
    expect(query.select.id).toBe(true);
    db.$queryRaw.mockResolvedValue([{ column_name: "revision" }]);
    await service.findByTerm("t", ["c"]);
    query = db.defenseCommittee.findMany.mock.calls[1][0];
    expect(query.select.defenseSessions.where).toEqual({ revision: 0 });
  });
  it("checks columns before new-field queries; capability cache is scoped to one session", async () => {
    const db = {
        $queryRaw: vi.fn().mockResolvedValue([{ column_name: "id" }]),
      },
      s = new ScheduleSession(db as never);
    expect(await s.scReady()).toBe(false);
    expect(await s.scReady()).toBe(false);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    await new ScheduleSession(db as never).scReady();
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it("requires validated provenance and enabled transition/conflict guards", async () => {
    const columns =
      "revision state local_date session_type timezone ends_at context created_by updated_by updated_at finalized_by finalized_at published_by published_at"
        .split(" ")
        .map((column_name) => ({ column_name }));
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce(columns)
        .mockResolvedValueOnce(
          [
            "sc_provenance_valid",
            "sc_transition_guard",
            "sc_conflict_guard",
            "sc_booking_mutex_guard",
          ].map((name) => ({ name })),
        ),
    };
    expect(await new ScheduleSession(db as never).scReady()).toBe(true);
    db.$queryRaw
      .mockResolvedValueOnce(columns)
      .mockResolvedValueOnce([
        { name: "sc_provenance_valid" },
        { name: "sc_transition_guard" },
        { name: "sc_conflict_guard" },
      ]);
    expect(await new ScheduleSession(db as never).scReady()).toBe(false);
    db.$queryRaw.mockResolvedValueOnce(columns).mockResolvedValueOnce([]);
    expect(await new ScheduleSession(db as never).scReady()).toBe(false);
  });
  it("reads existing schedules across ALL terms and uses baseline-only legacy projection", async () => {
    const db = { defenseSession: { findMany: vi.fn().mockResolvedValue([]) } },
      s = new ScheduleSession(db as never);
    await s.scRecords();
    expect(db.defenseSession.findMany.mock.calls[0][0]).not.toHaveProperty(
      "where",
    );
    await s.scLegacy();
    const query = db.defenseSession.findMany.mock.calls[1][0];
    expect(query.select).not.toHaveProperty("revision");
    expect(query.select.scheduledAt).toBe(true);
  });
  it("CAS checks expected revision and allowed prior state", async () => {
    const db = {
        defenseSession: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn(),
        },
      },
      s = new ScheduleSession(db as never);
    await s.scSave("id", 3, "DRAFT", {
      committeeId: "c",
      roomId: "r",
      scheduledAt: new Date(),
      state: "FINALIZED",
    });
    expect(db.defenseSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "id", revision: 3, state: "DRAFT" },
        data: expect.objectContaining({ revision: 4, state: "FINALIZED" }),
      }),
    );
    db.defenseSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      s.scSave("id", 3, "DRAFT", {
        committeeId: "c",
        roomId: "r",
        scheduledAt: new Date(),
      }),
    ).rejects.toThrow();
  });
  it("takes cross-term mutex as the FIRST write transaction statement, then uses fresh ReadCommitted reads", async () => {
    const calls: string[] = [],
      db = {
        $executeRaw: vi.fn(async () => {
          calls.push("mutex");
        }),
      },
      prisma = { $transaction: vi.fn(async (fn) => fn(db)) },
      repo = new ScheduleRepository(prisma as unknown as PrismaService);
    await repo.write(async () => {
      calls.push("work");
      return true;
    });
    expect(calls).toEqual(["mutex", "work"]);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: "ReadCommitted",
      timeout: 30000,
    });
    await repo.read(async () => true);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
      timeout: 30000,
    });
  });
  it("maps uniqueness/serialization failures to conflict without swallowing other errors", async () => {
    const db = { $transaction: vi.fn() },
      repo = new ScheduleRepository(db as unknown as PrismaService);
    for (const code of ["P2002", "P2034"]) {
      db.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("TEST_ONLY", {
          code,
          clientVersion: "test",
        }),
      );
      await expect(repo.write(async () => true)).rejects.toMatchObject({
        status: 409,
      });
    }
    db.$transaction.mockRejectedValueOnce(new Error("Unexpected"));
    await expect(repo.write(async () => true)).rejects.toThrow("Unexpected");
  });
});
