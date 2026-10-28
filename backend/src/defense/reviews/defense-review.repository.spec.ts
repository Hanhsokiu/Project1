import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { Prisma } from "@prisma/client";
import { CommonModule } from "../../common/common.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { FileStorageService } from "../../common/storage/file-storage.service";
import {
  DefenseReviewRepository,
  DefenseReviewSession,
} from "./defense-review.repository";
import { DefenseReviewModule } from "./defense-review.module";
import { DefenseReviewService } from "./defense-review.service";
import { reviewFixture } from "./defense-review.test-fixtures";
describe("Defense review read-only repository and module", () => {
  it("uses one read transaction and no write delegates, scopes roster by server term/student", async () => {
    const rows = vi.fn(async () => []);
    const tx = {
      termStudent: { findMany: rows },
      proposal: { findMany: rows },
      registration: { findMany: rows },
      termLecturer: { findMany: rows },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: vi.fn(
        async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          work(tx),
      ),
    };
    const repo = new DefenseReviewRepository(
      prisma as unknown as PrismaService,
    );
    await repo.read(async (s) => {
      expect(s).toBeInstanceOf(DefenseReviewSession);
      await s.members("term", "student");
      await s.dossiers("term", "student");
      await s.assignments("term");
      await s.lecturerRoster("term");
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
      maxWait: 10000,
      timeout: 15000,
    });
    expect(rows).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { termId: "term", studentId: "student" },
      }),
    );
    expect(rows).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: { termId: "term" },
        include: expect.objectContaining({
          advisorAssignments: expect.objectContaining({
            where: { assignmentPlan: { status: "FINALIZED" } },
          }),
        }),
      }),
    );
  });
  it("wires real policies and neutral UC18 reader without creating a Prisma connection", async () => {
    const f = reviewFixture();
    const module = await Test.createTestingModule({
      imports: [PrismaModule, CommonModule, DefenseReviewModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(FileStorageService)
      .useValue({})
      .overrideProvider(DefenseReviewRepository)
      .useValue(f.repo)
      .compile();
    try {
      expect(module.get(DefenseReviewService)).toBeInstanceOf(
        DefenseReviewService,
      );
      expect(
        (await module.get(DefenseReviewService).terms("advisor-user")).items,
      ).toHaveLength(1);
    } finally {
      await module.close();
    }
  });
});
