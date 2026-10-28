import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../final-reports/final-report.validator";
import { SubmissionValidator } from "../submissions/submission.validator";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { PrismaUc18FinalizationReader } from "../../common/uc18-finalization/prisma-uc18-finalization.reader";
import { Uc18FinalizationRepository } from "../../common/uc18-finalization/uc18-finalization.repository";
import { Uc18FinalizationValidator } from "../../common/uc18-finalization/uc18-finalization.validator";
import { uc18Fixture } from "../../common/uc18-finalization/uc18-finalization.test-fixtures";
import {
  Uc18FinalizationReader,
  type Uc18Finalization,
} from "../../common/contracts/uc18-finalization.port";
import { DefenseConfirmationContextService } from "./defense-confirmation-context.service";
import { DefenseConfirmationRepository } from "./defense-confirmation.repository";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import { DefenseConfirmationProgressValidator } from "./defense-confirmation-progress.validator";
import { at, bytes, fixture, key } from "./defense-confirmation.test-fixtures";
import type {
  DefenseConfirmationContext,
  ExpectedDecisionContext,
} from "./defense-confirmation.types";

let f: ReturnType<typeof fixture>,
  s: Record<string, ReturnType<typeof vi.fn>>,
  storage: { readPrivateFinalReport: ReturnType<typeof vi.fn> },
  service: DefenseConfirmationContextService,
  v: DefenseConfirmationValidator,
  finalization: Uc18FinalizationReader,
  tx: Prisma.TransactionClient,
  listQuery: ReturnType<typeof vi.fn>,
  historyQuery: ReturnType<typeof vi.fn>;
const build = () => {
  const repo = {
    read: async (
      fn: (
        session: typeof s,
        transaction: Prisma.TransactionClient,
      ) => Promise<unknown>,
    ) => fn(s, tx),
  } as unknown as DefenseConfirmationRepository;
  service = new DefenseConfirmationContextService(
    repo,
    v,
    new DefenseConfirmationProgressValidator(),
    storage as unknown as FileStorageService,
    finalization,
  );
};
const read = () => service.read("advisor-user", "proposal");
const expected = (c: DefenseConfirmationContext): ExpectedDecisionContext => ({
  revision: c.decision.revision,
  assignment: { assignmentId: "assignment", revision: 0 },
  pdf: c.pdf.snapshot,
});
const open = () => {
  finalization = {
    read: vi.fn().mockResolvedValue({
      state: "OPEN",
      scope: "TERM",
      termId: "term",
      revision: 0,
    } satisfies Uc18Finalization),
  };
  build();
};
beforeEach(() => {
  f = fixture();
  v = new DefenseConfirmationValidator(
    new ProposalReviewValidator(),
    new FinalReportValidator(),
    new SubmissionValidator(),
  );
  s = {
    principal: vi.fn(async () => f.user),
    proposal: vi.fn(async () => f.proposal),
    term: vi.fn(async () => f.term),
    advisor: vi.fn(async () => f.registration),
    roster: vi.fn(async () => f.roster),
    now: vi.fn(async () => at),
    window: vi.fn(async () => f.window),
    currentDecision: vi.fn(async () => f.decision),
    report: vi.fn(async () => f.report),
    planFor: vi.fn(async () => f.plan),
    monitorTasks: vi.fn(async () => f.tasks),
    evaluations: vi.fn(async () => f.evaluations),
    taskProgress: vi.fn(async () => []),
  };
  storage = { readPrivateFinalReport: vi.fn(async () => bytes) };
  listQuery = vi.fn().mockResolvedValue(null);
  historyQuery = vi.fn();
  tx = {
    defenseList: { findUnique: listQuery },
    defenseListFinalization: { findUnique: historyQuery },
  } as unknown as Prisma.TransactionClient;
  finalization = new PrismaUc18FinalizationReader(
    new Uc18FinalizationRepository(),
    new Uc18FinalizationValidator(),
  );
  build();
});

