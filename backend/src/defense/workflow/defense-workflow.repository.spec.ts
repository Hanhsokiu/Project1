import "reflect-metadata";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../../prisma/prisma.module";
import { CommonModule } from "../../common/common.module";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { DefenseWorkflowModule } from "./defense-workflow.module";
import { DefenseWorkflowService } from "./defense-workflow.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DefenseWorkflowRepository,
  DefenseWorkflowSession,
} from "./defense-workflow.repository";
describe("Official workflow repository protocol, no connection", () => {
  it("wires the production feature module with Prisma overridden before instantiation", async () => {
    const prisma = { $transaction: vi.fn() };
    const m = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
        PrismaModule,
        CommonModule,
        DefenseWorkflowModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FileStorageService)
      .useValue({ readPrivateFinalReport: vi.fn() })
      .compile();
    try {
      expect(m.get(DefenseWorkflowService)).toBeInstanceOf(
        DefenseWorkflowService,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    } finally {
      await m.close();
    }
  });
  it("locks THESIS_TERM before any child, bounded wait, caller-owned transaction", async () => {
    const raw = vi.fn().mockResolvedValue([]);
    const s = new DefenseWorkflowSession({
      $queryRaw: raw,
    } as unknown as Prisma.TransactionClient);
    await s.lock("term'quoted");
    const sql = raw.mock.calls.map((args) =>
      (args[0] as TemplateStringsArray).join("?"),
    );
    expect(sql[0]).toContain("lock_timeout");
    expect(sql[1]).toContain('"THESIS_TERM"');
    expect(sql[2]).toContain('"DEFENSE_LIST"');
    expect(sql[3]).toContain("ORDER BY stage FOR UPDATE");
    expect(sql.join(" ")).toContain('"TERM_WORKFLOW" WHERE "termId"=?');
    expect(sql.join(" ")).toContain('p.id=w."planId"');
    expect(sql.join(" ")).toContain('a.id=c."assignmentId"');
    expect(sql.join(" ")).not.toContain("term'quoted");
  });
  it("sorts/deduplicates cross-term resource locks and uses database wall clock", async () => {
    const raw = vi.fn().mockResolvedValue([{ at: new Date("2026-10-28Z") }]);
    const s = new DefenseWorkflowSession({
      $queryRaw: raw,
    } as unknown as Prisma.TransactionClient);
    await s.resources(["ROOM:b", "LECTURER:z", "ROOM:b", "ROOM:a"]);
    expect(raw.mock.calls.slice(0, 3).map((c) => c[1])).toEqual([
      "defense-booking:LECTURER:z",
      "defense-booking:ROOM:a",
      "defense-booking:ROOM:b",
    ]);
    expect((raw.mock.calls[3][0] as TemplateStringsArray).join("?")).toContain(
      '"ROOM"',
    );
    await s.now();
    expect(
      (
        raw.mock.calls[raw.mock.calls.length - 1][0] as TemplateStringsArray
      ).join(""),
    ).toContain("clock_timestamp()");
  });
  it("uses fresh reads for writes and repeatable reads only for read context", async () => {
    const tx = {} as Prisma.TransactionClient,
      transaction = vi.fn(
        async (
          work: (t: Prisma.TransactionClient) => Promise<unknown>,
          _options: unknown,
        ) => work(tx),
      );
    const repo = new DefenseWorkflowRepository({
      $transaction: transaction,
    } as unknown as PrismaService);
    const work = vi.fn(
      async (_s: DefenseWorkflowSession, t: Prisma.TransactionClient) =>
        t === tx,
    );
    expect(await repo.transaction(true, work)).toBe(true);
    expect(transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: "ReadCommitted",
      timeout: 60000,
    });
    await repo.transaction(false, work);
    expect(transaction.mock.calls[1][1]).toMatchObject({
      isolationLevel: "RepeatableRead",
    });
  });
  it.each(["P2021", "P2022"])(
    "returns controlled unavailable for %s, never emulates persistence",
    async (code) => {
      const repo = new DefenseWorkflowRepository({
        $transaction: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("private SQL", {
            code,
            clientVersion: "5",
          }),
        ),
      } as unknown as PrismaService);
      await expect(
        repo.transaction(true, async () => true),
      ).rejects.toMatchObject({ status: 503 });
    },
  );
  it.each([
    ["42P01", 503],
    ["42703", 503],
    ["55P03", 409],
    ["40P01", 409],
    ["57014", 409],
  ])("maps raw SQL %s safely to %s", async (code, status) => {
    const repo = new DefenseWorkflowRepository({
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("private SQL", {
          code: "P2010",
          clientVersion: "5",
          meta: { code },
        }),
      ),
    } as unknown as PrismaService);
    await expect(
      repo.transaction(true, async () => true),
    ).rejects.toMatchObject({ status });
  });
});
describe("Package E migration/permission definitions, STATIC ONLY", () => {
  const sql = readFileSync(
    resolve(
      __dirname,
      "../../../prisma/migrations/202610280001_official_defense_workflows/migration.sql",
    ),
    "utf8",
  );
  it("contains additive objects, no data manipulation or destructive DDL", () => {
    expect(sql).not.toMatch(
      /\b(DROP\s+(TABLE|COLUMN|TYPE)|TRUNCATE\s+TABLE|INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|ALTER\s+COLUMN)\b/i,
    );
    expect(sql).toContain("SQL NOT EXECUTED");
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(3);
  });
  it("enforces exact-term/revision current and upstream pointers, immutable insertable artifacts", () => {
    expect(sql).toContain("(current_artifact_id, term_id, stage, revision)");
    expect(sql).toContain(
      "(upstream_artifact_id, term_id, upstream_stage, upstream_revision)",
    );
    expect(sql).toContain(
      "(source_finalization_id, term_id, source_list_revision)",
    );
    expect(sql).toContain("IS TRUE");
    expect(sql.match(/BEFORE UPDATE OR DELETE OR TRUNCATE/g)).toHaveLength(2);
    expect(sql).not.toMatch(/BEFORE INSERT/);
    expect(sql).toContain("ON DELETE RESTRICT");
  });
  it("does not add history FKs into editable roster or deleted PDF assets", () => {
    expect(sql).not.toMatch(
      /REFERENCES[^\n]*(TERM_STUDENT|PROPOSAL|FILE_ASSET|FINAL_REPORT)/,
    );
  });
  it("defines permissions without default grants, data or ADMIN bypass", async () => {
    const require = createRequire(__filename);
    const { seedDefenseWorkflowPermissions } =
      require("../../../prisma/defense-workflow-permissions.cjs") as {
        seedDefenseWorkflowPermissions: (
          db: unknown,
          ...roles: string[]
        ) => Promise<void>;
      };
    const db = {
      permission: { upsert: vi.fn(async () => ({ id: "permission" })) },
      rolePermission: { upsert: vi.fn() },
    };
    await seedDefenseWorkflowPermissions(db, "faculty", "lecturer", "student");
    expect(db.permission.upsert).toHaveBeenCalledTimes(8);
    expect(db.rolePermission.upsert).toHaveBeenCalledTimes(10);
    expect(JSON.stringify(db.rolePermission.upsert.mock.calls)).not.toContain(
      "ADMIN",
    );
  });
});
