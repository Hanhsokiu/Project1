import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { CommitteeRepository, CommitteeSession } from "./committee.repository";
import type { PrismaService } from "../../prisma/prisma.service";
import { CommitteeService } from "../service/committee.service";
describe("UC19 Prisma adapter safety boundaries, no database", () => {
  it("memoizes upstream evidence only inside one transaction session", async () => {
    const s = new CommitteeSession({} as Prisma.TransactionClient),
      work = vi.fn().mockResolvedValue({ effective: null });
    await s.ccEvidence("actor", "term", "member", work);
    await s.ccEvidence("actor", "term", "member", work);
    expect(work).toHaveBeenCalledTimes(1);
    await new CommitteeSession({} as Prisma.TransactionClient).ccEvidence(
      "actor",
      "term",
      "member",
      work,
    );
    expect(work).toHaveBeenCalledTimes(2);
  });
  it("uses RepeatableRead vs Serializable and maps unique/serialization conflicts", async () => {
    const tx = vi.fn(
      async (
        fn: (s: Prisma.TransactionClient) => unknown,
        _opts: { isolationLevel: string },
      ) => fn({} as Prisma.TransactionClient),
    );
    const repo = new CommitteeRepository({
      $transaction: tx,
    } as unknown as PrismaService);
    await repo.read(async () => 1);
    await repo.write(async () => 1);
    expect(tx.mock.calls[0][1].isolationLevel).toBe("RepeatableRead");
    expect(tx.mock.calls[1][1].isolationLevel).toBe("Serializable");
    for (const code of ["P2002", "P2034"]) {
      tx.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("synthetic", {
          code,
          clientVersion: "test",
        }),
      );
      await expect(repo.write(async () => 1)).rejects.toMatchObject({
        response: { error: { code: "REVISION_CONFLICT" } },
      });
    }
  });
  it("fails closed before selecting any new columns when schema is missing", async () => {
    const query = vi.fn().mockResolvedValue([]),
      s = new CommitteeSession({
        $queryRaw: query,
      } as unknown as Prisma.TransactionClient);
    expect(await s.ccReady()).toBe(false);
    expect(await s.ccLegacyReady()).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("includes frozen-state and expected revision in CAS and keeps legacy reading scoped/private", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 }),
      findMany = vi.fn().mockResolvedValue([]);
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      defenseCommittee: { updateMany, findMany },
    } as unknown as Prisma.TransactionClient;
    await expect(
      new CommitteeSession(db).ccAdvance("c", 3, { name: "new" }),
    ).rejects.toMatchObject({
      response: { error: { code: "REVISION_CONFLICT" } },
    });
    expect(updateMany.mock.calls[0][0].where).toEqual({
      id: "c",
      revision: 3,
      state: "DRAFT",
      finalizedAt: null,
    });
    await new CommitteeService(db as unknown as PrismaService).findByTerm(
      "term",
      ["allowed"],
    );
    expect(findMany.mock.calls[0][0].where).toEqual({
      termId: "term",
      id: { in: ["allowed"] },
    });
    expect(
      findMany.mock.calls[0][0].select.members.include.lecturer.select.phone,
    ).toBeUndefined();
  });
});
