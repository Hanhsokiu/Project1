import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { GuidanceSession } from "./guidance.repository";
import { GuidanceValidator } from "./guidance.validator";

describe("canonical guidance phase", () => {
  function setup(locked = false) {
    const phase = {
      id: "weekly",
      termId: "term",
      isLocked: locked,
      startDate: new Date(Date.now() - 60000),
      endDate: new Date(Date.now() + 60000),
    };
    const tx = {
      termPhaseWorkflow: { findUnique: vi.fn().mockResolvedValue(null) },
      termPhase: { findFirst: vi.fn().mockResolvedValue(phase) },
    };
    const session = new GuidanceSession(
      tx as unknown as Prisma.TransactionClient,
    );
    return { phase, session, tx };
  }
  it("reads the existing WEEKLY schedule without writing or creating a second phase", async () => {
    const { phase, session, tx } = setup();
    expect((await session.guidancePhase("term"))?.refPhaseId).toBe(phase);
    expect(tx.termPhase.findFirst).toHaveBeenCalledWith({
      where: { termId: "term", code: "WEEKLY" },
      orderBy: { id: "asc" },
    });
  });
  it("honors the canonical phase lock even when the older workflow link is missing", async () => {
    const { session } = setup(true);
    vi.spyOn(session, "term").mockResolvedValue({
      id: "term",
      status: "IN_PROGRESS",
      isLocked: false,
      startDate: new Date(Date.now() - 120000),
      endDate: new Date(Date.now() + 120000),
    } as never);
    await expect(
      new GuidanceValidator({} as never).phase(session, "term"),
    ).rejects.toMatchObject({ response: { error: { code: "TERM_003" } } });
  });
  it("preserves an existing explicit workflow mapping", async () => {
    const { phase, session, tx } = setup();
    tx.termPhaseWorkflow.findUnique.mockResolvedValue({
      phaseId: "weekly",
      refPhaseId: phase,
    } as never);
    expect((await session.guidancePhase("term"))?.refPhaseId).toBe(phase);
    expect(tx.termPhase.findFirst).not.toHaveBeenCalled();
  });
});
