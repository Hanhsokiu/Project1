import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseListRepository } from "./defense-list.repository";
import {
  defenseListAt,
  defenseListFixture,
} from "./defense-list.test-fixtures";

describe("UC18 defense list repository", () => {
  it.each([
    ["read", "RepeatableRead"],
    ["write", "ReadCommitted"],
  ] as const)(
    "uses bounded %s isolation %s and forwards the exact transaction",
    async (mode, isolationLevel) => {
      const f = defenseListFixture(),
        operation = vi.fn(async (tx: Prisma.TransactionClient) => tx);
      expect(await f.repo.transaction(operation, mode)).toBe(f.tx);
      expect(operation).toHaveBeenCalledWith(f.tx);
      expect(f.prisma.$transaction).toHaveBeenCalledWith(operation, {
        isolationLevel,
        maxWait: 10000,
        timeout: 15000,
      });
    },
  );
  it("locks THESIS_TERM with a parameterized query", async () => {
    const f = defenseListFixture();
    await f.repo.lockTerm("term-with-quote'", f.tx);
    expect(
      (f.raw.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?"),
    ).toContain('"THESIS_TERM" WHERE id=? FOR UPDATE');
    expect(f.raw.$queryRaw.mock.calls[0][1]).toBe("term-with-quote'");
  });
  it("scopes principal, grant and list queries to caller identity and term", async () => {
    const f = defenseListFixture();
    await f.repo.principal("manager", f.tx);
    await f.repo.grant("manager", "term", f.tx);
    await f.repo.list("term", f.tx);
    expect(f.raw.userAccount.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "manager" },
        select: expect.objectContaining({
          status: true,
          mustChangePassword: true,
        }),
      }),
    );
    expect(f.raw.academicTermGrant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_termId: { userId: "manager", termId: "term" } },
      }),
    );
    expect(f.raw.defenseList.findUnique).toHaveBeenCalledWith({
      where: { termId: "term" },
    });
  });
  it("atomically compares revision, DRAFT and null metadata and uses one DB timestamp for opening/update", async () => {
    const f = defenseListFixture();
    await f.repo.open("term", 9, "manager", defenseListAt, f.tx);
    expect(f.raw.defenseList.updateMany).toHaveBeenCalledWith({
      where: {
        termId: "term",
        state: "DRAFT",
        revision: 9,
        openedAt: null,
        openedByUserId: null,
        currentFinalizationId: null,
      },
      data: {
        state: "OPEN",
        openedAt: defenseListAt,
        openedByUserId: "manager",
        revision: { increment: 1 },
        updatedAt: defenseListAt,
      },
    });
    expect(f.untouched).not.toHaveBeenCalled();
  });
  it.each(["P2002", "P2034"])(
    "returns conflict for database concurrency error %s",
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "database conflict",
        { code, clientVersion: "5.22.0" },
      );
      const prisma = { $transaction: vi.fn().mockRejectedValue(error) };
      const repo = new DefenseListRepository(
        prisma as unknown as PrismaService,
      );
      await expect(
        repo.transaction(async () => undefined, "write"),
      ).rejects.toMatchObject({
        status: 409,
        response: { error: { code: "DEFENSE_LIST_CONFLICT" } },
      });
    },
  );
  it.each(["P2021", "P2022"])(
    "returns unavailable for absent UC18 database structures (%s)",
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "sensitive schema info",
        { code, clientVersion: "5.22.0" },
      );
      const prisma = { $transaction: vi.fn().mockRejectedValue(error) };
      const repo = new DefenseListRepository(
        prisma as unknown as PrismaService,
      );
      await expect(
        repo.transaction(async () => undefined, "read"),
      ).rejects.toMatchObject({
        status: 503,
        response: { error: { code: "DEFENSE_LIST_STORAGE_UNAVAILABLE" } },
      });
    },
  );
  it("propagates audit/unrelated errors for rollback without disguising success", async () => {
    const error = new Error("audit error"),
      prisma = { $transaction: vi.fn().mockRejectedValue(error) };
    const repo = new DefenseListRepository(prisma as unknown as PrismaService);
    await expect(repo.transaction(async () => undefined, "write")).rejects.toBe(
      error,
    );
  });
});
