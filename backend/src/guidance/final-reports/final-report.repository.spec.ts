import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  FinalReportRepository,
  ReportTransaction,
} from "./final-report.repository";
import { PrismaService } from "../../prisma/prisma.service";

describe("Final report atomic persistence", () => {
  it("uses fresh statement snapshots after lock waits and bounded transactions", async () => {
    const tx = {},
      operation = vi.fn(async () => "ok");
    const prisma = { $transaction: vi.fn(async (fn) => fn(tx)) };
    const repo = new FinalReportRepository(prisma as unknown as PrismaService);
    expect(await repo.transaction(operation)).toBe("ok");
    expect(prisma.$transaction).toHaveBeenCalledWith(operation, {
      isolationLevel: "ReadCommitted",
      maxWait: 10000,
      timeout: 15000,
    });
  });
  it.each(["P2002", "P2034"])(
    "maps concurrency failure %s to 409",
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError("conflict", {
        code,
        clientVersion: "5.22.0",
      });
      const prisma = { $transaction: vi.fn().mockRejectedValue(error) };
      await expect(
        new FinalReportRepository(
          prisma as unknown as PrismaService,
        ).transaction(async () => undefined),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it.each([false, true])(
    "gates the final DB write on clock_timestamp and independent window (exists=%s)",
    async (exists) => {
      const query = vi.fn().mockResolvedValue([{ id: "report" }]);
      const tx = { $queryRaw: query } as unknown as ReportTransaction;
      const repo = new FinalReportRepository({} as PrismaService);
      await repo.swap("proposal", "term", "report", "asset", 3, exists, tx);
      const sql = (query.mock.calls[0][0] as TemplateStringsArray).join("?");
      expect(sql).toContain("clock_timestamp()");
      expect(sql).toContain('"FINAL_REPORT_SUBMISSION_WINDOW"');
      expect(sql).toContain("a.at<w.closes_at");
      expect(sql).toContain("NOT w.is_locked");
      if (exists) expect(sql).toContain("r.revision=?");
      expect(sql).not.toMatch(
        /TERM_PHASE|DEFENSE_CONFIRMATION|DEFENSE_ELIGIBILITY|SCORE_ENTRY/,
      );
    },
  );
  it("does not treat a zero-row guarded write as a successful submission", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    } as unknown as ReportTransaction;
    await expect(
      new FinalReportRepository({} as PrismaService).swap(
        "proposal",
        "term",
        "report",
        "asset",
        0,
        false,
        tx,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("uses parameterized key locks shared with cleanup and downloads", async () => {
    const query = vi.fn().mockResolvedValue([]),
      key = "final-reports/untrusted'quoted";
    const repo = new FinalReportRepository({} as PrismaService);
    await repo.lockKey(key, {
      $queryRaw: query,
    } as unknown as ReportTransaction);
    expect(
      (query.mock.calls[0][0] as TemplateStringsArray).join("?"),
    ).toContain("pg_advisory_xact_lock");
    expect(query.mock.calls[0][1]).toBe(key);
  });
});
