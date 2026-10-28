import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { at } from "./defense-confirmation.test-fixtures";
import { readFixture } from "./defense-confirmation-read.test-fixtures";

let f: ReturnType<typeof readFixture>;
beforeEach(() => {
  f = readFixture();
});
const actor = () => f.state.user?.id ?? "missing-user";
const context = () => f.read.context(actor(), "proposal");
const current = () => f.read.current(actor(), "proposal");
const history = (
  query = { limit: 50 } as { limit: number; afterRevision?: number },
) => f.read.history(actor(), "proposal", query);
const recorded = async () =>
  f.service.put("advisor-user", "proposal", f.input());

describe("UC17 scoped read APIs and PUT synchronization", () => {
  it("keeps advisor context available for a dual-role faculty account only on its official assignment", async () => {
    f.state.user!.userRoles.push({
      role: { name: "FACULTY", rolePermissions: [] },
    } as never);
    f.fullGrant();
    expect((await current()).viewer).toBe("ADVISOR");
    expect((await context()).advisor.state).toBe("OFFICIAL");
  });
  it("current advisor receives verified context and minimal expectations accepted verbatim by PUT", async () => {
    const c = await context();
    expect(c).toMatchObject({
      expectedRevision: 0,
      pdf: { state: "READY" },
      advisor: { state: "OFFICIAL" },
      uc18: { state: "OPEN" },
      window: { state: "OPEN" },
      expectedContext: {
        revision: 0,
        assignment: { assignmentId: "assignment", revision: 0 },
        pdf: { finalReportId: "report", revision: 1 },
      },
      readiness: { confirm: { allowed: true } },
    });
    expect(Object.keys(c.expectedContext!.pdf!).sort()).toEqual([
      "checksum",
      "finalReportId",
      "revision",
    ]);
    const result = await f.service.put(actor(), "proposal", {
      status: "CONFIRMED",
      expectedRevision: c.expectedRevision,
      expectedContext: c.expectedContext,
    });
    expect(result).toMatchObject({
      changed: true,
      decision: { revision: 1, status: "CONFIRMED" },
    });
  });
  it("GET expectations also support REJECTED directly when no PDF exists", async () => {
    f.state.report = null;
    const c = await context();
    expect(c.expectedContext!.pdf).toBeNull();
    expect(c.readiness.confirm.allowed).toBe(false);
    expect(c.readiness.reject.allowed).toBe(true);
    const result = await f.service.put(actor(), "proposal", {
      status: "REJECTED",
      note: "Chưa có báo cáo",
      expectedRevision: c.expectedRevision,
      expectedContext: c.expectedContext,
    });
    expect(result.decision.status).toBe("REJECTED");
  });
  it("returns ABSENT without creating a decision", async () => {
    const c = await current();
    expect(c).toMatchObject({
      configured: false,
      viewer: "ADVISOR",
      decision: {
        state: "ABSENT",
        status: null,
        revision: null,
        decidedAt: null,
      },
    });
    expect(f.state.decision).toBeNull();
    expect((await history()).historyState).toBe("NO_DECISION");
  });
  it("distinguishes a PENDING placeholder from an absent decision", async () => {
    f.state.decision = {
      ...f.facts.decision,
      status: "PENDING",
      revision: 0,
      decidedAt: null,
      decidedByUserId: null,
      confirmedAt: null,
      decisionContext: null,
      updatedAt: null,
    };
    expect(await current()).toMatchObject({
      configured: true,
      decision: { state: "PENDING", status: "PENDING", revision: 0 },
    });
  });
  it("marks legacy decision evidence UNKNOWN/null without inventing a history", async () => {
    f.state.decision = {
      ...f.facts.decision,
      revision: 0,
      decidedAt: null,
      decidedByUserId: null,
      decisionContext: null,
      updatedAt: null,
    };
    const c = await context();
    expect(c).toMatchObject({
      decision: { state: "LEGACY", snapshot: null },
      pdfChangedSinceDecision: null,
      advisorChangedSinceDecision: null,
      confirmationApplicableToCurrentContext: null,
      changeReasonRequiredForChanges: true,
    });
    expect(await current()).toMatchObject({
      decision: { state: "LEGACY", revision: 0, decidedBy: null },
    });
    expect(await history()).toMatchObject({
      historyState: "LEGACY_WITHOUT_HISTORY",
      items: [],
    });
  });
  it("student receives only the decision/notes and public names of their own proposal", async () => {
    await recorded();
    f.viewer("STUDENT");
    const result = await current();
    expect(result).toMatchObject({
      viewer: "STUDENT",
      decision: {
        status: "CONFIRMED",
        revision: 1,
        decidedBy: { displayName: "Người quyết định" },
        advisor: { fullName: "GVHD ra quyết định" },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /snapshot|checksum|storageKey|filePath|expectedContext|progress|userId|lecturerId/,
    );
    f.storage.readPrivateFinalReport.mockClear();
    await current();
    expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });
  it.each(["context", "history"] as const)(
    "student cannot read internal %s even for their own proposal",
    async (kind) => {
      f.viewer("STUDENT");
      await expect(
        kind === "context" ? context() : history(),
      ).rejects.toThrow();
      expect(f.history.findMany).not.toHaveBeenCalled();
      expect(f.storage.readPrivateFinalReport).not.toHaveBeenCalled();
    },
  );
  it("denies a student reading another student's decision", async () => {
    f.viewer("STUDENT");
    f.state.user!.student!.id = "other-student";
    await expect(current()).rejects.toMatchObject({ status: 404 });
    expect(f.raw.defenseConfirmation.findUnique).not.toHaveBeenCalled();
  });
  it.each(["FACULTY", "ADMIN"] as const)(
    "%s needs a matching grant for current decision and history",
    async (role) => {
      await recorded();
      f.viewer(role);
      await expect(current()).rejects.toMatchObject({ status: 404 });
      await expect(history()).rejects.toMatchObject({ status: 404 });
      f.fullGrant();
      expect((await current()).viewer).toBe("FACULTY");
      expect((await history()).items).toHaveLength(1);
      await expect(context()).rejects.toThrow();
    },
  );
  it("faculty department scope follows existing research-area routing", async () => {
    f.viewer("FACULTY");
    f.departmentGrant();
    expect((await current()).viewer).toBe("FACULTY");
    f.accessState.grants[0].pr2bGrantDepartmentGrantId[0].departmentId =
      "other-department";
    await expect(current()).rejects.toMatchObject({ status: 404 });
  });
  it.each(["wrong-term", "wrong-user", "missing-routing"])(
    "denies an inconsistent faculty scope: %s",
    async (kind) => {
      f.viewer("FACULTY");
      f.departmentGrant();
      if (kind === "wrong-term") f.accessState.grants[0].termId = "other-term";
      if (kind === "wrong-user") f.accessState.grants[0].userId = "other-user";
      if (kind === "missing-routing")
        f.state.proposal!.topic.researchArea = null;
      await expect(current()).rejects.toMatchObject({ status: 404 });
    },
  );
  it("full-term faculty grant can read legacy routing but never bypasses term ownership", async () => {
    f.viewer("FACULTY");
    f.fullGrant();
    f.state.proposal!.topic.researchArea = null;
    expect((await current()).viewer).toBe("FACULTY");
    f.state.proposal!.topic.termId = "other-term";
    await expect(current()).rejects.toMatchObject({ status: 404 });
  });
  it.each(["context", "current", "history"] as const)(
    "enforces explicit read permission for %s",
    async (kind) => {
      f.state.user!.userRoles[0].role.rolePermissions =
        f.state.user!.userRoles[0].role.rolePermissions.filter(
          (p) =>
            p.permission.action !== "read" ||
            p.permission.resource !== "defense-confirmation",
        );
      await expect(
        kind === "context"
          ? context()
          : kind === "current"
            ? current()
            : history(),
      ).rejects.toMatchObject({ status: 403 });
      expect(f.raw.proposal.findUnique).not.toHaveBeenCalled();
    },
  );
  it.each(["inactive", "password-change", "wrong-account"])(
    "denies account condition %s",
    async (kind) => {
      if (kind === "inactive") f.state.user!.status = "LOCKED";
      if (kind === "password-change") f.state.user!.mustChangePassword = true;
      if (kind === "wrong-account") f.state.user!.id = "another-user";
      await expect(
        f.read.current("advisor-user", "proposal"),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
  it("old advisor cannot read context, current decision or history after reassignment", async () => {
    f.state.registration!.advisorAssignment!.advisorId = "new-advisor";
    f.state.registration!.advisorAssignment!.advisor.userId = "new-user";
    f.state.roster!.lecturerId = "new-advisor";
    for (const operation of [context, current, history])
      await expect(operation()).rejects.toMatchObject({ status: 404 });
  });
  it("PUBLISHED assignment does not authorize an advisor reader", async () => {
    f.state.registration!.advisorAssignment!.assignmentPlan.status =
      "PUBLISHED";
    await expect(current()).rejects.toMatchObject({ status: 404 });
    await expect(context()).rejects.toMatchObject({ status: 404 });
  });
  it("history orders revisions and paginates without exposing private PDF or raw JSON", async () => {
    await recorded();
    await f.service.put(actor(), "proposal", {
      ...f.input("REJECTED"),
      changeReason: "Cần sửa",
    });
    await f.service.put(actor(), "proposal", {
      ...f.input(),
      changeReason: "Đã hoàn thiện",
    });
    f.state.history.reverse();
    const page = await history({ limit: 2 });
    expect(page.items.map((i) => i.revision)).toEqual([1, 2]);
    expect(page).toMatchObject({
      hasMore: true,
      nextAfterRevision: 2,
      currentRevision: 3,
    });
    expect(page.items[1]).toMatchObject({
      status: "REJECTED",
      changeReason: "Cần sửa",
      actor: { userId: "advisor-user" },
      advisor: { lecturerId: "advisor" },
      pdfRevision: 1,
    });
    const next = await history({
      limit: 2,
      afterRevision: page.nextAfterRevision!,
    });
    expect(next.items.map((i) => i.revision)).toEqual([3]);
    expect(next.hasMore).toBe(false);
    expect(JSON.stringify(page)).not.toMatch(
      /storageKey|filePath|originalName|checksum|decisionContext|"snapshot"/,
    );
  });
  it("new advisor can read history retaining the old actor and advisor identity", async () => {
    await recorded();
    const a = f.state.registration!.advisorAssignment!;
    a.advisorId = "new-advisor";
    a.advisor.userId = "new-user";
    f.state.user!.id = "new-user";
    f.state.user!.lecturer!.id = "new-advisor";
    f.state.roster!.lecturerId = "new-advisor";
    expect((await history()).items[0]).toMatchObject({
      actor: { userId: "advisor-user" },
      advisor: { lecturerId: "advisor" },
    });
  });
  it("GET detects PDF replacement even with identical checksum and never modifies the old decision", async () => {
    await recorded();
    const before = structuredClone(f.state.decision);
    f.state.report!.revision++;
    const c = await context();
    expect(c.pdfChangedSinceDecision).toBe(true);
    expect(c.expectedContext!.pdf!.revision).toBe(2);
    expect(f.state.decision).toEqual(before);
  });
  it("unreadable/legacy PDF has unknown applicability and no fabricated false freshness flag", async () => {
    await recorded();
    f.storage.readPrivateFinalReport.mockRejectedValue(
      new Error("secret filesystem path"),
    );
    const c = await context();
    expect(c.pdf.state).toBe("INVALID");
    expect(c.pdfChangedSinceDecision).toBeNull();
    expect(c.confirmationApplicableToCurrentContext).toBeNull();
    expect(c.expectedContext!.pdf).toBeNull();
    expect(JSON.stringify(c)).not.toContain("secret filesystem path");
  });
  it.each(["UNKNOWN", "FINALIZED"])(
    "UC18 %s permits authorized reads while blocking PUT including no-op",
    async (state) => {
      await recorded();
      if (state === "UNKNOWN") f.state.list = null;
      else
        Object.assign(f.state.list!, {
          state: "FINALIZED",
          currentFinalizationId: "finalization",
        });
      const c = await context();
      expect(c.uc18.state).toBe(state);
      expect(c.readiness.confirm.allowed).toBe(false);
      expect((await current()).decision.status).toBe("CONFIRMED");
      expect((await history()).items).toHaveLength(1);
      await expect(
        f.service.put(actor(), "proposal", {
          status: "CONFIRMED",
          expectedRevision: c.expectedRevision,
          expectedContext: c.expectedContext,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.state.history).toHaveLength(1);
    },
  );
  it("unapproved proposal readiness matches PUT instead of advertising permission to confirm", async () => {
    f.state.proposal!.status = "DRAFT";
    const c = await context();
    expect(c.readiness.confirm.blockers.map((b) => b.code)).toContain(
      "UC17_PROPOSAL_NOT_APPROVED",
    );
    await expect(
      f.service.put(actor(), "proposal", {
        status: "CONFIRMED",
        expectedRevision: c.expectedRevision,
        expectedContext: c.expectedContext,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("advisor with read-only permission gets context but both GET and PUT deny writes", async () => {
    f.state.user!.userRoles[0].role.rolePermissions =
      f.state.user!.userRoles[0].role.rolePermissions.filter(
        (p) => p.permission.action !== "decide",
      );
    const c = await context();
    expect(c.permissions.canDecide).toBe(false);
    expect(c.readiness.reject.allowed).toBe(false);
    await expect(
      f.service.put(actor(), "proposal", {
        status: "CONFIRMED",
        expectedRevision: c.expectedRevision,
        expectedContext: c.expectedContext,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("unchanged decision still requires current revision/context and permission", async () => {
    const before = await context();
    await recorded();
    await expect(
      f.service.put(actor(), "proposal", {
        status: "CONFIRMED",
        expectedRevision: before.expectedRevision,
        expectedContext: before.expectedContext,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const latest = await context();
    expect(
      (
        await f.service.put(actor(), "proposal", {
          status: "CONFIRMED",
          expectedRevision: latest.expectedRevision,
          expectedContext: latest.expectedContext,
        })
      ).changed,
    ).toBe(false);
    f.state.user!.userRoles[0].role.rolePermissions = [];
    await expect(
      f.service.put(actor(), "proposal", {
        status: "CONFIRMED",
        expectedRevision: latest.expectedRevision,
        expectedContext: latest.expectedContext,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.state.history).toHaveLength(1);
  });
  it("PDF/context change between GET and a no-op PUT prevents changed=false", async () => {
    await recorded();
    const c = await context();
    f.state.report!.revision++;
    await expect(
      f.service.put(actor(), "proposal", {
        status: "CONFIRMED",
        expectedRevision: c.expectedRevision,
        expectedContext: c.expectedContext,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.history).toHaveLength(1);
  });
  it("closed UC17 window permits reads but blocks a no-op PUT", async () => {
    await recorded();
    f.state.window!.closesAt = at;
    const c = await context();
    expect(c.window.state).toBe("CLOSED");
    expect((await current()).decision.status).toBe("CONFIRMED");
    await expect(
      f.service.put(actor(), "proposal", {
        status: "CONFIRMED",
        expectedRevision: c.expectedRevision,
        expectedContext: c.expectedContext,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("all GETs use a single read transaction each and never write audit/history/business data", async () => {
    const before = structuredClone({
      decision: f.state.decision,
      history: f.state.history,
      audits: f.state.audits,
    });
    await context();
    await current();
    await history();
    expect({
      decision: f.state.decision,
      history: f.state.history,
      audits: f.state.audits,
    }).toEqual(before);
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(f.raw.defenseConfirmation.create).not.toHaveBeenCalled();
    expect(f.raw.defenseConfirmation.updateMany).not.toHaveBeenCalled();
    expect(f.raw.defenseConfirmationHistory.create).not.toHaveBeenCalled();
    expect(f.auditLog).not.toHaveBeenCalled();
    expect(f.forbidden).not.toHaveBeenCalled();
    expect(f.events.join("\n")).not.toMatch(/FOR UPDATE|pg_advisory_xact_lock/);
  });
  it("context exposes neither internal storage paths nor the whole-term finalization snapshot", async () => {
    Object.assign(f.state.list!, {
      state: "FINALIZED",
      currentFinalizationId: "finalization",
    });
    const c = await context();
    expect(JSON.stringify(c)).not.toMatch(
      /storageKey|filePath|password|student-1|student-2|"roster"|"students"/,
    );
    expect(c.uc18.state).toBe("FINALIZED");
  });
  it("returns 503 for an unmigrated UC17 source without creating anything", async () => {
    f.raw.defenseConfirmation.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("missing table", {
        code: "P2021",
        clientVersion: "5.22.0",
      }),
    );
    await expect(current()).rejects.toMatchObject({ status: 503 });
    expect(f.state.decision).toBeNull();
  });
});
