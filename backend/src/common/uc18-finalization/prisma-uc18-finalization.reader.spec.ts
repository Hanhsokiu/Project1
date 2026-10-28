import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { PrismaUc18FinalizationReader } from "./prisma-uc18-finalization.reader";
import { Uc18FinalizationRepository } from "./uc18-finalization.repository";
import { Uc18FinalizationValidator } from "./uc18-finalization.validator";
import { uc18Fixture } from "./uc18-finalization.test-fixtures";

let f: ReturnType<typeof uc18Fixture>,
  tx: Prisma.TransactionClient,
  list: ReturnType<typeof vi.fn>,
  finalization: ReturnType<typeof vi.fn>,
  reader: PrismaUc18FinalizationReader;
const read = () => reader.read("term", tx);
beforeEach(() => {
  f = uc18Fixture();
  list = vi.fn(async () => f.list);
  finalization = vi.fn(async () => f.finalization);
  // Any new transaction, write, lock, live roster/PDF/eligibility read fails.
  tx = new Proxy(
    {
      defenseList: new Proxy(
        { findUnique: list },
        {
          get: (target, key) => {
            if (key !== "findUnique")
              throw new Error(`Unexpected list access ${String(key)}`);
            return target.findUnique;
          },
        },
      ),
      defenseListFinalization: new Proxy(
        { findUnique: finalization },
        {
          get: (target, key) => {
            if (key !== "findUnique")
              throw new Error(`Unexpected history access ${String(key)}`);
            return target.findUnique;
          },
        },
      ),
    },
    {
      get: (target, key) => {
        if (!(key in target))
          throw new Error(`Unexpected transaction access ${String(key)}`);
        return target[key as keyof typeof target];
      },
    },
  ) as unknown as Prisma.TransactionClient;
  reader = new PrismaUc18FinalizationReader(
    new Uc18FinalizationRepository(),
    new Uc18FinalizationValidator(),
  );
});

