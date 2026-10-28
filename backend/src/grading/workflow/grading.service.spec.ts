import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { gradingFixture } from "./grading.test-fixtures";
import { readGradingPolicy, readSheet } from "./grading.service";

describe("UC22–24 transactional commands with verified UC18–21 producers, no DB", () => {
  let f: Awaited<ReturnType<typeof gradingFixture>>;
  beforeEach(async () => {
    f = await gradingFixture();
    await f.configure();
  });
  it("official reviewer reads context and saves/seals a complete rubric with provenance/history", async () => {
    const c = await f.context();
    expect(c.canSave).toBe(true);
    expect(c.source?.reviewerId).toBeTruthy();
    await f.save();
    expect(f.state.sheets[0].state).toBe("DRAFT");
    await f.seal();
    expect(f.state.sheets[0].state).toBe("SEALED");
    expect(readSheet(f.state.sheets[0])?.total).toBe(10);
    expect(f.state.sheetHistory).toHaveLength(2);
    expect(f.base.state.notifications.at(-1)).toEqual(
      expect.arrayContaining([["faculty-user"]]),
    );
  });
  it("member may independently save/seal even while calculation/quorum are NEEDS_APPROVAL", async () => {
    await f.save("chair-user", "COMMITTEE");
    await f.seal("chair-user", "COMMITTEE");
    expect(f.state.sheets[0].state).toBe("SEALED");
    expect(readGradingPolicy(f.state.policy)?.calculation.state).toBe(
      "NEEDS_APPROVAL",
    );
  });
  it.each(["stranger-user", "advisor-user"])(
    "refuses unassigned/conflicting scorer %s",
    async (id) => {
      await expect(f.context(id)).rejects.toMatchObject({ status: 403 });
      expect(f.state.sheets).toHaveLength(0);
    },
  );
  it.each(["permission", "inactive", "must-change", "role-only"])(
    "denies %s",
    async (kind) => {
      const actor = f.actors.get("reviewer-user")!;
      if (kind === "inactive") actor.status = "LOCKED";
      else if (kind === "must-change") actor.mustChangePassword = true;
      else actor.userRoles[0].role.rolePermissions = [];
      await expect(f.context()).rejects.toMatchObject({ status: 403 });
    },
  );
  it("missing rubric blocks committee input, not reviewer input", async () => {
    const p = await f.service.policy("faculty-user", "term");
    const config = readGradingPolicy(f.state.policy)!;
    config.committeeRubric = null;
    await f.service.configure("faculty-user", "term", {
      expectedRevision: p.revision,
      expectedContext: p.expectedContext,
      requestId: randomUUID(),
      config,
    });
    expect((await f.context("chair-user", "COMMITTEE")).canSave).toBe(false);
    expect((await f.context()).canSave).toBe(true);
  });
  it.each(["missing", "locked", "expired", "future"])(
    "fail closed for %s grading window",
    async (kind) => {
      const input = await f.command();
      if (kind === "missing") f.state.policy!.current = null;
      else {
        const p = await f.service.policy("faculty-user", "term"),
          config = readGradingPolicy(f.state.policy)!;
        if (kind === "locked") config.windows.REVIEWER.isLocked = true;
        if (kind === "expired")
          config.windows.REVIEWER.closesAt = "2026-11-01T00:00:00Z";
        if (kind === "future")
          config.windows.REVIEWER.opensAt = "2026-12-01T00:00:00Z";
        await f.service.configure("faculty-user", "term", {
          expectedRevision: p.revision,
          expectedContext: p.expectedContext,
          requestId: randomUUID(),
          config,
        });
      }
      await expect(
        f.service.save(
          "reviewer-user",
          "term",
          "proposal",
          "REVIEWER",
          { ...input, draft: { values: {}, comment: "", questions: [] } },
          false,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.state.sheets).toHaveLength(0);
    },
  );
  it("allows partial draft but seal requires complete scores, a note and two questions", async () => {
    await f.save(undefined, undefined, {
      values: { LAYOUT: 1 },
      comment: "",
      questions: [],
    });
    await expect(f.seal()).rejects.toMatchObject({ status: 422 });
    expect(f.state.sheetHistory).toHaveLength(1);
    await f.save(undefined, undefined, {
      values: {
        LAYOUT: 2,
        CONTENT: 3,
        RELEVANCE: 1,
        COMPLETENESS: 2,
        MASTERY: 2,
      },
      comment: "Đủ điểm",
      questions: [],
    });
    await expect(f.seal()).rejects.toMatchObject({ status: 422 });
  });
  it("rejects unknown component, score above its maximum and client actor fields", async () => {
    await expect(
      f.save(undefined, undefined, {
        values: { LAYOUT: 3 },
        comment: "",
        questions: [],
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      f.save(undefined, undefined, {
        values: { FAKE: 0 },
        comment: "",
        questions: [],
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      f.service.save(
        "reviewer-user",
        "term",
        "proposal",
        "REVIEWER",
        {
          ...(await f.command()),
          actorId: "admin",
          draft: { values: {}, comment: "", questions: [] },
        } as never,
        false,
      ),
    ).rejects.toThrow();
  });
  it("wrong revision or expectedContext does not write", async () => {
    for (const wrong of [
      { expectedRevision: 3 },
      { expectedContext: "f".repeat(64) },
    ]) {
      await expect(
        f.service.save(
          "reviewer-user",
          "term",
          "proposal",
          "REVIEWER",
          {
            ...(await f.command()),
            ...wrong,
            draft: { values: {}, comment: "", questions: [] },
          },
          false,
        ),
      ).rejects.toMatchObject({ status: 409 });
    }
    expect(f.state.sheetHistory).toHaveLength(0);
  });
  it("same revision commands serialize in fixture: one success; not a PostgreSQL race claim", async () => {
    const input = {
      ...(await f.command()),
      draft: { values: {}, comment: "draft", questions: [] },
    };
    const r = await Promise.allSettled([
      f.service.save(
        "reviewer-user",
        "term",
        "proposal",
        "REVIEWER",
        input,
        false,
      ),
      f.service.save(
        "reviewer-user",
        "term",
        "proposal",
        "REVIEWER",
        { ...input, requestId: randomUUID() },
        false,
      ),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(f.state.sheetHistory).toHaveLength(1);
  });
  it("idempotent seal cannot bypass expired window or permission", async () => {
    await f.save();
    const input = await f.command();
    await f.service.save(
      "reviewer-user",
      "term",
      "proposal",
      "REVIEWER",
      input,
      true,
    );
    expect(
      (
        await f.service.save(
          "reviewer-user",
          "term",
          "proposal",
          "REVIEWER",
          input,
          true,
        )
      ).changed,
    ).toBe(false);
    f.base.fault.time = new Date("2027-01-02Z");
    await expect(
      f.service.save(
        "reviewer-user",
        "term",
        "proposal",
        "REVIEWER",
        input,
        true,
      ),
    ).rejects.toMatchObject({ status: 409 });
    f.actors.get("reviewer-user")!.userRoles[0].role.rolePermissions = [];
    await expect(
      f.service.save(
        "reviewer-user",
        "term",
        "proposal",
        "REVIEWER",
        input,
        true,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.state.sheetHistory).toHaveLength(2);
  });
  it.each(["history", "audit", "idempotency"])(
    "rolls back draft and history on %s failure",
    async (fault) => {
      const before = f.base.state.audit.length;
      if (fault === "history") f.fault.at = fault;
      else f.base.fault.at = fault;
      await expect(f.save()).rejects.toThrow("Injected");
      expect(f.state.sheets).toHaveLength(0);
      expect(f.state.sheetHistory).toHaveLength(0);
      expect(f.base.state.audit).toHaveLength(before);
    },
  );
  it("rolls back seal when notification fails", async () => {
    await f.save();
    f.base.fault.at = "notification";
    await expect(f.seal()).rejects.toThrow("Injected");
    expect(f.state.sheets[0].state).toBe("DRAFT");
    expect(f.state.sheetHistory).toHaveLength(1);
  });
  it("cannot edit a sealed sheet using a fresh revision/context", async () => {
    await f.save();
    await f.seal();
    await expect(f.save()).rejects.toMatchObject({ status: 409 });
    expect(f.state.sheetHistory).toHaveLength(2);
  });
  it("same checksum with a new PDF revision is stale; download using old identity conflicts", async () => {
    const c = await f.context();
    f.base.base.f.f.report.revision++;
    expect((await f.context()).blockers).toContain("PDF_CHANGED_SINCE_UC18");
    await expect(
      f.service.download("reviewer-user", "term", "proposal", "REVIEWER", {
        finalReportId: c.pdf!.finalReportId,
        revision: c.pdf!.revision,
        checksum: c.pdf!.checksum,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it.each([
    "pdf-missing",
    "pdf-corrupt",
    "assignment-changed",
    "plan-unfinalized",
    "term-locked",
  ])("blocks %s", async (fault) => {
    if (fault === "pdf-missing")
      f.session.report.mockResolvedValue(null as never);
    if (fault === "pdf-corrupt")
      f.base.storage.readPrivateFinalReport.mockResolvedValue(
        Buffer.from("broken"),
      );
    if (fault === "assignment-changed")
      f.base.base.f.f.registration.advisorAssignment!.advisorId = "other";
    if (fault === "plan-unfinalized")
      f.base.base.f.f.registration.advisorAssignment!.assignmentPlan.status =
        "PUBLISHED";
    if (fault === "term-locked") f.base.base.f.f.term.isLocked = true;
    expect((await f.context()).canSave).toBe(false);
    await expect(f.save()).rejects.toMatchObject({ status: 409 });
  });
  it("committee cannot write before or after its exact official slot", async () => {
    f.base.fault.time = new Date("2026-11-02T01:59:59Z");
    expect((await f.context("chair-user", "COMMITTEE")).canSave).toBe(false);
    f.base.fault.time = new Date("2026-11-02T02:30:00Z");
    await expect(f.save("chair-user", "COMMITTEE")).rejects.toMatchObject({
      status: 409,
    });
  });
  it("rechecks database-clock time after waiting for the term lock", async () => {
    const input = {
      ...(await f.command()),
      draft: { values: {}, comment: "", questions: [] },
    };
    f.session.lockGrading.mockImplementationOnce(async () => {
      f.base.fault.time = new Date("2027-01-01T00:00:00Z");
    });
    await expect(
      f.service.save(
        "reviewer-user",
        "term",
        "proposal",
        "REVIEWER",
        input,
        false,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.sheets).toHaveLength(0);
  });
  it("readonly context/history/download does not mutate business records or leak paths", async () => {
    const before = f.base.state.audit.length,
      c = await f.context();
    const identity = {
      finalReportId: c.pdf!.finalReportId,
      revision: c.pdf!.revision,
      checksum: c.pdf!.checksum,
    };
    const file = await f.service.download(
      "reviewer-user",
      "term",
      "proposal",
      "REVIEWER",
      identity,
    );
    expect(file.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(JSON.stringify(c)).not.toMatch(
      /storageKey|filePath|password|contentHash/,
    );
    expect(
      await f.service.history(
        "reviewer-user",
        "term",
        "proposal",
        "REVIEWER",
        0,
        25,
      ),
    ).toEqual({ items: [], nextRevision: null });
    expect(f.state.sheets).toHaveLength(0);
    expect(f.base.state.audit).toHaveLength(before);
  });
  it("history pages are stable, current source checked, no history editing", async () => {
    await f.save();
    await f.save();
    await f.seal();
    const first = await f.service.history(
      "reviewer-user",
      "term",
      "proposal",
      "REVIEWER",
      0,
      2,
    );
    expect(first.items.map((i) => i.revision)).toEqual([1, 2]);
    expect(first.nextRevision).toBe(2);
    expect(
      (
        await f.service.history(
          "reviewer-user",
          "term",
          "proposal",
          "REVIEWER",
          2,
          2,
        )
      ).items[0].revision,
    ).toBe(3);
  });
  it.each(["outside-term", "department-only", "admin-no-grant"])(
    "denies policy management: %s",
    async (kind) => {
      if (kind === "outside-term") f.grant.termId = "other";
      else f.grant.allDepartments = false;
      if (kind === "admin-no-grant")
        f.actors.get("faculty-user")!.userRoles[0].role.name = "ADMIN";
      await expect(
        f.service.policy("faculty-user", "term"),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
  it("client cannot approve quorum/rounding via configure", async () => {
    f.approveForTest();
    const p = await f.service.policy("faculty-user", "term");
    await expect(
      f.service.configure("faculty-user", "term", {
        expectedRevision: p.revision,
        expectedContext: p.expectedContext,
        requestId: randomUUID(),
        config: p.config!,
      }),
    ).rejects.toThrow();
  });
  it("UNKNOWN advisor/policy/council block UC24 without defaulting legacy grades", async () => {
    await f.allScores();
    const c = (await f.service.preview("faculty-user", "term")).items[0];
    expect(c.blockers).toEqual(
      expect.arrayContaining([
        "CALCULATION_POLICY_NEEDS_APPROVAL",
        "ADVISOR_GRADE_UNKNOWN_OR_STALE",
        "COUNCIL_RESULT_CONFIRMATION_NEEDS_APPROVAL",
      ]),
    );
    expect(c.final).toBe(null);
    await expect(f.resultCommand()).rejects.toMatchObject({ status: 409 });
    expect(f.state.results).toHaveLength(0);
  });
  it("with TEST-ONLY approved sources, seals and publishes per proposal with history/notification", async () => {
    f.approveForTest();
    await f.allScores();
    await f.resultCommand();
    expect(
      (await f.service.published("student-user", "term", "proposal")).state,
    ).toBe("NOT_PUBLISHED");
    await f.resultCommand(true);
    const r = await f.service.published("student-user", "term", "proposal");
    expect(r.result).toMatchObject({
      process: 9.5,
      committee: 10,
      final: 9.8,
      passed: true,
    });
    expect(f.state.resultHistory.map((h) => h.state)).toEqual([
      "SEALED",
      "PUBLISHED",
    ]);
    expect(f.state.results).toHaveLength(1);
  });
  it("student cannot read another student's results, even unpublished", async () => {
    f.actors.get("student-user")!.student!.id = "someone-else";
    await expect(
      f.service.published("student-user", "term", "proposal"),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("missing sheet is not zero and cannot seal or publish", async () => {
    f.approveForTest();
    await f.save();
    await f.seal();
    expect(
      (await f.service.preview("faculty-user", "term")).items[0].blockers.some(
        (b) => b.startsWith("MISSING_SEALED_COMMITTEE"),
      ),
    ).toBe(true);
    await expect(f.resultCommand(true)).rejects.toMatchObject({ status: 409 });
  });
  it("a reviewer may also be an official committee member; duplicate check is per grading role", async () => {
    f = await gradingFixture("chair");
    await f.configure();
    f.approveForTest();
    await f.save("chair-user", "REVIEWER");
    await f.seal("chair-user", "REVIEWER");
    for (const id of ["chair", "secretary", "member-lecturer"]) {
      await f.save(`${id}-user`, "COMMITTEE");
      await f.seal(`${id}-user`, "COMMITTEE");
    }
    expect(
      (await f.service.preview("faculty-user", "term")).items[0].blockers,
    ).not.toContain("DUPLICATE_SCORER");
    await f.resultCommand();
    expect(f.state.results[0].state).toBe("SEALED");
  });
  it.each(["result-history", "audit", "notification", "idempotency"])(
    "publication rolls back on %s",
    async (fault) => {
      f.approveForTest();
      await f.allScores();
      await f.resultCommand();
      if (fault === "result-history") f.fault.at = fault;
      else f.base.fault.at = fault;
      await expect(f.resultCommand(true)).rejects.toThrow("Injected");
      expect(f.state.results[0].state).toBe("SEALED");
      expect(f.state.resultHistory).toHaveLength(1);
    },
  );
});
