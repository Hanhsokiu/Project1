import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ReviewGroupRepository } from "./review-group.repository";

const databaseError = (code: string, sqlState?: string) =>
  new Prisma.PrismaClientKnownRequestError("Database conflict", {
    code,
    clientVersion: "5.22.0",
    meta: sqlState ? { code: sqlState } : undefined,
  });

describe("Review group transaction retries", () => {
  it.each([
    ["P2010", "40001"],
    ["P2010", "40P01"],
    ["P2034", undefined],
    ["P2002", undefined],
  ])("retries %s (%s) with a fresh transaction", async (code, sqlState) => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(databaseError(code!, sqlState))
      .mockResolvedValue("committed");
    const repo = new ReviewGroupRepository({
      $transaction: transaction,
    } as never);
    await expect(repo.transaction(async () => "committed", true)).resolves.toBe(
      "committed",
    );
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("returns a revision conflict after three failed attempts", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValue(databaseError("P2010", "40001"));
    const repo = new ReviewGroupRepository({
      $transaction: transaction,
    } as never);
    await expect(
      repo.transaction(async () => "unreachable", true),
    ).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "REVISION_CONFLICT" } },
    });
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it("propagates unrelated SQL errors without retrying", async () => {
    const error = databaseError("P2010", "P0001");
    const transaction = vi.fn().mockRejectedValue(error);
    const repo = new ReviewGroupRepository({
      $transaction: transaction,
    } as never);
    await expect(
      repo.transaction(async () => "unreachable", true),
    ).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
