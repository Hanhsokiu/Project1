import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  ReviewerGradeRepository,
  ReviewerGradeSession,
} from "./reviewer-grade.repository";
import type { PrismaService } from "../../prisma/prisma.service";
describe("UC22 Prisma adapter boundaries (synthetic client)", () => {
  it("read/write provide caller sessions with proper isolation and conflict mapping", async () => {
    const tx = {},
      transaction = vi.fn(
        async (fn: (s: unknown) => Promise<unknown>, _options: unknown) =>
          fn(tx),
      );
    const repo = new ReviewerGradeRepository({
      $transaction: transaction,
    } as unknown as PrismaService);
    await repo.read(async (s) => {
      expect(s).toBeInstanceOf(ReviewerGradeSession);
      return true;
    });
    expect(transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: "RepeatableRead",
    });
    await repo.write(async (s) => {
      expect(s).toBeInstanceOf(ReviewerGradeSession);
      return true;
    });
    expect(transaction.mock.calls[1][1]).toMatchObject({
      isolationLevel: "Serializable",
    });
    transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("TEST_ONLY", {
        code: "P2034",
        clientVersion: "TEST_ONLY",
      }),
    );
    await expect(repo.write(async () => true)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("does not adopt/upsert an existing legacy score on first write", async () => {
    const create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("TEST_ONLY", {
        code: "P2002",
        clientVersion: "TEST_ONLY",
      }),
    );
    const s = new ReviewerGradeSession({ scoreEntry: { create } } as never);
    await expect(
      s.rgSave(
        "p",
        "l",
        0,
        { id: "s", proposalId: "p", scorerId: "l", role: "REVIEWER" },
        {},
      ),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("fails closed on partially applied schema guards", async () => {
    const s = new ReviewerGradeSession({
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { name: "rg_record_valid" },
          { name: "rg_score_guard" },
        ]),
    } as never);
    vi.spyOn(s, "schemaReady").mockResolvedValue(true);
    vi.spyOn(s, "rwReady").mockResolvedValue(true);
    expect(await s.rgReady()).toBe(false);
  });
});
