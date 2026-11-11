import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  EligibilityRepository,
  EligibilitySession,
} from "./eligibility.repository";
import type { PrismaService } from "../../prisma/prisma.service";

describe("UC18 Prisma adapter transaction/capability boundaries (no DB connection)", () => {
  it("uses RepeatableRead for GET and Serializable for commands, mapping race conflicts to 409", async () => {
    const tx = vi.fn(
      async (
        fn: (s: Prisma.TransactionClient) => unknown,
        _options: { isolationLevel: string },
      ) => fn({} as Prisma.TransactionClient),
    );
    const repo = new EligibilityRepository({
      $transaction: tx,
    } as unknown as PrismaService);
    await repo.read(async () => 1);
    expect(tx.mock.calls[0][1]).toMatchObject({
      isolationLevel: "RepeatableRead",
    });
    await repo.write(async () => 1);
    expect(tx.mock.calls[1][1]).toMatchObject({
      isolationLevel: "Serializable",
    });
    tx.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("synthetic", {
        code: "P2034",
        clientVersion: "test",
      }),
    );
    await expect(repo.write(async () => 1)).rejects.toMatchObject({
      response: { error: { code: "REVISION_CONFLICT" } },
    });
  });
  it("refuses partial migrations and requires both constraints and enabled transition trigger", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ column_name: "revision" }]);
    let session = new EligibilitySession({
      $queryRaw: query,
    } as unknown as Prisma.TransactionClient);
    expect(await session.eligibilitySchemaReady()).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
    const cols = [
      "revision",
      "context",
      "reviewed_by",
      "decided_by",
      "decided_at",
      "finalized_by",
      "finalized_at",
    ].map((column_name) => ({ column_name }));
    query.mockResolvedValueOnce(cols).mockResolvedValueOnce([]);
    session = new EligibilitySession({
      $queryRaw: query,
    } as unknown as Prisma.TransactionClient);
    expect(await session.eligibilitySchemaReady()).toBe(false);
    query
      .mockResolvedValueOnce(cols)
      .mockResolvedValueOnce([
        { name: "eligibility_provenance_valid" },
        { name: "eligibility_transition_guard" },
      ]);
    session = new EligibilitySession({
      $queryRaw: query,
    } as unknown as Prisma.TransactionClient);
    expect(await session.eligibilitySchemaReady()).toBe(true);
  });
  it("uses a compare-and-swap update that excludes finalized rows", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const s = new EligibilitySession({
      defenseEligibility: {
        findUnique: vi.fn().mockResolvedValue({ id: "row", revision: 2 }),
        updateMany,
      },
    } as unknown as Prisma.TransactionClient);
    await expect(
      s.saveEligibility("proposal", 1, { status: "ELIGIBLE" }),
    ).rejects.toMatchObject({
      response: { error: { code: "REVISION_CONFLICT" } },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "row", revision: 1, finalizedAt: null },
      data: { status: "ELIGIBLE", revision: { increment: 1 } },
    });
  });
});
