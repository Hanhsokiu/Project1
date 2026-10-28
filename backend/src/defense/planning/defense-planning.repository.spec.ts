import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import { DefensePlanningModule } from "./defense-planning.module";
import { DefensePlanningService } from "./defense-planning.service";
import { planningFixture } from "./defense-planning.test-fixtures";
import {
  DefensePlanningRepository,
  DefensePlanningSession,
} from "./defense-planning.repository";
describe("Defense planning repository and permission definition", () => {
  it("wires the real Nest module without a database connection", async () => {
    const f = planningFixture();
    const m = await Test.createTestingModule({
      imports: [PrismaModule, DefensePlanningModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(DefensePlanningRepository)
      .useValue(f.repo)
      .overrideProvider(Uc18FinalizationReader)
      .useValue(f.reader)
      .compile();
    try {
      expect(
        (await m.get(DefensePlanningService).context("advisor-user", "term"))
          .source.kind,
      ).toBe("ROSTER_PREVIEW");
    } finally {
      await m.close();
    }
  });
  it("uses a read-only callback in one RepeatableRead transaction with caller session", async () => {
    const raw = {
      room: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn(async () => []),
    };
    const tx = raw as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: vi.fn(
        async (work: (s: Prisma.TransactionClient) => Promise<unknown>) =>
          work(tx),
      ),
    };
    const repo = new DefensePlanningRepository(
      prisma as unknown as PrismaService,
    );
    await repo.read(async (s, t) => {
      expect(t).toBe(tx);
      expect(s).toBeInstanceOf(DefensePlanningSession);
      await s.rooms();
      await s.busySessions(new Date("2026-11-02Z"), new Date("2026-11-03Z"));
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
      maxWait: 10000,
      timeout: 15000,
    });
    expect(raw.$queryRaw).toHaveBeenCalledTimes(1);
  });
  it("missing storage is 503 rather than a fake empty official plan", async () => {
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("missing", {
          code: "P2021",
          clientVersion: "5.22",
        }),
      ),
    };
    const repo = new DefensePlanningRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repo.read(async () => [])).rejects.toMatchObject({
      status: 503,
    });
  });
  it("defines only explicit faculty read/preview permission with no grant or data creation", async () => {
    const req = createRequire(__filename);
    const helper = req("../../../prisma/defense-planning-permissions.cjs") as {
      seedDefensePlanningPermissions: (
        db: unknown,
        roleId: string,
      ) => Promise<void>;
    };
    const db = {
      permission: {
        upsert: vi.fn(async (v: { create: { action: string } }) => ({
          id: v.create.action,
        })),
      },
      rolePermission: { upsert: vi.fn() },
    };
    await helper.seedDefensePlanningPermissions(db, "faculty-role");
    expect(db.permission.upsert).toHaveBeenCalledTimes(2);
    expect(db.rolePermission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { roleId: "faculty-role", permissionId: "preview" },
      }),
    );
    expect(JSON.stringify(db.permission.upsert.mock.calls)).not.toMatch(
      /manage|publish|finalize|ADMIN/,
    );
  });
});