describe("Prisma UC18 authoritative finalization reader", () => {
  it("returns UNKNOWN when no coordinator exists", async () => {
    list.mockResolvedValue(null);
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_NOT_CONFIGURED",
    });
    expect(finalization).not.toHaveBeenCalled();
  });
  it("returns UNKNOWN for DRAFT even when other term data could look ready", async () => {
    Object.assign(f.list, {
      state: "DRAFT",
      openedAt: null,
      openedByUserId: null,
      currentFinalizationId: null,
    });
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_DRAFT",
    });
    expect(finalization).not.toHaveBeenCalled();
  });
  it("returns OPEN only for an explicitly opened coordinator without a pointer", async () => {
    f.open();
    expect(await read()).toEqual({
      state: "OPEN",
      scope: "TERM",
      termId: "term",
      revision: 2,
    });
    expect(finalization).not.toHaveBeenCalled();
  });
  it.each([
    ["openedAt", null],
    ["openedAt", new Date(NaN)],
    ["openedByUserId", null],
    ["openedByUserId", " "],
    ["currentFinalizationId", "old-pointer"],
    ["revision", -1],
    ["revision", 1.5],
    ["termId", "other-term"],
    ["updatedAt", new Date(NaN)],
    ["state", "ELIGIBLE"],
  ])("returns UNKNOWN for invalid OPEN metadata %s=%s", async (key, value) => {
    f.open();
    Object.assign(f.list, { [key]: value });
    expect(await read()).toMatchObject({ state: "UNKNOWN" });
    expect(finalization).not.toHaveBeenCalled();
  });
  it("verifies the pointed finalization and returns only safe historical metadata", async () => {
    expect(await read()).toEqual({
      state: "FINALIZED",
      scope: "TERM",
      termId: "term",
      revision: 2,
      finalizedAt: f.finalization.finalizedAt.toISOString(),
      finalizedByUserId: "faculty",
      evidence: {
        finalizationId: "finalization",
        version: 1,
        snapshotSchemaVersion: 1,
        contentHash: f.finalization.contentHash,
        integrity: "VERIFIED",
        freshness: "NOT_CHECKED",
      },
    });
    expect(list).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledWith({ where: { termId: "term" } });
    expect(finalization).toHaveBeenCalledOnce();
    expect(finalization).toHaveBeenCalledWith({
      where: { id: "finalization" },
    });
    expect(JSON.stringify(await read())).not.toMatch(
      /student-1|student-2|Do an.pdf|students|snapshot"/,
    );
  });
  it("returns UNKNOWN for a missing pointer target", async () => {
    finalization.mockResolvedValue(null);
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_FINALIZATION_MISSING",
    });
  });
  it.each([
    ["id", "other-pointer"],
    ["termId", "other-term"],
    ["listRevision", 3],
  ])("rejects pointer mismatch %s", async (key, value) => {
    Object.assign(f.finalization, { [key]: value });
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_FINALIZATION_POINTER_INVALID",
    });
  });
  it.each([
    ["currentFinalizationId", null],
    ["openedAt", null],
    ["openedByUserId", null],
  ])("rejects missing FINALIZED metadata %s", async (key, value) => {
    Object.assign(f.list, { [key]: value });
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_LIST_METADATA_INVALID",
    });
  });
  it.each([
    ["version", 0],
    ["finalizedAt", null],
    ["finalizedAt", new Date(NaN)],
    ["finalizedByUserId", ""],
    ["contentHash", "a".repeat(63)],
  ])("rejects incomplete history metadata %s", async (key, value) => {
    Object.assign(f.finalization, { [key]: value });
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_FINALIZATION_METADATA_INVALID",
    });
  });
  it("rejects unsupported snapshot version", async () => {
    f.finalization.snapshotSchemaVersion = 3;
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_SNAPSHOT_VERSION_UNSUPPORTED",
    });
  });
  it.each([null, [], "not JSON object", {}, { schemaVersion: 1 }])(
    "rejects malformed snapshot %s",
    async (snapshot) => {
      Object.assign(f.finalization, { snapshot });
      expect(await read()).toMatchObject({
        state: "UNKNOWN",
        reason: "UC18_SNAPSHOT_INVALID",
      });
    },
  );
  it("rejects a syntactically valid but incorrect 64-character hash", async () => {
    f.finalization.contentHash = "0".repeat(64);
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_SNAPSHOT_HASH_MISMATCH",
    });
  });
  it("detects tampering even in an excluded student's frozen data", async () => {
    f.snapshot.students[1].exclusionReasons.push("MODIFIED");
    expect(await read()).toMatchObject({
      state: "UNKNOWN",
      reason: "UC18_SNAPSHOT_HASH_MISMATCH",
    });
  });
  it.each([
    "termId",
    "listRevision",
    "finalizationVersion",
    "finalizedAt",
    "finalizedByUserId",
  ] as const)(
    "rejects a correctly hashed snapshot with different %s",
    async (key) => {
      Object.assign(f.snapshot, {
        [key]: {
          termId: "other-term",
          listRevision: 3,
          finalizationVersion: 2,
          finalizedAt: "2026-10-25T00:00:00.000Z",
          finalizedByUserId: "other-actor",
        }[key],
      });
      f.rehash();
      expect(await read()).toMatchObject({
        state: "UNKNOWN",
        reason: "UC18_SNAPSHOT_CONTEXT_INVALID",
      });
    },
  );
  it.each(["missing", "duplicate", "wrong-pair"])(
    "rejects %s snapshot member even with a matching hash",
    async (scenario) => {
      if (scenario === "missing") f.snapshot.students.pop();
      else if (scenario === "duplicate")
        f.snapshot.students[1] = structuredClone(f.snapshot.students[0]);
      else f.snapshot.students[1].studentId = "another-student";
      f.rehash();
      expect(await read()).toMatchObject({
        state: "UNKNOWN",
        reason: "UC18_SNAPSHOT_INVALID",
      });
    },
  );
  it("keeps historical FINALIZED regardless of current PDF/roster changes; performs no live reads or writes", async () => {
    // The proxy forbids all current FileAsset/FinalReport/TermStudent reads. They
    // can change or disappear without invalidating the sealed historical proof.
    const result = await read();
    expect(result).toMatchObject({
      state: "FINALIZED",
      evidence: { freshness: "NOT_CHECKED" },
    });
    expect(finalization).toHaveBeenCalledOnce();
  });
  it("passes the exact caller transaction to both repository calls", async () => {
    const repo = new Uc18FinalizationRepository();
    const listSpy = vi.spyOn(repo, "list"),
      historySpy = vi.spyOn(repo, "finalization");
    reader = new PrismaUc18FinalizationReader(
      repo,
      new Uc18FinalizationValidator(),
    );
    expect((await read()).state).toBe("FINALIZED");
    expect(listSpy.mock.calls[0][0]).toBe("term");
    expect(listSpy.mock.calls[0][1]).toBe(tx);
    expect(historySpy.mock.calls[0][0]).toBe("finalization");
    expect(historySpy.mock.calls[0][1]).toBe(tx);
  });
  it.each(["P2021", "P2022", "CONNECTION_FAILED"])(
    "fails closed when storage is unavailable (%s)",
    async (code) => {
      list.mockRejectedValue(
        Object.assign(new Error("secret database details"), { code }),
      );
      expect(await read()).toEqual({
        state: "UNKNOWN",
        scope: "TERM",
        termId: "term",
        reason: "UC18_SOURCE_OR_VERIFICATION_UNAVAILABLE",
      });
      expect(finalization).not.toHaveBeenCalled();
    },
  );
  it("fails closed when the history table is unavailable", async () => {
    finalization.mockRejectedValue({ code: "P2021" });
    expect(await read()).toMatchObject({ state: "UNKNOWN" });
  });
  it("fails closed on verification exceptions", async () => {
    const validator = new Uc18FinalizationValidator();
    vi.spyOn(validator, "snapshot").mockImplementation(() => {
      throw new Error("verification failure");
    });
    reader = new PrismaUc18FinalizationReader(
      new Uc18FinalizationRepository(),
      validator,
    );
    expect(await read()).toMatchObject({ state: "UNKNOWN" });
  });
  it("does not cache OPEN across reads or transactions", async () => {
    f.open();
    expect((await read()).state).toBe("OPEN");
    Object.assign(f.list, {
      state: "FINALIZED",
      currentFinalizationId: "finalization",
    });
    expect((await read()).state).toBe("FINALIZED");
  });
});
