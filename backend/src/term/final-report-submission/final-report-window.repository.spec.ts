import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  FinalReportWindowRepository,
  WindowTransaction,
} from "./final-report-window.repository";

describe("Final report window repository transaction and CAS", () => {
  it("runs the operation in a serializable bounded transaction", async () => {
    const tx = {} as WindowTransaction,
      operation = vi.fn(async () => "ok");
    const prisma = { $transaction: vi.fn(async (fn) => fn(tx)) };
    const repo = new FinalReportWindowRepository(
      prisma as unknown as PrismaService,
    );
    expect(await repo.transaction(operation)).toBe("ok");
    expect(operation).toHaveBeenCalledWith(tx);
    expect(prisma.$transaction).toHaveBeenCalledWith(operation, {
      isolationLevel: "Serializable",
      maxWait: 10000,
      timeout: 15000,
    });
  });
  it.each(["P2002", "P2034"])(
    "maps concurrent creation/serialization error %s to 409",
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError("test conflict", {
        code,
        clientVersion: "5.22.0",
      });
      const prisma = { $transaction: vi.fn().mockRejectedValue(error) };
      const repo = new FinalReportWindowRepository(
        prisma as unknown as PrismaService,
      );
      await expect(
        repo.transaction(async () => undefined),
      ).rejects.toMatchObject({
        status: 409,
        response: { error: { code: "REVISION_CONFLICT" } },
      });
    },
  );
  it("does not mask unrelated database errors", async () => {
    const error = new Error("offline"),
      prisma = { $transaction: vi.fn().mockRejectedValue(error) };
    const repo = new FinalReportWindowRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repo.transaction(async () => undefined)).rejects.toBe(error);
  });
  it("includes the expected revision in the atomic update predicate", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      finalReportSubmissionWindow: { updateMany },
    } as unknown as WindowTransaction;
    const repo = new FinalReportWindowRepository({} as PrismaService);
    const values = {
      opensAt: new Date("2026-12-01Z"),
      closesAt: new Date("2026-12-20Z"),
      isLocked: false,
    };
    await repo.update("term-1", 7, values, tx);
    expect(updateMany).toHaveBeenCalledWith({
      where: { termId: "term-1", revision: 7 },
      data: { ...values, revision: { increment: 1 } },
    });
  });
});
