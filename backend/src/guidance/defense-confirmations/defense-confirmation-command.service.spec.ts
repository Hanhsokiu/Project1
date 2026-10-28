import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { at, earlier } from "./defense-confirmation.test-fixtures";
import { commandFixture } from "./defense-confirmation-command.test-fixtures";

let f: ReturnType<typeof commandFixture>;
beforeEach(() => {
  f = commandFixture();
});
const put = (input = f.input()) =>
  f.service.put("advisor-user", "proposal", input);

describe("UC17 decision command transaction", () => {
  it.each(["corrupt", "unavailable"])(
    "can reject a %s PDF with a reason and null verified PDF evidence",
    async (kind) => {
      if (kind === "corrupt")
        f.storage.readPrivateFinalReport.mockResolvedValue(
          Buffer.from("bad-pdf"),
        );
      else
        f.storage.readPrivateFinalReport.mockRejectedValue(
          new Error("file unavailable"),
        );
      const input = f.input("REJECTED");
      input.expectedContext.pdf = null;
      const result = await put(input);
      expect(result.decision).toMatchObject({
        status: "REJECTED",
        confirmedAt: null,
        snapshot: { pdf: null },
      });
    },
  );
  it("requires explicit re-decision/reason to confirm a resubmitted PDF and does not rewrite old history", async () => {
    await put();
    const first = structuredClone(f.state.history[0]);
    f.state.report!.revision++;
    await expect(put(f.input())).rejects.toMatchObject({ status: 422 });
    const result = await put({ ...f.input(), changeReason: "Đã xem PDF mới" });
    expect(result.decision).toMatchObject({
      status: "CONFIRMED",
      revision: 2,
      snapshot: { pdf: { revision: 2 } },
    });
    expect(f.state.history[0]).toEqual(first);
    expect(f.state.history).toHaveLength(2);
  });
  it("serializes two concurrent revisions of an existing decision with one winner", async () => {
    await put();
    const input = { ...f.input("REJECTED"), changeReason: "Đánh giá lại" };
    const results = await Promise.allSettled([
      put(input),
      put({ ...input, note: "Lý do khác" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toMatchObject([
      { reason: { status: 409 } },
    ]);
    expect(f.state.decision!.revision).toBe(2);
    expect(f.state.history).toHaveLength(2);
    expect(f.state.audits).toHaveLength(2);
  });
  it("records CONFIRMED with server actor/time/snapshot, revision and append-only history/audit", async () => {
    const result = await put();
    expect(result).toMatchObject({
      changed: true,
      proposalId: "proposal",
      decision: {
        state: "RECORDED",
        status: "CONFIRMED",
        revision: 1,
        confirmedAt: at.toISOString(),
        decidedAt: at.toISOString(),
        decidedByUserId: "advisor-user",
        snapshot: f.facts.snapshot,
      },
    });
    expect(f.state.history).toHaveLength(1);
    expect(f.state.history[0]).toMatchObject({
      confirmationId: result.decision.id,
      revision: 1,
      actorId: "advisor-user",
      advisorId: "advisor",
      status: "CONFIRMED",
      decidedAt: at,
      decisionContext: f.facts.snapshot,
    });
    expect(f.state.audits).toHaveLength(1);
    expect(f.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "advisor-user",
        action: "RECORD_DEFENSE_CONFIRMATION",
        resource: "defense-confirmation",
        resourceId: "proposal",
      }),
      f.tx,
    );
    expect(f.events.indexOf("history")).toBeLessThan(f.events.indexOf("audit"));
    expect(f.forbidden).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(
      /storageKey|filePath|private-final/,
    );
  });
  it("rejects without a PDF and stores null confirmedAt/PDF snapshot", async () => {
    f.state.report = null;
    const result = await put(f.input("REJECTED"));
    expect(result.decision).toMatchObject({
      status: "REJECTED",
      confirmedAt: null,
      note: "Chưa hoàn thành báo cáo",
      snapshot: {
        assignment: { assignmentId: "assignment", revision: 0 },
        pdf: null,
      },
    });
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
    expect(f.state.history[0].decisionContext).toMatchObject({ pdf: null });
  });
  it("includes the verified current PDF snapshot even when REJECTED", async () => {
    const result = await put(f.input("REJECTED"));
    expect(result.decision.snapshot?.pdf).toEqual(f.facts.snapshot.pdf);
    expect(result.decision.confirmedAt).toBeNull();
  });
  it.each([undefined, "", "   "])(
    "rejects a REJECTED request without meaningful note (%s)",
    async (note) => {
      await expect(put({ ...f.input("REJECTED"), note })).rejects.toMatchObject(
        { status: 422 },
      );
      expect(f.prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it("blocks CONFIRMED with no PDF", async () => {
    f.state.report = null;
    await expect(put()).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "UC17_VALID_PDF_REQUIRED" } },
    });
    expect(f.state.decision).toBeNull();
  });
  it.each(["unavailable", "corrupt", "legacy", "not-ready"])(
    "cannot confirm a %s PDF",
    async (kind) => {
      if (kind === "unavailable")
        f.storage.readPrivateFinalReport.mockRejectedValue(
          new Error("secret/path"),
        );
      if (kind === "corrupt")
        f.storage.readPrivateFinalReport.mockResolvedValue(
          Buffer.from("bad-pdf"),
        );
      if (kind === "legacy") {
        f.state.report!.fileAssetId = null;
        f.state.report!.fileAsset = null;
        f.state.report!.filePath = "secret/path";
      }
      if (kind === "not-ready")
        f.state.report!.fileAsset!.state = "STAGED" as never;
      await expect(put()).rejects.toMatchObject({ status: 409 });
      expect(f.state.history).toHaveLength(0);
    },
  );
  it("allows rejection of a legacy/unavailable PDF only with null expected PDF context", async () => {
    f.state.report!.fileAssetId = null;
    f.state.report!.fileAsset = null;
    f.state.report!.filePath = "legacy/path.pdf";
    expect((await put(f.input("REJECTED"))).decision.snapshot?.pdf).toBeNull();
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });
  it.each(["missing", "locked", "expired", "not-open"])(
    "blocks a %s UC17 window",
    async (kind) => {
      if (kind === "missing") f.state.window = null;
      if (kind === "locked") f.state.window!.isLocked = true;
      if (kind === "expired") f.state.window!.closesAt = at;
      if (kind === "not-open")
        f.state.window!.opensAt = new Date("2026-10-27T00:00:00Z");
      await expect(put()).rejects.toMatchObject({ status: 409 });
      expect(f.state.history).toHaveLength(0);
    },
  );
  it.each(["missing", "DRAFT", "FINALIZED", "invalid-open"])(
    "blocks UC18 %s without creating any UC18 state",
    async (state) => {
      if (state === "missing") f.state.list = null;
      if (state === "DRAFT")
        Object.assign(f.state.list!, {
          state: "DRAFT",
          openedAt: null,
          openedByUserId: null,
        });
      if (state === "FINALIZED")
        Object.assign(f.state.list!, {
          state: "FINALIZED",
          currentFinalizationId: "finalization",
        });
      if (state === "invalid-open") f.state.list!.openedByUserId = null;
      await expect(put()).rejects.toMatchObject({ status: 409 });
      expect(f.state.decision).toBeNull();
      expect(f.forbidden).not.toHaveBeenCalled();
    },
  );
  it("denies an active permitted lecturer who is not the current official advisor", async () => {
    f.state.user!.lecturer!.id = "other-advisor";
    await expect(put()).rejects.toMatchObject({ status: 404 });
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });
  it.each(["DRAFT", "PUBLISHED"])(
    "denies an assignment plan that is only %s",
    async (status) => {
      f.state.registration!.advisorAssignment!.assignmentPlan.status =
        status as never;
      await expect(put()).rejects.toMatchObject({ status: 404 });
    },
  );
  it("requires the official TermWorkflow pointer, not merely a FINALIZED plan", async () => {
    f.state.term!.pr2bTermWorkflowTermId!.officialAssignmentPlanId =
      "different-plan";
    await expect(put()).rejects.toMatchObject({ status: 404 });
  });
  it("denies the old advisor after effective reassignment", async () => {
    const a = f.state.registration!.advisorAssignment!;
    a.advisorId = "new-advisor";
    a.advisor.userId = "new-user";
    a.pr2bAssignmentChangeAssignmentId = [
      {
        assignmentId: a.id,
        assignmentRevision: 1,
        newAdvisorId: "new-advisor",
        effectiveAt: earlier,
      },
    ] as typeof a.pr2bAssignmentChangeAssignmentId;
    f.state.roster!.lecturerId = "new-advisor";
    await expect(put()).rejects.toMatchObject({ status: 404 });
  });
  it("lets the new official advisor decide and retains the old advisor history", async () => {
    await put();
    const first = structuredClone(f.state.history[0]),
      a = f.state.registration!.advisorAssignment!;
    a.advisorId = "new-advisor";
    a.advisor.userId = "new-user";
    a.pr2bAssignmentChangeAssignmentId = [
      {
        assignmentId: a.id,
        assignmentRevision: 1,
        newAdvisorId: a.advisorId,
        effectiveAt: earlier,
      },
    ] as typeof a.pr2bAssignmentChangeAssignmentId;
    f.state.user!.id = "new-user";
    f.state.user!.lecturer!.id = "new-advisor";
    f.state.roster!.lecturerId = "new-advisor";
    const input = { ...f.input(), changeReason: "GVHD mới đánh giá lại" };
    const result = await f.service.put("new-user", "proposal", input);
    expect(result.decision).toMatchObject({
      revision: 2,
      advisorId: "new-advisor",
      decidedByUserId: "new-user",
    });
    expect(f.state.history).toHaveLength(2);
    expect(f.state.history[0]).toEqual(first);
    expect(f.state.history[1]).toMatchObject({
      advisorId: "new-advisor",
      actorId: "new-user",
      decisionContext: { assignment: { revision: 1 } },
    });
  });
  it("denies missing decision permission even though the lecturer can read guidance", async () => {
    f.state.user!.userRoles[0].role.rolePermissions =
      f.state.user!.userRoles[0].role.rolePermissions.filter(
        (p) => p.permission.resource !== "defense-confirmation",
      );
    await expect(put()).rejects.toMatchObject({
      status: 403,
      response: { error: { code: "UC17_DECISION_FORBIDDEN" } },
    });
    expect(f.raw.proposal.findUnique).not.toHaveBeenCalled();
  });
  it.each(["INACTIVE", "LOCKED"])("denies account state %s", async (status) => {
    f.state.user!.status = status as never;
    await expect(put()).rejects.toMatchObject({ status: 403 });
    expect(f.state.history).toHaveLength(0);
  });
  it("denies a stale expectedRevision", async () => {
    const input = f.input();
    input.expectedRevision = 1;
    input.expectedContext.revision = 1;
    await expect(put(input)).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "REVISION_CONFLICT" } },
    });
  });
  it.each([
    "assignment-id",
    "assignment-revision",
    "report-id",
    "pdf-revision",
    "checksum",
  ])("denies stale context %s", async (kind) => {
    const input = f.input();
    if (kind === "assignment-id")
      input.expectedContext.assignment.assignmentId = "old-assignment";
    if (kind === "assignment-revision")
      input.expectedContext.assignment.revision = 2;
    if (kind === "report-id")
      input.expectedContext.pdf!.finalReportId = "other-report";
    if (kind === "pdf-revision") input.expectedContext.pdf!.revision = 0;
    if (kind === "checksum")
      input.expectedContext.pdf!.checksum = "0".repeat(64);
    await expect(put(input)).rejects.toMatchObject({ status: 409 });
    expect(f.state.history).toHaveLength(0);
  });
  it("blocks a PDF resubmitted with the same checksum and a new revision", async () => {
    const viewed = f.input();
    f.state.report!.revision++;
    await expect(put(viewed)).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "PDF_CONTEXT_CHANGED" } },
    });
  });
  it("rechecks after waiting for the term lock instead of trusting the original GET", async () => {
    const viewed = f.input();
    f.state.onLock = () => {
      f.state.report!.revision++;
    };
    await expect(put(viewed)).rejects.toMatchObject({ status: 409 });
  });
  it("allows incomplete or missing progress as warnings", async () => {
    expect((await put()).warnings.map((w) => w.code)).toContain(
      "PROGRESS_TASKS_INCOMPLETE",
    );
    f = commandFixture();
    f.state.plan = null;
    expect((await put()).changed).toBe(true);
    expect(f.forbidden).not.toHaveBeenCalled();
  });
  it("requires changeReason for any real change to an existing decision", async () => {
    await put();
    await expect(put(f.input("REJECTED"))).rejects.toMatchObject({
      status: 422,
      response: { error: { code: "UC17_CHANGE_REASON_REQUIRED" } },
    });
    expect(f.state.decision!.status).toBe("CONFIRMED");
    expect(f.state.history).toHaveLength(1);
  });
  it("clears confirmedAt on rejection and sets it from DB time on subsequent confirmation", async () => {
    await put();
    const rejected = await put({
      ...f.input("REJECTED"),
      changeReason: "Chưa đạt yêu cầu",
    });
    expect(rejected.decision.confirmedAt).toBeNull();
    f.state.now = new Date(at.getTime() + 1000);
    const confirmed = await put({
      ...f.input(),
      changeReason: "Đã hoàn thiện",
    });
    expect(confirmed.decision.confirmedAt).toBe(f.state.now.toISOString());
    expect(confirmed.decision.revision).toBe(3);
    expect(f.state.history.map((h) => h.status)).toEqual([
      "CONFIRMED",
      "REJECTED",
      "CONFIRMED",
    ]);
  });
  it("does not create a new revision/history/audit for an unchanged decision at current revision", async () => {
    await put();
    const before = structuredClone(f.state.decision);
    expect((await put(f.input())).changed).toBe(false);
    expect(f.state.decision).toEqual(before);
    expect(f.state.history).toHaveLength(1);
    expect(f.state.audits).toHaveLength(1);
  });
  it("only one of two requests with the same revision commits", async () => {
    const viewed = f.input();
    const results = await Promise.allSettled([put(viewed), put(viewed)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toMatchObject([
      { reason: { status: 409 } },
    ]);
    expect(f.state.history).toHaveLength(1);
    expect(f.state.audits).toHaveLength(1);
    expect(f.state.decision!.revision).toBe(1);
  });
  it.each(["history", "audit"] as const)(
    "rolls back decision and all appended rows if %s fails",
    async (kind) => {
      const error = new Error(`${kind} failed`);
      if (kind === "history")
        f.raw.defenseConfirmationHistory.create.mockImplementationOnce(
          async ({ data }) => {
            f.state.history.push(data);
            throw error;
          },
        );
      else
        f.raw.auditLog.create.mockImplementationOnce(async (entry) => {
          f.state.audits.push(entry);
          throw error;
        });
      await expect(put()).rejects.toBe(error);
      expect(f.state.decision).toBeNull();
      expect(f.state.history).toEqual([]);
      expect(f.state.audits).toEqual([]);
    },
  );
  it("retains the previous decision/history when an update audit fails", async () => {
    await put();
    const before = structuredClone({
      decision: f.state.decision,
      history: f.state.history,
      audits: f.state.audits,
    });
    f.raw.auditLog.create.mockRejectedValueOnce(new Error("audit failed"));
    await expect(
      put({ ...f.input("REJECTED"), changeReason: "Đánh giá lại" }),
    ).rejects.toThrow();
    expect({
      decision: f.state.decision,
      history: f.state.history,
      audits: f.state.audits,
    }).toEqual(before);
  });
  it.each(["COMPLETED", "CANCELLED"])(
    "blocks decisions for term %s",
    async (status) => {
      f.state.term!.status = status as never;
      await expect(put()).rejects.toMatchObject({ status: 409 });
    },
  );
  it("blocks a locked term and unapproved/inactive student proposal", async () => {
    f.state.term!.isLocked = true;
    await expect(put()).rejects.toMatchObject({ status: 409 });
    f.state.term!.isLocked = false;
    f.state.proposal!.status = "DRAFT";
    await expect(put()).rejects.toMatchObject({ status: 409 });
    f.state.proposal!.status = "APPROVED";
    f.state.proposal!.student.isActive = false;
    await expect(put()).rejects.toMatchObject({ status: 409 });
  });
  it("replaces a legacy decision explicitly without inventing historical rows", async () => {
    f.state.decision = {
      ...f.facts.decision,
      revision: 0,
      decisionContext: null,
      decidedAt: null,
      decidedByUserId: null,
      updatedAt: null,
    };
    await expect(put()).rejects.toMatchObject({ status: 422 });
    const result = await put({
      ...f.input(),
      changeReason: "Đối soát quyết định legacy",
    });
    expect(result.decision.revision).toBe(1);
    expect(f.state.history).toHaveLength(1);
  });
  it("records a first decision from an uninitialized PENDING placeholder without changeReason", async () => {
    f.state.decision = {
      ...f.facts.decision,
      status: "PENDING",
      revision: 0,
      decisionContext: null,
      confirmedAt: null,
      decidedAt: null,
      decidedByUserId: null,
      updatedAt: null,
    };
    expect((await put()).decision.revision).toBe(1);
    expect(f.state.history).toHaveLength(1);
  });
  it("PDF resubmission does not mutate the old decision and the reader flags it changed", async () => {
    await put();
    const before = structuredClone(f.state.decision);
    f.state.report!.revision++;
    const context = await f.contexts.read("advisor-user", "proposal");
    expect(context.pdfChangedSinceDecision).toBe(true);
    expect(f.state.decision).toEqual(before);
    expect(f.state.history).toHaveLength(1);
  });
  it("checks the database clock again after file IO and denies if the deadline has passed", async () => {
    f.state.afterFileRead = () => {
      f.state.now = f.state.window!.closesAt;
    };
    await expect(put()).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "UC17_WINDOW_CLOSED" } },
    });
    expect(f.state.history).toHaveLength(0);
  });
  it.each(["permission", "assignment", "PDF", "UC18"])(
    "rechecks %s after file IO",
    async (kind) => {
      f.state.afterFileRead = () => {
        if (kind === "permission")
          f.state.user!.userRoles[0].role.rolePermissions = [];
        if (kind === "assignment")
          f.state.registration!.advisorAssignment!.advisorId = "someone-else";
        if (kind === "PDF") f.state.report!.revision++;
        if (kind === "UC18") f.state.list = null;
      };
      await expect(put()).rejects.toThrow();
      expect(f.state.history).toHaveLength(0);
    },
  );
  it("rejects a lost revision CAS and never appends history", async () => {
    await put();
    f.raw.defenseConfirmation.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      put({ ...f.input("REJECTED"), changeReason: "Đánh giá lại" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.history).toHaveLength(1);
  });
  it("uses one caller transaction for context, UC18, history and audit without nesting", async () => {
    const reader = vi.spyOn(f.reader, "read");
    await put();
    expect(f.prisma.$transaction).toHaveBeenCalledOnce();
    for (const args of reader.mock.calls) expect(args[1]).toBe(f.tx);
    expect(f.auditLog.mock.calls[0][1]).toBe(f.tx);
    const locks = f.raw.$queryRaw.mock.calls
      .map(([sql]) => sql.join("?"))
      .filter((sql) => sql.includes("FOR UPDATE"));
    expect(locks[0]).toContain('"THESIS_TERM"');
    expect(
      locks.findIndex((sql) => sql.includes('"PROPOSAL"')),
    ).toBeGreaterThan(0);
    expect(
      f.events.findIndex((sql) => sql.includes("pg_advisory_xact_lock")),
    ).toBeLessThan(f.events.indexOf("file-read"));
  });
});
