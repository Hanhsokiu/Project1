import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseConfirmationReportRepository } from "./defense-confirmation-report.repository";
import { reportFixture } from "./defense-confirmation-report.test-fixtures";

describe("UC17 PDF read repository", () => {
  it("uses only the transaction client for locks and reads, without business writes", async () => {
    const f = reportFixture();
    await f.download();
    expect(f.raw.finalReport.findUnique).toHaveBeenCalledWith({
      where: { proposalId: "proposal" },
      include: { fileAsset: true },
    });
    const sql = f.raw.$queryRaw.mock.calls.map(([parts]) => parts.join("?"));
    expect(sql.length).toBeGreaterThan(0);
    expect(sql.every((s) => /^\s*SELECT\b/.test(s))).toBe(true);
    expect(sql.join(" ")).not.toMatch(
      /\b(INSERT|UPDATE\s+public|DELETE|TRUNCATE)\b/i,
    );
    expect(f.forbidden).not.toHaveBeenCalled();
    expect(f.raw.defenseConfirmationHistory.create).not.toHaveBeenCalled();
    expect(f.raw.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ["P2021", undefined],
    ["P2022", undefined],
    ["P2010", { code: "42P01" }],
    ["P2010", { code: "42703" }],
  ] as const)(
    "fails closed when a migration source is unavailable: %s %j",
    async (code, meta) => {
      const prisma = {
        $transaction: vi
          .fn()
          .mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("missing private source", {
              code,
              meta,
              clientVersion: "5.22.0",
            }),
          ),
      };
      const repo = new DefenseConfirmationReportRepository(
        prisma as unknown as PrismaService,
      );
      await expect(repo.read(async () => "OPEN")).rejects.toMatchObject({
        status: 503,
        response: { error: { code: "UC17_STORAGE_UNAVAILABLE" } },
      });
    },
  );

  it("returns a conflict rather than a file on a transaction serialization failure", async () => {
    const f = reportFixture();
    f.prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("serialization failure", {
        code: "P2034",
        clientVersion: "5.22.0",
      }),
    );
    await expect(f.download()).rejects.toMatchObject({ status: 409 });
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });
});
