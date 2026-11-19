import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { defenseReadTransaction, mapDefenseReads } from "./read-transaction";
import type { PrismaService } from "../prisma/prisma.service";
import { CommitteeRepository } from "./committees/committee.repository";
import { ReviewerRepository } from "./reviewers/reviewer.repository";
import { ScheduleRepository } from "./scheduling/schedule.repository";
import { ReviewerGradeRepository } from "./reviewer-grading/reviewer-grade.repository";
import { CommitteeGradeRepository } from "./committee-grading/committee-grade.repository";
import { EligibilityRepository } from "./eligibility/eligibility.repository";
import { FinalResultRepository } from "./final-results/final-result.repository";
import { ReportRepository } from "../report/defense-reporting/report.repository";

describe("defense read transaction query batching", () => {
  it("only dispatches concurrent work for explicitly wrapped read transactions", async () => {
    const tx = {} as Prisma.TransactionClient;
    let active = 0,
      maxActive = 0;
    const load = async (id: number) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return id;
    };
    expect(await mapDefenseReads(tx, [1, 2], load)).toEqual([1, 2]);
    expect(maxActive).toBe(1);
    maxActive = 0;
    expect(
      await mapDefenseReads(defenseReadTransaction(tx), [1, 2], load),
    ).toEqual([1, 2]);
    expect(maxActive).toBe(2);
  });
  it("batches score lists by exact proposal/scorer pairs without crossing ownership", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { proposalId: "a", scorerId: "one", id: "own" },
      { proposalId: "a", scorerId: "two", id: "other" },
    ]);
    const s = defenseReadTransaction({
      scoreEntry: { findMany },
    } as unknown as Prisma.TransactionClient);
    const query = (proposalId: string, scorerId: string) =>
      s.scoreEntry.findMany({
        where: { proposalId, scorerId, role: "COMMITTEE_MEMBER" },
        select: { id: true },
      });
    expect(await Promise.all([query("a", "one"), query("b", "two")])).toEqual([
      [{ id: "own" }],
      [],
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toEqual({
      AND: [
        { role: "COMMITTEE_MEMBER" },
        {
          OR: [
            { proposalId: "a", scorerId: "one" },
            { proposalId: "b", scorerId: "two" },
          ],
        },
      ],
    });
  });

  it("reads a roster once per term and never admits an absent lecturer", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ termId: "term", lecturerId: "one" }]);
    const s = defenseReadTransaction({
      termLecturer: { findMany, findUnique: vi.fn() },
    } as unknown as Prisma.TransactionClient);
    expect(
      await s.termLecturer.findUnique({
        where: { termId_lecturerId: { termId: "term", lecturerId: "one" } },
      }),
    ).toMatchObject({ lecturerId: "one" });
    expect(
      await s.termLecturer.findUnique({
        where: { termId_lecturerId: { termId: "term", lecturerId: "absent" } },
      }),
    ).toBeNull();
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toEqual({ termId: "term" });
  });
  it.each([
    CommitteeRepository,
    ReviewerRepository,
    ScheduleRepository,
    ReviewerGradeRepository,
    CommitteeGradeRepository,
    EligibilityRepository,
    FinalResultRepository,
    ReportRepository,
  ])(
    "only batches reads, keeping command evidence fresh in %s",
    async (Repository) => {
      const findMany = vi.fn().mockResolvedValue([{ id: "member" }]);
      const findUnique = vi.fn().mockResolvedValue({ id: "member" });
      const transaction = {
        termStudent: { findMany, findUnique },
        $executeRaw: vi.fn().mockResolvedValue(1),
      };
      const db = {
        $transaction: vi.fn(async (callback) => callback(transaction)),
      };
      const repository = new Repository(db as unknown as PrismaService);
      await repository.read(async (s) => {
        await s.member("member");
        await s.member("member");
      });
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findUnique).not.toHaveBeenCalled();
      await repository.write(async (s) => {
        await s.member("member");
        await s.member("member");
      });
      expect(findUnique).toHaveBeenCalledTimes(2);
      await repository.read(async (s) => s.member("member"));
      expect(findMany).toHaveBeenCalledTimes(2);
    },
  );
  it("keeps each resource's order/limit and removes an internal partition projection", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { resourceId: "a", id: "a2" },
      { resourceId: "b", id: "b2" },
      { resourceId: "a", id: "a1" },
      { resourceId: "b", id: "b1" },
    ]);
    const s = defenseReadTransaction({
      auditLog: { findMany },
    } as unknown as Prisma.TransactionClient);
    const query = (id: string) =>
      s.auditLog.findMany({
        where: { resource: "grade", resourceId: id },
        select: { id: true },
        orderBy: { id: "desc" },
        take: 1,
      });
    expect(
      await Promise.all([query("a"), query("b"), query("missing")]),
    ).toEqual([[{ id: "a2" }], [{ id: "b2" }], []]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { resource: "grade", resourceId: { in: ["a", "b", "missing"] } },
      select: { id: true, resourceId: true },
      take: undefined,
    });
  });

  it("does not combine filters, actors or projections from different scopes", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const s = defenseReadTransaction({
      auditLog: { findMany },
    } as unknown as Prisma.TransactionClient);
    await Promise.all([
      s.auditLog.findMany({
        where: { resourceId: "a", userId: "actor-a" },
        select: { id: true },
      }),
      s.auditLog.findMany({
        where: { resourceId: "b", userId: "actor-b" },
        select: { id: true },
      }),
      s.auditLog.findMany({
        where: { resourceId: "a", userId: "actor-a" },
        select: { action: true },
      }),
    ]);
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(findMany.mock.calls.map((call) => call[0].where.userId)).toEqual([
      "actor-a",
      "actor-b",
      "actor-a",
    ]);
  });

  it("executes lazy queries once per read transaction and rechecks in a new one", async () => {
    let executions = 0;
    const findMany = vi.fn(() => ({
      then: (resolve: (value: unknown) => void) => {
        executions++;
        resolve([
          {
            id: "actor",
            status: executions === 1 ? "ACTIVE" : "LOCKED",
          },
        ]);
      },
    }));
    const tx = {
      userAccount: { findMany, findUnique: vi.fn() },
    } as unknown as Prisma.TransactionClient;
    const s = defenseReadTransaction(tx);
    const q = { where: { id: "actor" } };
    expect(await s.userAccount.findUnique(q)).toMatchObject({
      status: "ACTIVE",
    });
    expect(await s.userAccount.findUnique(q)).toMatchObject({
      status: "ACTIVE",
    });
    expect(executions).toBe(1);
    expect(
      await defenseReadTransaction(tx).userAccount.findUnique(q),
    ).toMatchObject({ status: "LOCKED" });
    expect(executions).toBe(2);
  });

  it("keeps composite score ownership and missing rows when batching unique reads", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        proposalId: "p",
        scorerId: "owner",
        role: "REVIEWER",
        totalScore: "8.50",
      },
    ]);
    const findUnique = vi.fn();
    const s = defenseReadTransaction({
      scoreEntry: { findMany, findUnique },
    } as unknown as Prisma.TransactionClient);
    const query = (scorerId: string, role: "REVIEWER" | "ADVISOR") =>
      s.scoreEntry.findUnique({
        where: {
          proposalId_scorerId_role: { proposalId: "p", scorerId, role },
        },
        select: { totalScore: true },
      });
    expect(
      await Promise.all([
        query("owner", "REVIEWER"),
        query("other", "REVIEWER"),
        query("owner", "ADVISOR"),
      ]),
    ).toEqual([{ totalScore: "8.50" }, null, null]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany.mock.calls[0][0].where.OR).toHaveLength(3);
  });

  it("leaves commands uncached and never shares mutable result arrays", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: "first" }, { id: "last" }]);
    const s = defenseReadTransaction({
      userAccount: { findMany, updateMany },
    } as unknown as Prisma.TransactionClient);
    const first = await s.userAccount.findMany({});
    first.reverse();
    expect(await s.userAccount.findMany({})).toEqual([
      { id: "first" },
      { id: "last" },
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    await s.userAccount.updateMany({ data: { status: "ACTIVE" } });
    await s.userAccount.updateMany({ data: { status: "ACTIVE" } });
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it("propagates a failed batch to all callers without swallowing database errors", async () => {
    const error = new Error("database unavailable");
    const findMany = vi.fn().mockRejectedValue(error);
    const s = defenseReadTransaction({
      auditLog: { findMany },
    } as unknown as Prisma.TransactionClient);
    const results = await Promise.allSettled([
      s.auditLog.findMany({ where: { resourceId: "a" } }),
      s.auditLog.findMany({ where: { resourceId: "b" } }),
    ]);
    expect(results).toEqual([
      { status: "rejected", reason: error },
      { status: "rejected", reason: error },
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("leaves cursor, distinct and reverse pagination to Prisma", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const s = defenseReadTransaction({
      auditLog: { findMany },
    } as unknown as Prisma.TransactionClient);
    const queries: Prisma.AuditLogFindManyArgs[] = [
      { where: { resourceId: "a" }, cursor: { id: "cursor" }, take: 2 },
      { where: { resourceId: "b" }, cursor: { id: "cursor" }, take: 2 },
      { where: { resourceId: "a" }, distinct: ["action"] },
      { where: { resourceId: "b" }, take: -2 },
    ];
    await Promise.all(queries.map((q) => s.auditLog.findMany(q)));
    expect(findMany.mock.calls.map((call) => call[0])).toEqual(queries);
  });
});