describe("UC17 internal context reader", () => {
  it("assembles verified current facts, warnings and UNKNOWN without returning private keys", async () => {
    const c = await read();
    expect(c).toMatchObject({
      code: "DEFENSE_CONFIRMATION",
      proposal: { id: "proposal", studentId: "student" },
      student: { code: "SV01" },
      advisor: { state: "OFFICIAL" },
      window: { state: "OPEN" },
      decision: { state: "RECORDED", revision: 1 },
      pdf: { state: "READY" },
      uc18: { state: "UNKNOWN" },
      pdfChangedSinceDecision: false,
      advisorChangedSinceDecision: false,
      confirmationApplicableToCurrentContext: true,
      progress: { summary: { incomplete: 1 } },
    });
    expect(c.readiness.confirm.allowed).toBe(false);
    expect(c.readiness.reject.allowed).toBe(false);
    expect(c.readiness.confirm.blockers.map((b) => b.code)).toEqual([
      "UC18_FINALIZATION_UNKNOWN",
    ]);
    expect(storage.readPrivateFinalReport).toHaveBeenCalledWith(
      key,
      100 * 1024 * 1024,
    );
    expect(JSON.stringify(c)).not.toMatch(
      /storageKey|filePath|password|private-final/,
    );
  });
  it("checks permissions and scope before loading PDF, decisions or progress", async () => {
    f.user.lecturer!.id = "wrong-advisor";
    await expect(read()).rejects.toThrow();
    expect(s.report).not.toHaveBeenCalled();
    expect(s.currentDecision).not.toHaveBeenCalled();
    expect(s.planFor).not.toHaveBeenCalled();
    expect(storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });
  it("rejects unavailable account or proposal without touching private storage", async () => {
    s.principal.mockResolvedValue(null);
    await expect(read()).rejects.toThrow();
    expect(s.proposal).not.toHaveBeenCalled();
    s.principal.mockResolvedValue(f.user);
    s.proposal.mockResolvedValue(null);
    await expect(read()).rejects.toThrow();
    expect(storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });
  it("does not authorize against PUBLISHED assignment or guidance plan's advisor", async () => {
    f.registration.advisorAssignment!.assignmentPlan.status = "PUBLISHED";
    await expect(read()).rejects.toThrow();
    expect(s.planFor).not.toHaveBeenCalled();
  });
  it("unknown UC18 source blocks assertWritable for both decisions", async () => {
    const c = await read();
    for (const status of ["CONFIRMED", "REJECTED"] as const)
      expect(() => v.assertWritable(c, status, expected(c))).toThrow();
  });
  it("reads Prisma OPEN through the same transaction and retains all UC17 checks", async () => {
    const source = uc18Fixture();
    source.open();
    listQuery.mockResolvedValue(source.list);
    const c = await read();
    expect(listQuery).toHaveBeenCalledWith({ where: { termId: "term" } });
    expect(historyQuery).not.toHaveBeenCalled();
    expect(c.uc18.state).toBe("OPEN");
    expect(() => v.assertWritable(c, "CONFIRMED", expected(c))).not.toThrow();
    f.window.isLocked = true;
    expect((await read()).readiness.confirm.allowed).toBe(false);
  });
  it("verified Prisma FINALIZED blocks UC17 and does not expose other students' snapshots", async () => {
    const source = uc18Fixture();
    listQuery.mockResolvedValue(source.list);
    historyQuery.mockResolvedValue(source.finalization);
    const c = await read();
    expect(c.uc18).toMatchObject({
      state: "FINALIZED",
      evidence: { integrity: "VERIFIED" },
    });
    expect(c.readiness.confirm.blockers.map((b) => b.code)).toContain(
      "UC18_FINALIZED",
    );
    for (const status of ["CONFIRMED", "REJECTED"] as const)
      expect(() => v.assertWritable(c, status, expected(c))).toThrow();
    expect(JSON.stringify(c.uc18)).not.toMatch(
      /student-1|student-2|roster|students/,
    );
  });
  it("missing UC18 tables never permit either UC17 decision", async () => {
    listQuery.mockRejectedValue({ code: "P2021" });
    const c = await read();
    expect(c.uc18.state).toBe("UNKNOWN");
    expect(c.readiness.reject.blockers.map((b) => b.code)).toContain(
      "UC18_FINALIZATION_UNKNOWN",
    );
    for (const status of ["CONFIRMED", "REJECTED"] as const)
      expect(() => v.assertWritable(c, status, expected(c))).toThrow();
  });
  it("passes the same database transaction to the UC18 adapter", async () => {
    open();
    await read();
    expect(finalization.read).toHaveBeenCalledWith("term", tx);
  });
  it("OPEN permits policy readiness despite incomplete tasks", async () => {
    open();
    const c = await read();
    expect(c.progress.warnings.map((w) => w.code)).toContain(
      "PROGRESS_TASKS_INCOMPLETE",
    );
    expect(c.readiness.confirm.allowed).toBe(true);
    expect(c.readiness.reject.allowed).toBe(true);
    expect(() => v.assertWritable(c, "CONFIRMED", expected(c))).not.toThrow();
  });
  it("missing progress remains a warning and is not equated to completion", async () => {
    s.planFor.mockResolvedValue(null);
    open();
    const c = await read();
    expect(c.progress.dataState).toBe("MISSING");
    expect(c.readiness.confirm.allowed).toBe(true);
    expect(s.monitorTasks).not.toHaveBeenCalled();
  });
  it("FINALIZED blocks even an open UC17 window and valid PDF", async () => {
    finalization = {
      read: vi.fn().mockResolvedValue({
        state: "FINALIZED",
        scope: "TERM",
        termId: "term",
        revision: 1,
        finalizedAt: at.toISOString(),
        finalizedByUserId: "faculty",
      }),
    };
    build();
    const c = await read();
    expect(c.readiness.confirm.blockers[0].code).toBe("UC18_FINALIZED");
  });
  it("missing file is INVALID, keeps current decision unchanged and disables confirmation", async () => {
    storage.readPrivateFinalReport.mockRejectedValue(
      new Error("ENOENT /secret/path"),
    );
    open();
    const c = await read();
    expect(c.pdf).toMatchObject({ state: "INVALID", snapshot: null });
    expect(c.decision.status).toBe("CONFIRMED");
    expect(c.readiness.confirm.allowed).toBe(false);
    expect(c.readiness.reject.allowed).toBe(true);
    expect(JSON.stringify(c)).not.toContain("/secret/path");
  });
  it("checksum failure never marks a PDF as verified", async () => {
    storage.readPrivateFinalReport.mockResolvedValue(Buffer.from("broken"));
    expect((await read()).pdf.state).toBe("INVALID");
  });
  it("legacy PDF and decision are explicit and legacy path is never accessed", async () => {
    f.report.fileAssetId = null;
    f.report.filePath = "C:/sensitive/legacy.pdf";
    f.decision.revision = 0;
    f.decision.decisionContext = null;
    const c = await read();
    expect(c.legacy).toMatchObject({ pdf: true, decision: true });
    expect(c.pdfChangedSinceDecision).toBeNull();
    expect(c.confirmationApplicableToCurrentContext).toBeNull();
    expect(storage.readPrivateFinalReport).not.toHaveBeenCalled();
    expect(JSON.stringify(c)).not.toContain("sensitive");
  });
  it("REJECTED can be ready without PDF; CONFIRMED cannot", async () => {
    s.report.mockResolvedValue(null);
    s.currentDecision.mockResolvedValue(null);
    open();
    const c = await read();
    expect(c.pdf.state).toBe("NOT_SUBMITTED");
    expect(c.readiness.confirm.allowed).toBe(false);
    expect(c.readiness.reject.allowed).toBe(true);
    expect(() => v.assertWritable(c, "REJECTED", expected(c))).not.toThrow();
  });
  it("checks expected decision, assignment and PDF revisions against server context", async () => {
    open();
    const c = await read(),
      e = expected(c);
    expect(v.contextChanged(e, c)).toEqual([]);
    expect(v.contextChanged({ ...e, revision: 0 }, c)[0].code).toBe(
      "REVISION_CONFLICT",
    );
    expect(
      v.contextChanged(
        { ...e, assignment: { assignmentId: "assignment", revision: 2 } },
        c,
      )[0].code,
    ).toBe("ASSIGNMENT_CONTEXT_CHANGED");
    expect(
      v.contextChanged({ ...e, pdf: { ...e.pdf!, revision: 0 } }, c)[0].code,
    ).toBe("PDF_CONTEXT_CHANGED");
    expect(v.contextChanged({ ...e, pdf: null }, c)[0].code).toBe(
      "PDF_CONTEXT_CHANGED",
    );
  });
  it("rejects malformed expected context without throwing a property access error", async () => {
    const c = await read();
    expect(v.contextChanged({} as ExpectedDecisionContext, c)[0].code).toBe(
      "EXPECTED_CONTEXT_INVALID",
    );
  });
  it("unverified PDF metadata never permits CONFIRMED readiness", async () => {
    open();
    const c = await read();
    c.pdf.state = "UNVERIFIED";
    expect(v.readiness(c, "CONFIRMED").allowed).toBe(false);
    expect(v.readiness(c, "REJECTED").allowed).toBe(true);
  });
  it("detects replacement with same checksum without changing the stored decision", async () => {
    const before = JSON.stringify(f.decision);
    f.report.revision = 2;
    const c = await read();
    expect(c.pdfChangedSinceDecision).toBe(true);
    expect(c.confirmationApplicableToCurrentContext).toBe(false);
    expect(JSON.stringify(f.decision)).toBe(before);
  });
  it("new official advisor sees old decision as changed and old history is untouched", async () => {
    const a = f.registration.advisorAssignment!;
    a.advisorId = "new-advisor";
    a.advisor.userId = "new-user";
    f.user.id = "new-user";
    f.user.lecturer!.id = "new-advisor";
    f.roster.lecturerId = "new-advisor";
    const c = await service.read("new-user", "proposal");
    expect(c.advisorChangedSinceDecision).toBe(true);
    expect(c.decision.advisorId).toBe("advisor");
    expect(c.confirmationApplicableToCurrentContext).toBe(false);
  });
  it("closed/locked/missing UC17 window blocks despite UC18 OPEN", async () => {
    open();
    f.window.closesAt = at;
    expect(
      (await read()).readiness.reject.blockers.map((b) => b.code),
    ).toContain("UC17_WINDOW_CLOSED");
    f = fixture();
    f.window.isLocked = true;
    expect(
      (await read()).readiness.confirm.blockers.map((b) => b.code),
    ).toContain("UC17_WINDOW_LOCKED");
    s.window.mockResolvedValue(null);
    expect(
      (await read()).readiness.reject.blockers.map((b) => b.code),
    ).toContain("UC17_WINDOW_NOT_CONFIGURED");
  });
});
