import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DefenseConfirmationCommandRepository,
  DefenseConfirmationWriteSession,
} from "./defense-confirmation-command.repository";
import { commandFixture } from "./defense-confirmation-command.test-fixtures";
import { at } from "./defense-confirmation.test-fixtures";

describe("UC17 command repository locks, CAS and append-only writes", () => {
  it("opens one bounded ReadCommitted transaction and forwards it to consumers", async () => {
    const f = commandFixture();
    await f.repo.write(async (s, tx) => {
      expect(s).toBeInstanceOf(DefenseConfirmationWriteSession);
      expect(tx).toBe(f.tx);
    });
    expect(f.prisma.$transaction).toHaveBeenCalledOnce();
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "ReadCommitted",
      maxWait: 10000,
      timeout: 15000,
    });
  });
  it("uses parameterized parent-first locks then the private file key lock", async () => {
    const f = commandFixture(),
      s = new DefenseConfirmationWriteSession(f.tx);
    await s.lock("term'", [], "proposal'");
    await s.lockPdfKey("private-key'");
    const calls = f.raw.$queryRaw.mock.calls;
    expect(calls.map(([sql]) => sql.join("?"))).toEqual([
      'SELECT id FROM public."THESIS_TERM" WHERE id=? FOR UPDATE',
      'SELECT term_id FROM public."DEFENSE_CONFIRMATION_WINDOW" WHERE term_id=? FOR UPDATE',
      'SELECT term_id FROM public."DEFENSE_LIST" WHERE term_id=? FOR UPDATE',
      'SELECT id FROM public."PROPOSAL" WHERE id=? FOR UPDATE',
      'SELECT id FROM public."DEFENSE_CONFIRMATION" WHERE proposal_id=? FOR UPDATE',
      "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))::text",
    ]);
    expect(calls[0][1]).toBe("term'");
    expect(calls[3][1]).toBe("proposal'");
  });
  it("uses clock_timestamp rather than transaction start time after lock waits", async () => {
    const f = commandFixture(),
      s = new DefenseConfirmationWriteSession(f.tx);
    expect(await s.now()).toBe(at);
    expect(f.raw.$queryRaw.mock.calls[0][0].join("")).toContain(
      "clock_timestamp()",
    );
  });
  it("updates only the expected proposal/decision/revision and inserts history with no updates", async () => {
    const f = commandFixture(),
      s = new DefenseConfirmationWriteSession(f.tx);
    await s.updateDecision("decision", "proposal", 3, { revision: 4 });
    expect(f.raw.defenseConfirmation.updateMany).toHaveBeenCalledWith({
      where: { id: "decision", proposalId: "proposal", revision: 3 },
      data: { revision: 4 },
    });
    expect(f.forbidden).not.toHaveBeenCalled();
  });
  it.each(["P2002", "P2034"])(
    "maps concurrency error %s to 409",
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError("conflict", {
        code,
        clientVersion: "5.22.0",
      });
      const repo = new DefenseConfirmationCommandRepository({
        $transaction: vi.fn().mockRejectedValue(error),
      } as unknown as PrismaService);
      await expect(repo.write(async () => undefined)).rejects.toMatchObject({
        status: 409,
        response: { error: { code: "REVISION_CONFLICT" } },
      });
    },
  );
  it.each([
    ["P2021", undefined],
    ["P2022", undefined],
    ["P2010", "42P01"],
    ["P2010", "42703"],
  ])("maps absent database structures %s/%s to 503", async (code, sqlCode) => {
    const error = new Prisma.PrismaClientKnownRequestError("sensitive SQL", {
      code: code!,
      clientVersion: "5.22.0",
      meta: { code: sqlCode },
    });
    const repo = new DefenseConfirmationCommandRepository({
      $transaction: vi.fn().mockRejectedValue(error),
    } as unknown as PrismaService);
    await expect(repo.write(async () => undefined)).rejects.toMatchObject({
      status: 503,
      response: { error: { code: "UC17_STORAGE_UNAVAILABLE" } },
    });
  });
  it("propagates unrelated errors so the entire transaction rolls back", async () => {
    const error = new Error("history failure");
    const repo = new DefenseConfirmationCommandRepository({
      $transaction: vi.fn().mockRejectedValue(error),
    } as unknown as PrismaService);
    await expect(repo.write(async () => undefined)).rejects.toBe(error);
  });
});
