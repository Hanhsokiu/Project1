import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { CommonModule } from "../../common/common.module";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import { PrismaUc18FinalizationReader } from "../../common/uc18-finalization/prisma-uc18-finalization.reader";
import { uc18Fixture } from "../../common/uc18-finalization/uc18-finalization.test-fixtures";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import { fixture } from "./defense-confirmation.test-fixtures";
import {
  DefenseConfirmationRepository,
  DefenseConfirmationSession,
} from "./defense-confirmation.repository";
import { DefenseConfirmationModule } from "./defense-confirmation.module";
import { DefenseConfirmationContextService } from "./defense-confirmation-context.service";

describe("UC17 repository read boundary", () => {
  it("reads decision people using only public name/ID projections", async () => {
    const findUnique = vi.fn();
    const s = new DefenseConfirmationSession({
      defenseConfirmation: { findUnique },
    } as unknown as Prisma.TransactionClient);
    await s.decisionRecord("proposal");
    expect(findUnique).toHaveBeenCalledWith({
      where: { proposalId: "proposal" },
      include: {
        decidedBy: { select: { id: true, displayName: true } },
        advisor: { select: { id: true, fullName: true } },
      },
    });
  });
  it("reads only the proposal's decision history with stable revision ordering and a bounded cursor", async () => {
    const findMany = vi.fn();
    const s = new DefenseConfirmationSession({
      defenseConfirmationHistory: { findMany },
    } as unknown as Prisma.TransactionClient);
    await s.decisionHistory("proposal", 2, 50);
    expect(findMany).toHaveBeenCalledWith({
      where: { confirmation: { proposalId: "proposal" }, revision: { gt: 2 } },
      include: {
        actor: { select: { id: true, displayName: true } },
        advisor: { select: { id: true, fullName: true } },
      },
      orderBy: [{ revision: "asc" }, { id: "asc" }],
      take: 51,
    });
  });
  it("uses one repeatable-read transaction and forwards it to consumers", async () => {
    const tx = {} as Prisma.TransactionClient;
    const transaction = vi.fn(
      async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx),
    );
    const repo = new DefenseConfirmationRepository({
      $transaction: transaction,
    } as unknown as PrismaService);
    await expect(
      repo.read(async (s, received) => {
        expect(s).toBeInstanceOf(DefenseConfirmationSession);
        expect(received).toBe(tx);
        return "read-only-context";
      }),
    ).resolves.toBe("read-only-context");
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "RepeatableRead" }),
    );
  });
  it("reads current decisions/windows/reports by their unique business owner", async () => {
    const window = vi.fn(),
      decision = vi.fn(),
      report = vi.fn();
    const s = new DefenseConfirmationSession({
      defenseConfirmationWindow: { findUnique: window },
      defenseConfirmation: { findUnique: decision },
      finalReport: { findUnique: report },
    } as unknown as Prisma.TransactionClient);
    await s.window("term");
    await s.currentDecision("proposal");
    await s.report("proposal");
    expect(window).toHaveBeenCalledWith({ where: { termId: "term" } });
    expect(decision).toHaveBeenCalledWith({
      where: { proposalId: "proposal" },
    });
    expect(report).toHaveBeenCalledWith({
      where: { proposalId: "proposal" },
      include: { fileAsset: true },
    });
  });
  it("scopes progress/assessment queries to the selected plan", async () => {
    const evaluations = vi.fn(),
      notes = vi.fn();
    const s = new DefenseConfirmationSession({
      phaseEvaluation: { findMany: evaluations },
      taskProgressEvent: { findMany: notes },
    } as unknown as Prisma.TransactionClient);
    await s.evaluations("plan");
    await s.taskProgress("plan");
    expect(evaluations).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guidancePlanId: "plan" } }),
    );
    expect(notes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { refTaskId: { guidancePlanId: "plan" } },
      }),
    );
  });
  it("reuses assignment selection and prefers the explicit official plan over published alternatives", async () => {
    const query = vi.fn().mockResolvedValue({
      term: {
        pr2bTermWorkflowTermId: { officialAssignmentPlanId: "official" },
      },
      advisorAssignments: [
        { id: "draft-choice", assignmentPlanId: "published" },
        { id: "official-choice", assignmentPlanId: "official" },
      ],
    });
    const s = new DefenseConfirmationSession({
      registration: { findUnique: query },
    } as unknown as Prisma.TransactionClient);
    expect((await s.advisor("term", "student"))!.advisorAssignment!.id).toBe(
      "official-choice",
    );
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { termId_studentId: { termId: "term", studentId: "student" } },
      }),
    );
  });
  it("can be wired into Nest without instantiating or connecting a real Prisma client", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValue(new Error("Read transaction probe"));
    const module = await Test.createTestingModule({
      imports: [PrismaModule, CommonModule, DefenseConfirmationModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $transaction: transaction })
      .overrideProvider(FileStorageService)
      .useValue({})
      .compile();
    const service = module.get(DefenseConfirmationContextService);
    await expect(service.read("user", "proposal")).rejects.toThrow(
      "Read transaction probe",
    );
    expect(transaction).toHaveBeenCalledOnce();
    const f = fixture();
    expect(
      module.get(DefenseConfirmationValidator).principal(f.user, f.user.id),
    ).toBe(f.user);
    const reader = module.get(Uc18FinalizationReader);
    expect(reader).toBeInstanceOf(PrismaUc18FinalizationReader);
    const source = uc18Fixture();
    source.open();
    const list = vi.fn().mockResolvedValue(source.list);
    expect(
      await reader.read("term", {
        defenseList: { findUnique: list },
      } as unknown as Prisma.TransactionClient),
    ).toMatchObject({ state: "OPEN", revision: 2 });
    expect(list).toHaveBeenCalledWith({ where: { termId: "term" } });
    await module.close();
  });
});
