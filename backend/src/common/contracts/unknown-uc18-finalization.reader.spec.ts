import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { UnknownUc18FinalizationReader } from "./unknown-uc18-finalization.reader";

describe("UC18 unavailable authoritative source", () => {
  it("returns UNKNOWN and never touches the database transaction", async () => {
    const tx = new Proxy(
      {},
      {
        get: () => {
          throw new Error("Unexpected database access");
        },
      },
    ) as Prisma.TransactionClient;
    await expect(
      new UnknownUc18FinalizationReader().read("term", tx),
    ).resolves.toEqual({
      state: "UNKNOWN",
      scope: "TERM",
      termId: "term",
      reason: "UC18_SOURCE_NOT_IMPLEMENTED",
    });
  });
  it("does not infer OPEN from ELIGIBLE or finalized from a term/window", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({
        status: "ELIGIBLE",
        checkedAt: new Date(),
        isLocked: true,
      });
    const tx = {
      defenseEligibility: { findFirst: query },
      thesisTerm: { findUnique: query },
      defenseConfirmationWindow: { findUnique: query },
    } as unknown as Prisma.TransactionClient;
    const reader = new UnknownUc18FinalizationReader();
    expect((await reader.read("another-term", tx)).state).toBe("UNKNOWN");
    expect(query).not.toHaveBeenCalled();
  });
});
