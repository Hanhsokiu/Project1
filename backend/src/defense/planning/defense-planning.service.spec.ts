import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { planningFixture } from "./defense-planning.test-fixtures";

describe("UC19–21 context, scoped reads and nonpersistent preview", () => {
  it("invalid/out-of-term dates do not trigger an unbounded global booking scan", async () => {
    const f = planningFixture(),
      input = await f.input();
    input.slots[0].startsAt = "1900-01-01T00:00:00Z";
    input.slots[0].endsAt = "2200-01-01T00:00:00Z";
    const result = await f.service.preview(
      "advisor-user",
      "term",
      "SCHEDULE",
      input,
    );
    expect(result.issues.map((i) => i.code)).toContain("SCHEDULE_OUTSIDE_TERM");
    expect(f.s.busySessions).not.toHaveBeenCalled();
  });
  it.each(["OPEN", "UNKNOWN"] as const)(
    "%s allows preview only, never claims admission or writes",
    async (state) => {
      const f = planningFixture();
      f.state.uc18 =
        state === "OPEN"
          ? { state, termId: "term", scope: "TERM", revision: 1 }
          : { state, termId: "term", scope: "TERM", reason: "DRAFT" };
      const context = await f.service.context("advisor-user", "term");
      expect(context.source).toMatchObject({
        kind: "ROSTER_PREVIEW",
        admittedCount: null,
      });
      expect(context.students[0].admitted).toBeNull();
      const input = await f.input();
      const response = await f.service.preview(
        "advisor-user",
        "term",
        "COMMITTEES",
        {
          expectedContext: input.expectedContext,
          committees: input.committees,
        },
      );
      expect(response).toMatchObject({
        persisted: false,
        mode: "PREVIEW_ONLY",
        officialReady: false,
        validForPreview: true,
      });
      expect(response.blockers.map((b) => b.code)).toContain(
        "UC18_NOT_FINALIZED",
      );
      expect(f.reader.read).toHaveBeenCalledWith("term", f.tx);
    },
  );
  it("reads the exact verified UC18 frozen roster, not added current members", async () => {
    const f = planningFixture();
    f.finalized();
    f.f.data.members.push({
      ...f.f.data.members[0],
      id: "new-member",
      studentId: "new-student",
    });
    const result = await f.service.context("advisor-user", "term");
    expect(result.source).toMatchObject({
      kind: "UC18_FINALIZED",
      rosterCount: 1,
      admittedCount: 1,
    });
    expect(result.students).toHaveLength(1);
    expect(result.capabilities.canCreateOfficial).toBe(false);
  });
  it("hash mismatch/missing finalization is fail closed, not a roster fallback", async () => {
    const f = planningFixture();
    f.finalized();
    f.captured.finalization.contentHash = "b".repeat(64);
    await expect(
      f.service.context("advisor-user", "term"),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("same checksum with new PDF revision marks current evidence stale, retains FINALIZED", async () => {
    const f = planningFixture();
    f.finalized();
    f.f.data.proposals[0].finalReport.revision++;
    const context = await f.service.context("advisor-user", "term");
    expect(context.uc18.state).toBe("FINALIZED");
    expect(context.students[0].evidence).toBe("STALE");
  });
  it.each([
    "permission",
    "grant",
    "department-only",
    "inactive",
    "must-change",
    "ADMIN",
  ])("rejects %s without reading private planning data", async (kind) => {
    const f = planningFixture();
    if (kind === "permission")
      f.f.f.user.userRoles[0].role.rolePermissions = [];
    if (kind === "grant") f.f.grant.termId = "other-term";
    if (kind === "department-only") {
      f.f.grant.allDepartments = false;
      f.f.grant.pr2bGrantDepartmentGrantId.push({ departmentId: "department" });
    }
    if (kind === "inactive") f.f.f.user.status = "LOCKED";
    if (kind === "must-change") f.f.f.user.mustChangePassword = true;
    if (kind === "ADMIN") f.f.f.user.userRoles[0].role.name = "ADMIN";
    await expect(
      f.service.context("advisor-user", "term"),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.s.members).not.toHaveBeenCalled();
  });
  it("read permission does not imply preview permission", async () => {
    const f = planningFixture();
    const input = await f.input();
    f.f.f.user.userRoles[0].role.rolePermissions =
      f.f.f.user.userRoles[0].role.rolePermissions.filter(
        (p) => p.permission.action !== "preview",
      );
    await expect(
      f.service.preview("advisor-user", "term", "SCHEDULE", input),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await f.service.context("advisor-user", "term")).capabilities.canPreview,
    ).toBe(false);
  });
  it("expected context rejects changed official assignment, including AssignmentChange revision", async () => {
    const f = planningFixture(),
      input = await f.input();
    const a = f.f.f.registration.advisorAssignment!;
    a.pr2bAssignmentChangeAssignmentId.push({
      assignmentId: a.id,
      assignmentRevision: 1,
      newAdvisorId: a.advisorId,
      effectiveAt: new Date("2026-10-25Z"),
    } as never);
    await expect(
      f.service.preview("advisor-user", "term", "SCHEDULE", input),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("changed PDF and UC18 state invalidate an old preview context", async () => {
    const f = planningFixture(),
      input = await f.input();
    f.f.data.proposals[0].finalReport.revision++;
    f.finalized();
    await expect(
      f.service.preview("advisor-user", "term", "SCHEDULE", input),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("PUBLISHED and stale official plan pointers do not establish an advisor for conflict checking", async () => {
    const f = planningFixture();
    f.f.f.registration.advisorAssignment!.assignmentPlan.status = "PUBLISHED";
    const input = await f.input();
    const result = await f.service.preview(
      "advisor-user",
      "term",
      "SCHEDULE",
      input,
    );
    expect(result.issues.map((i) => i.code)).toContain(
      "OFFICIAL_ADVISOR_UNKNOWN",
    );
  });
  it("REJECTED/non-admitted students cannot enter a finalized-list plan", async () => {
    const f = planningFixture();
    f.captured.snapshot.students[0].admitted = false;
    f.captured.snapshot.students[0].exclusionReasons = ["REJECTED"];
    f.finalized();
    const input = await f.input();
    const result = await f.service.preview(
      "advisor-user",
      "term",
      "SCHEDULE",
      input,
    );
    expect(result.issues.map((i) => i.code)).toContain("NOT_ADMITTED_BY_UC18");
  });
  it("hash integrity is not permission to ignore a contradictory UC18 admission", async () => {
    const f = planningFixture();
    f.captured.snapshot.students[0].confirmation!.status = "REJECTED";
    f.finalized();
    const input = await f.input();
    const result = await f.service.preview(
      "advisor-user",
      "term",
      "SCHEDULE",
      input,
    );
    expect(result.validForPreview).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain(
      "UC18_ADMISSION_INCONSISTENT",
    );
    expect(f.state.uc18.state).toBe("FINALIZED");
  });
  it("server reads conflict bookings and never returns foreign term identifiers", async () => {
    const f = planningFixture(),
      input = await f.input();
    f.s.busySessions.mockResolvedValueOnce([
      {
        id: "foreign-session-secret",
        committeeId: "foreign-committee-secret",
        roomId: "room",
        scheduledAt: new Date(input.slots[0].startsAt),
        durationMin: 60,
        committee: { members: [{ lecturerId: "chair" }] },
        committeeStudents: [{ proposalId: "foreign-student-secret" }],
      },
    ]);
    const result = await f.service.preview(
      "advisor-user",
      "term",
      "SCHEDULE",
      input,
    );
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "ROOM_ALREADY_BOOKED",
        "LECTURER_ALREADY_BOOKED",
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /foreign-session|foreign-committee|foreign-student|storageKey|filePath/,
    );
  });
  it("stored legacy records are explicitly unverified and scoped to the server term", async () => {
    const f = planningFixture();
    f.s.committees.mockResolvedValue([
      { id: "committee", name: "Hội đồng cũ", members: [] },
    ]);
    const result = await f.service.records(
      "advisor-user",
      "term",
      "committees",
      "committee",
    );
    expect(result).toMatchObject({ official: false, lifecycle: "UNVERIFIED" });
    await expect(
      f.service.records(
        "advisor-user",
        "term",
        "committees",
        "other-term-committee",
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("detects the same student under another term's proposal without disclosing that proposal", async () => {
    const f = planningFixture(),
      input = await f.input();
    f.s.busySessions.mockResolvedValueOnce([
      {
        id: "foreign-session",
        committeeId: "foreign-committee",
        roomId: "different-room",
        scheduledAt: new Date(input.slots[0].startsAt),
        durationMin: 30,
        committee: { members: [] },
        committeeStudents: [{ proposalId: "foreign-proposal" }],
      },
    ]);
    f.s.bookingStudents.mockResolvedValueOnce([
      { id: "foreign-proposal", studentId: "student" },
    ]);
    const result = await f.service.preview(
      "advisor-user",
      "term",
      "SCHEDULE",
      input,
    );
    expect(result.issues.map((i) => i.code)).toContain(
      "STUDENT_ALREADY_SCHEDULED",
    );
    expect(JSON.stringify(result)).not.toContain("foreign-proposal");
  });
  it("does not leak cross-term proposal references through legacy sessions", async () => {
    const f = planningFixture();
    f.s.sessions.mockResolvedValue([
      {
        id: "session",
        committeeId: "committee",
        roomId: "room",
        scheduledAt: new Date("2026-11-02Z"),
        durationMin: 30,
        committeeStudents: [{ proposalId: "foreign-proposal" }],
      },
    ]);
    const result = await f.service.records("advisor-user", "term", "schedule");
    expect(JSON.stringify(result)).not.toContain("foreign-proposal");
    expect(result).toMatchObject({ items: [{ hasUnscopedReferences: true }] });
  });
  it("rejects client-supplied actor/advisor/snapshot authority fields", async () => {
    const f = planningFixture(),
      input = await f.input();
    await expect(
      f.service.preview("advisor-user", "term", "SCHEDULE", {
        ...input,
        actorId: "admin",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
