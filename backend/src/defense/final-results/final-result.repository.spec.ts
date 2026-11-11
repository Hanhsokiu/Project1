import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  FinalResultRepository,
  FinalResultSession,
} from "./final-result.repository";
describe("UC24 adapter boundary; not a PostgreSQL rehearsal", () => {
  it("uses caller session at RepeatableRead/Serializable and maps serialization/unique conflicts", async () => {
    const tx = vi.fn(
        async (fn: (s: unknown) => Promise<unknown>, _options: unknown) =>
          fn({}),
      ),
      repo = new FinalResultRepository({ $transaction: tx } as never);
    await repo.read(async (s) => expect(s).toBeInstanceOf(FinalResultSession));
    await repo.write(async () => true);
    expect(
      tx.mock.calls.map(
        (c) => (c[1] as { isolationLevel: string }).isolationLevel,
      ),
    ).toEqual(["RepeatableRead", "Serializable"]);
    for (const code of ["P2002", "P2034"]) {
      tx.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("TEST_ONLY", {
          code,
          clientVersion: "TEST_ONLY",
        }),
      );
      await expect(repo.write(async () => true)).rejects.toMatchObject({
        status: 409,
      });
    }
  });
  it("CAS cannot change a finalized row through confirmation/finalization", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 }),
      s = new FinalResultSession({ finalResult: { updateMany } } as never);
    await expect(
      s.frSave("p", 2, { id: "r", proposalId: "p", state: "FINALIZED" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(updateMany.mock.calls[0][0].where).toEqual({
      proposalId: "p",
      revision: 2,
      state: "CONFIRMING",
      isLocked: false,
    });
  });
  it("creates first record without upsert or adoption", async () => {
    const create = vi.fn().mockResolvedValue({ id: "r", revision: 1 }),
      s = new FinalResultSession({ finalResult: { create } } as never);
    await s.frSave("p", 0, { id: "r", proposalId: "p", state: "FINALIZED" });
    expect(create.mock.calls[0][0].data.revision).toBe(1);
  });
  it("SQL package is review-only, preserves precision and provides transition/commit guards", () => {
    const sql = readFileSync(
      resolve("prisma/review/defense-final-results/migration.sql"),
      "utf8",
    );
    for (const name of [
      "fr_record_valid",
      "fr_transition_guard",
      "fr_commit_guard",
      "DEFERRABLE INITIALLY DEFERRED",
      "IDEMPOTENCY_RECORD",
      "SCORE_ENTRY",
    ])
      expect(sql).toContain(name);
    expect(sql).not.toMatch(
      /CREATE TABLE|UPDATE public\."SCORE_ENTRY"|DELETE FROM|ALTER COLUMN .*TYPE/i,
    );
    expect(sql).toContain('k."actorId"');
  });
});
