import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DefenseConfirmationWindowRepository,
  WindowTransaction,
} from "./defense-confirmation-window.repository";

describe("Defense confirmation window repository transaction and CAS", () => {
  it("only uses the dedicated UC17 delegate, never the PDF window or six-phase plan", async () => {
    const findUnique = vi.fn().mockResolvedValue(null),
      create = vi.fn().mockResolvedValue({ revision: 1 });
    const pdf = vi.fn(),
      phases = vi.fn(),
      decisions = vi.fn(),
      eligibility = vi.fn();
    const tx = {
      defenseConfirmationWindow: { findUnique, create },
      finalReportSubmissionWindow: { findUnique: pdf },
      termPhase: { findMany: phases },
      defenseConfirmation: { update: decisions },
      defenseEligibility: { update: eligibility },
    } as unknown as WindowTransaction;
    const repo = new DefenseConfirmationWindowRepository({} as PrismaService);
    expect(await repo.window("term-1", tx)).toBeNull();
    const values = {
      opensAt: new Date("2026-12-01Z"),
      closesAt: new Date("2026-12-20Z"),
      isLocked: true,
    };
    await repo.create("term-1", values, tx);
    expect(findUnique).toHaveBeenCalledWith({ where: { termId: "term-1" } });
    expect(create).toHaveBeenCalledWith({
      data: { termId: "term-1", ...values, revision: 1 },
    });
    for (const other of [pdf, phases, decisions, eligibility])
      expect(other).not.toHaveBeenCalled();
  });
  it("locks the exact requested term using a parameterized query", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const repo = new DefenseConfirmationWindowRepository({} as PrismaService);
    await repo.lockTerm("term-legacy", {
      $queryRaw: query,
    } as unknown as WindowTransaction);
    expect(
      (query.mock.calls[0][0] as TemplateStringsArray).join("?"),
    ).toContain('"THESIS_TERM" WHERE id=? FOR UPDATE');
    expect(query.mock.calls[0][1]).toBe("term-legacy");
  });
  it("runs the operation in a serializable bounded transaction", async () => {
    const tx = {} as WindowTransaction,
      operation = vi.fn(async () => "ok");
    const prisma = { $transaction: vi.fn(async (fn) => fn(tx)) };
    const repo = new DefenseConfirmationWindowRepository(
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
      const repo = new DefenseConfirmationWindowRepository(
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
    const repo = new DefenseConfirmationWindowRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repo.transaction(async () => undefined)).rejects.toBe(error);
  });
  it("includes the expected revision in the atomic update predicate", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      defenseConfirmationWindow: { updateMany },
    } as unknown as WindowTransaction;
    const repo = new DefenseConfirmationWindowRepository({} as PrismaService);
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
