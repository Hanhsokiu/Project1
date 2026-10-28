import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { CommonModule } from "../../common/common.module";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { GradingSession, GradingRepository } from "./grading.repository";
import { GradingWorkflowModule } from "./grading-workflow.module";
import { GradingService } from "./grading.service";
import { ReportModule } from "../../report/report.module";
import { OfficialReportService } from "../../report/official/official-report.service";
import {
  AdvisorGradeReader,
  CouncilResultConfirmationReader,
} from "./advisor-grade.port";
describe("Grading repositories, module graph and migration static checks (SQL NOT EXECUTED)", () => {
  it("production grading/report modules wire with Prisma replaced before construction", async () => {
    const prisma = { $transaction: vi.fn() };
    const m = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
        PrismaModule,
        CommonModule,
        GradingWorkflowModule,
        ReportModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FileStorageService)
      .useValue({ readPrivateFinalReport: vi.fn() })
      .compile();
    try {
      expect(m.get(GradingService)).toBeInstanceOf(GradingService);
      expect(m.get(OfficialReportService)).toBeInstanceOf(
        OfficialReportService,
      );
      expect(
        await m
          .get(AdvisorGradeReader)
          .read("term", "proposal", {} as Prisma.TransactionClient),
      ).toEqual({ state: "UNKNOWN" });
      expect(
        await m
          .get(CouncilResultConfirmationReader)
          .read("term", "proposal", {} as Prisma.TransactionClient),
      ).toEqual({ state: "UNKNOWN" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    } finally {
      await m.close();
    }
  });
  it("term first, source rows first, bounded lock wait, then grading rows in a stable order", async () => {
    const raw = vi.fn().mockResolvedValue([]),
      s = new GradingSession({
        $queryRaw: raw,
      } as unknown as Prisma.TransactionClient);
    await s.lockGrading("term'unsafe");
    const sql = raw.mock.calls.map((args) =>
      (args[0] as TemplateStringsArray).join("?"),
    );
    expect(sql[0]).toContain("lock_timeout");
    expect(sql[1]).toContain('"THESIS_TERM"');
    expect(sql.join(" ").indexOf('"FINAL_REPORT"')).toBeLessThan(
      sql.join(" ").indexOf('"GRADING_POLICY"'),
    );
    expect(sql.at(-2)).toContain('"GRADING_SHEET"');
    expect(sql.at(-1)).toContain('"GRADING_RESULT"');
    expect(sql.join(" ")).not.toContain("term'unsafe");
  });
  it("transaction client supplied to operation is reused; no nested datasource", async () => {
    const tx = {} as Prisma.TransactionClient,
      prisma = {
        $transaction: vi.fn(
          async (
            work: (tx: Prisma.TransactionClient) => unknown,
            _options?: object,
          ) => work(tx),
        ),
      },
      repo = new GradingRepository(prisma as unknown as PrismaService);
    await repo.transaction(true, async (s, supplied) => {
      expect(s.gradingDb).toBe(tx);
      expect(supplied).toBe(tx);
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: "ReadCommitted",
      timeout: 60000,
    });
  });
  it.each(["P2021", "P2022", "P2010"])(
    "missing schema %s becomes controlled503",
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError("missing", {
          code,
          clientVersion: "unit",
          meta: { code: "42P01" },
        }),
        repo = new GradingRepository({
          $transaction: vi.fn().mockRejectedValue(error),
        } as unknown as PrismaService);
      await expect(
        repo.transaction(false, async () => undefined),
      ).rejects.toMatchObject({ status: 503 });
    },
  );
  it.each(["P2002", "P2034", "P2028"])(
    "race or timeout %s becomes409",
    async (code) => {
      const repo = new GradingRepository({
        $transaction: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("conflict", {
            code,
            clientVersion: "unit",
          }),
        ),
      } as unknown as PrismaService);
      await expect(
        repo.transaction(true, async () => undefined),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it("one additive migration does not mutate or backfill existing scores", () => {
    const sql = readFileSync(
      resolve(
        __dirname,
        "../../../prisma/migrations/202610280002_grading_workflows/migration.sql",
      ),
      "utf8",
    );
    expect(sql).not.toMatch(
      /DROP\s+(TABLE|COLUMN|TYPE)|DELETE\s+FROM|TRUNCATE\s+TABLE|INSERT\s+INTO|ALTER\s+COLUMN/i,
    );
    expect(sql).not.toMatch(
      /ALTER TABLE public\."(SCORE_ENTRY|SCORE_DETAIL|FINAL_RESULT)"/,
    );
    expect(sql.match(/CREATE TABLE /g)).toHaveLength(6);
    expect(sql.match(/BEFORE UPDATE OR DELETE OR TRUNCATE/g)).toHaveLength(3);
    expect(sql).toContain("grading_sheet_source_fk");
    expect(sql).toContain(
      "(source_artifact_id, term_id, source_stage, source_revision)",
    );
    expect(sql).toContain("grading_result_policy_fk");
    expect(sql).toContain("SQL NOT EXECUTED");
  });
  it("permission definitions have no ADMIN grant or calculation-approval action", async () => {
    const requireFile = createRequire(__filename),
      helper = requireFile(
        "../../../prisma/grading-workflow-permissions.cjs",
      ) as {
        seedGradingWorkflowPermissions: (
          prisma: unknown,
          f: string,
          l: string,
          s: string,
        ) => Promise<void>;
      },
      prisma = {
        permission: {
          upsert: vi.fn(
            async (arg: { create: { resource: string; action: string } }) => ({
              id: `${arg.create.resource}:${arg.create.action}`,
            }),
          ),
        },
        rolePermission: { upsert: vi.fn(async () => undefined) },
      };
    await helper.seedGradingWorkflowPermissions(
      prisma,
      "FACULTY",
      "LECTURER",
      "STUDENT",
    );
    const text = JSON.stringify(prisma.rolePermission.upsert.mock.calls);
    expect(text).not.toContain("ADMIN");
    expect(text).not.toContain("approve");
    expect(text).toContain("grading:read-published");
  });
});
