import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  CommitteeGradeRepository,
  CommitteeGradeSession,
} from "./committee-grade.repository";
import type { PrismaService } from "../../prisma/prisma.service";
describe("UC23 Prisma boundary and migration compatibility (not a PostgreSQL rehearsal)", () => {
  it("uses caller sessions, RepeatableRead/Serializable and maps serialization conflict", async () => {
    const transaction = vi.fn(
        async (fn: (s: unknown) => Promise<unknown>, _options: unknown) =>
          fn({}),
      ),
      repo = new CommitteeGradeRepository({
        $transaction: transaction,
      } as unknown as PrismaService);
    await repo.read(async (s) => {
      expect(s).toBeInstanceOf(CommitteeGradeSession);
      return true;
    });
    await repo.write(async () => true);
    expect(transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: "RepeatableRead",
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
  it("CAS always selects canonical committee owner/role and never adopts another record", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 }),
      s = new CommitteeGradeSession({ scoreEntry: { updateMany } } as never);
    await expect(
      s.cgSave(
        "p",
        "l",
        1,
        { id: "s", proposalId: "p", scorerId: "l", role: "REVIEWER" },
        {},
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(updateMany.mock.calls[0][0].where).toMatchObject({
      proposalId: "p",
      scorerId: "l",
      role: "COMMITTEE_MEMBER",
      revision: 1,
      isLocked: false,
    });
  });
  it("first insert relies on unique instead of upsert/legacy adoption", async () => {
    const create = vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("TEST_ONLY", {
          code: "P2002",
          clientVersion: "TEST_ONLY",
        }),
      ),
      s = new CommitteeGradeSession({ scoreEntry: { create } } as never);
    await expect(
      s.cgSave(
        "p",
        "l",
        0,
        { id: "s", proposalId: "p", scorerId: "l", role: "ADVISOR" },
        {},
      ),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(create.mock.calls[0][0].data.role).toBe("COMMITTEE_MEMBER");
  });
  it("partial/missing UC23 guards fail closed even when prior schema exists", async () => {
    const s = new CommitteeGradeSession({
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { name: "cg_record_valid" },
          { name: "cg_score_guard" },
        ]),
    } as never);
    vi.spyOn(s, "rgReady").mockResolvedValue(true);
    vi.spyOn(s, "ccReady").mockResolvedValue(true);
    vi.spyOn(s, "scReady").mockResolvedValue(true);
    expect(await s.cgReady()).toBe(false);
  });
  it("SQL review retains both ADVISOR/REVIEWER branches and their guards when adding committee branch", () => {
    const sql = readFileSync(
        resolve("prisma/review/defense-committee-grading/migration.sql"),
        "utf8",
      ),
      constraint = sql.slice(
        sql.indexOf("ADD CONSTRAINT final_advisor_score_valid"),
        sql.indexOf("ADD CONSTRAINT cg_record_valid"),
      );
    for (const role of ["ADVISOR", "REVIEWER", "COMMITTEE_MEMBER"])
      expect(constraint).toContain(`role='${role}'`);
    expect(constraint).toContain("length(btrim(coalesce(comment,'')))>0");
    expect(sql).not.toMatch(/DROP\s+(?:TRIGGER|FUNCTION).*rg_/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE.*(?:DROP\s+COLUMN|ALTER\s+COLUMN)/i);
  });
});
