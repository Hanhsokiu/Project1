import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchedulePolicySchema, ScheduleSaveSchema } from "@doan/shared";
import type { ScheduleSource } from "@doan/shared";
import { createScheduleFixture } from "../../../test/schedule.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
import {
  bookingConflicts,
  buildSession,
  localInstant,
  localParts,
  overlaps,
  proposeSchedule,
  sortDefenseStudents,
  splitVietnameseName,
} from "./schedule-engine";
import { scheduleContext } from "./schedule-context";
let f: Awaited<ReturnType<typeof createScheduleFixture>>;
beforeEach(async () => {
  f = await createScheduleFixture();
});
describe("UC21 official synthetic workflow", () => {
  it("does not union student and lecturer publication policies for a multi-role account", async () => {
    const id = (await f.save()).sessions[0].id;
    await f.transition(id, "finalize");
    await f.transition(id, "publish");
    const users = f.rw.cc.eligibility.f.users,
      u = users.get(ids.student)!,
      lecturer = users.get(ids.lecturer)!;
    u.userRoles.push(...lecturer.userRoles);
    u.lecturer = lecturer.lecturer;
    u.student!.id = "unrelated-student";
    f.policy.lecturerVisibility = false;
    expect(
      (await f.service.workspace(ids.student, ids.term)).schedules,
    ).toEqual([]);
  });
  it("rolls back an entire multi-session apply when a later item conflicts", async () => {
    const b = await f.saveBody();
    await expect(
      f.service.saveBatch(
        ids.faculty,
        {
          termId: ids.term,
          rosterHash: b.rosterHash,
          reason: "TEST_ONLY atomic batch",
          sessions: [
            { id: null, body: b },
            { id: null, body: { ...b, roomId: "r2" } },
          ],
        },
        "batch",
      ),
    ).rejects.toThrow();
    expect(f.state.rows).toHaveLength(0);
    expect(f.state.events).toHaveLength(0);
    expect(f.state.replays.size).toBe(0);
  });
  it("manual preview never writes and changing a draft into conflict is rejected", async () => {
    const b = await f.saveBody(),
      p = await f.service.preview(ids.faculty, null, b);
    expect(p.slots[0].studentName).toBe("Nguyễn Văn An");
    expect(f.state.rows).toHaveLength(0);
    const id = (await f.save()).sessions[0].id,
      edit = await f.saveBody(id);
    edit.startTime = "10:30";
    const preview = await f.service.preview(ids.faculty, id, edit);
    expect(preview.issues).toEqual([]);
    edit.startTime = "11:20";
    await expect(
      f.service.save(ids.faculty, id, edit, "bad-edit"),
    ).rejects.toThrow();
    expect(f.state.rows[0].scheduledAt.toISOString()).toContain("T01:00");
  });
  it("save -> edit -> finalize -> explicit publish -> own personal schedule; keeps UC19/20 unchanged", async () => {
    const beforeCC = structuredClone(f.rw.cc.state),
      beforeRW = structuredClone(f.rw.state);
    const result = await f.save(),
      id = result.sessions[0].id;
    expect((await f.workspace()).schedules[0].state).toBe("DRAFT");
    expect(
      (await f.service.workspace(ids.student, ids.term)).schedules,
    ).toEqual([]);
    const b = await f.saveBody(id);
    b.roomId = "r2";
    await f.service.save(ids.faculty, id, b, "edit");
    await f.transition(id, "finalize");
    const official = (await f.workspace()).schedules[0];
    expect(official.downstream?.effectiveStatus).toBe("CURRENT");
    expect(
      (await f.service.workspace(ids.student, ids.term)).schedules,
    ).toEqual([]);
    await f.transition(id, "publish");
    const personal = await f.service.workspace(ids.student, ids.term);
    expect(personal.schedules).toHaveLength(1);
    expect(personal.schedules[0].slots.map((s) => s.studentId)).toEqual([
      "student-profile",
    ]);
    expect(personal.sources).toEqual([]);
    expect(personal.schedules[0].history).toEqual([]);
    expect(
      (await f.service.workspace(ids.lecturer, ids.term)).schedules,
    ).toHaveLength(1);
    expect(f.rw.cc.state).toEqual(beforeCC);
    expect(f.rw.state).toEqual(beforeRW);
    const c = (await f.workspace()).schedules[0];
    expect(
      await f.service.effectiveInSession(
        f.session,
        ids.faculty,
        ids.term,
        id,
        c.revision,
        c.evidenceHash,
      ),
    ).toBeTruthy();
    await expect(f.save(id)).rejects.toThrow();
    await expect(f.transition(id, "finalize")).rejects.toThrow();
  });
  it("does not create a UC20 prerequisite when reviewer attendance is NOT_REQUIRED", async () => {
    expect(f.rw.state.rows).toHaveLength(0);
    await f.save();
    expect((await f.workspace()).schedules[0].state).toBe("DRAFT");
  });
  it("requires effective UC20 only when policy explicitly requires reviewer attendance", async () => {
    f.policy.reviewerAttendance = "REQUIRED";
    await expect(f.save()).rejects.toThrow();
    await f.rw.assign();
    await f.rw.finalize();
    const r = await f.save();
    expect(
      scheduleContext(f.state.rows[0].context)!.slots[0].reviewerIds,
    ).toEqual(["l4"]);
    await f.transition(r.sessions[0].id, "finalize");
  });
  it("blocks undefined attendance/policy/schema/writes rather than inventing rules", async () => {
    f.policy.reviewerAttendance = "PENDING_APPROVAL";
    await expect(f.save()).rejects.toThrow();
    f.policy.reviewerAttendance = "NOT_REQUIRED";
    f.control.approved = false;
    expect((await f.workspace()).blockers).toContain("UC21_POLICY_REQUIRED");
    f.control.approved = true;
    f.control.schema = false;
    await expect(f.save()).rejects.toThrow();
    f.control.schema = true;
    f.control.writes = false;
    await expect(f.save()).rejects.toThrow();
    expect(
      SchedulePolicySchema.safeParse({ ...f.policy, durationMin: undefined })
        .success,
    ).toBe(false);
  });
  it.each(["uc18", "uc19", "advisor-member"] as const)(
    "marks source %s stale after finalization, retains data and hides personal output",
    async (type) => {
      const id = (await f.save()).sessions[0].id;
      await f.transition(id, "finalize");
      await f.transition(id, "publish");
      const before = structuredClone(f.state.rows);
      if (type === "uc18") f.rw.cc.eligibility.state.row!.finalizedAt = null;
      if (type === "uc19")
        f.rw.cc.state.rows.get(f.rw.committeeId)!.state = "DRAFT";
      if (type === "advisor-member")
        f.rw.cc.state.rows.get(f.rw.committeeId)!.members[0].lecturerId =
          "official-advisor";
      expect((await f.workspace()).schedules[0].state).toBe("STALE");
      expect((await f.workspace()).schedules[0].downstream).toBeNull();
      expect(
        (await f.service.workspace(ids.student, ids.term)).schedules,
      ).toEqual([]);
      expect(f.state.rows).toEqual(before);
    },
  );
  it("rejects wrong term, scope, room, dates, overflow, forged actor and duplicate students", async () => {
    const b = await f.saveBody();
    expect(
      ScheduleSaveSchema.safeParse({ ...b, actor: ids.faculty }).success,
    ).toBe(false);
    expect(
      ScheduleSaveSchema.safeParse({
        ...b,
        termStudentIds: [memberId, memberId],
      }).success,
    ).toBe(false);
    for (const change of [
      { roomId: "unknown" },
      { date: "2030-11-08" },
      { startTime: "11:20" },
      { termId: "wrong" },
    ])
      await expect(
        f.service.save(
          ids.faculty,
          null,
          { ...(await f.saveBody()), ...change },
          "bad-" + JSON.stringify(change),
        ),
      ).rejects.toThrow();
    f.rooms[0].capacity = 1;
    await expect(f.save()).rejects.toThrow();
    f.policy.roomAccess.forEach((r) => (r.departmentIds = ["elsewhere"]));
    await expect(f.save()).rejects.toThrow();
  });
  it("does not re-adopt legacy and conservatively blocks shared legacy resources across terms", async () => {
    const id = (await f.save()).sessions[0].id;
    const legacy = structuredClone(f.state.rows[0]);
    Object.assign(legacy, {
      id: "legacy",
      revision: 0,
      state: null,
      context: null,
      committee: { ...legacy.committee, termId: "other-term" },
    });
    f.state.rows.push(legacy);
    const c = (await f.workspace()).schedules.find((r) => r.id === id)!;
    expect(c.issues).toContain("ROOM_CONFLICT");
    await expect(f.transition(id, "finalize")).rejects.toThrow();
    f.state.rows.find((r) => r.id === "legacy")!.committee.termId = ids.term;
    expect(
      (await f.workspace()).schedules.find((r) => r.id === "legacy")!.state,
    ).toBe("LEGACY_UNVERIFIED");
  });
  it("cancels draft explicitly, preserves rows/history and releases its reservations", async () => {
    const id = (await f.save()).sessions[0].id;
    await f.transition(id, "cancel");
    expect((await f.workspace()).schedules[0].state).toBe("CANCELLED");
    await f.save();
    expect(f.state.rows).toHaveLength(2);
    expect(f.state.events.some((e) => e.action === "SCHEDULE_CANCELLED")).toBe(
      true,
    );
  });
  it("requires current revision/evidence and rejects source/room changes after preview", async () => {
    const b = await f.saveBody();
    f.rooms[0].name = "Changed";
    await expect(
      f.service.save(ids.faculty, null, b, "stale"),
    ).rejects.toThrow();
    const id = (await f.save()).sessions[0].id,
      c = await f.command(id);
    c.members[0].expectedRevision = 99;
    await expect(
      f.service.transition(ids.faculty, c, "rev", "finalize"),
    ).rejects.toThrow();
    const evidence = await f.command(id);
    evidence.members[0].evidenceHash = "0".repeat(64);
    await expect(
      f.service.transition(ids.faculty, evidence, "hash", "finalize"),
    ).rejects.toThrow();
  });
  it("rejects duplicate proposal booking even on a different day/room", async () => {
    await f.save();
    const b = await f.saveBody();
    b.roomId = "r2";
    b.period = "AFTERNOON";
    b.startTime = "13:30";
    await expect(
      f.service.save(ids.faculty, null, b, "duplicate"),
    ).rejects.toThrow();
    expect(f.state.rows).toHaveLength(1);
  });
  it("enforces role-bound permission and scope; ADMIN has no academic bypass", async () => {
    const b = await f.saveBody();
    for (const actor of [ids.student, ids.lecturer, ids.admin, ids.outsider])
      await expect(f.service.save(actor, null, b, "role")).rejects.toThrow();
    vi.spyOn(f.session, "grants").mockResolvedValue([]);
    await expect(f.workspace()).rejects.toThrow();
  });
  it("hides drafts/unpublished/restricted schedules and other student identities from personal reads", async () => {
    const id = (await f.save()).sessions[0].id;
    await f.transition(id, "finalize");
    await f.transition(id, "publish");
    f.policy.studentVisibility = false;
    expect(
      (await f.service.workspace(ids.student, ids.term)).schedules,
    ).toEqual([]);
    f.policy.studentVisibility = true;
    f.policy.publishNotBefore = "2099-01-01T00:00:00Z";
    expect(
      (await f.service.workspace(ids.student, ids.term)).schedules,
    ).toEqual([]);
    expect(
      JSON.stringify(await f.service.workspace(ids.student, ids.term)),
    ).not.toContain("Nguyễn Văn An");
  });
  it("idempotent replay does not write again; different body conflicts and reauthorization still applies", async () => {
    const b = await f.saveBody(),
      r = await f.service.save(ids.faculty, null, b, "same");
    expect(await f.service.save(ids.faculty, null, b, "same")).toEqual(r);
    expect(f.state.events).toHaveLength(1);
    await expect(
      f.service.save(ids.faculty, null, { ...b, reason: "changed" }, "same"),
    ).rejects.toThrow();
    vi.spyOn(f.session, "grants").mockResolvedValue([]);
    await expect(
      f.service.save(ids.faculty, null, b, "same"),
    ).rejects.toThrow();
  });
  it.each(["auditFailure", "rememberFailure"] as const)(
    "rolls back bookings and history after %s",
    async (flag) => {
      f.control[flag] = true;
      await expect(f.save()).rejects.toThrow();
      expect(f.state.rows).toHaveLength(0);
      expect(f.state.events).toHaveLength(0);
      expect(f.state.replays.size).toBe(0);
    },
  );
  it.each(["same-room", "shared-lecturer"] as const)(
    "serializes competing synthetic bookings %s",
    async (kind) => {
      const b = await f.saveBody(),
        other = { ...b, roomId: kind === "same-room" ? "r1" : "r2" };
      const result = await Promise.allSettled([
        f.service.save(ids.faculty, null, b, "a"),
        f.service.save(ids.faculty, null, other, "b"),
      ]);
      expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(f.state.rows).toHaveLength(1);
    },
  );
  it("preview and GET are readonly; solver runs outside the evidence transaction", async () => {
    expect((await f.service.propose(ids.faculty, ids.term)).status).toBe(
      "FEASIBLE",
    );
    await f.workspace();
    await f.service.options(ids.faculty);
    await f.service.list(ids.faculty, {
      termId: ids.term,
      page: 1,
      limit: 20,
      search: "",
    });
    expect(f.state.rows).toHaveLength(0);
    expect(f.state.events).toHaveLength(0);
    expect(f.state.replays.size).toBe(0);
  });
  it("does not nest UC19/UC20 transactions", async () => {
    const cc = vi.spyOn(f.rw.cc.service, "effectiveInSession"),
      nested = vi.spyOn(f.rw.cc.repo, "read");
    await f.save();
    expect(cc.mock.calls.every((c) => c[0] === f.session)).toBe(true);
    expect(nested).not.toHaveBeenCalled();
  });
});
describe("Vietnamese names, time geometry and deterministic scheduling", () => {
  it("keeps post-session buffer inside the approved period and term bounds", async () => {
    const w = await f.workspace();
    f.policy.sessionBufferMin = 10;
    const args = {
      source: w.sources[0],
      room: w.rooms[0],
      date: "2030-11-07",
      period: "MORNING" as const,
      startTime: "11:00",
      studentIds: [memberId],
      policy: f.policy,
      bounds: {
        start: Date.parse("2030-11-01"),
        end: Date.parse("2030-12-01"),
      },
    };
    expect(() => buildSession(args)).toThrow("SESSION_OVERFLOW");
    expect(() =>
      buildSession({
        ...args,
        startTime: "08:00",
        bounds: {
          start: Date.parse("2030-11-01"),
          end: Date.parse("2030-11-07T01:35:00Z"),
        },
      }),
    ).toThrow("OUTSIDE_DEFENSE_PHASE");
  });
  it("reserves committee/session buffers and actual required reviewer attendance spans", async () => {
    f.policy.reviewerAttendance = "REQUIRED";
    await f.rw.assign();
    await f.rw.finalize();
    const w = await f.workspace(),
      c = w.sources[0],
      room = w.rooms[0],
      bounds = {
        start: Date.parse("2030-11-01"),
        end: Date.parse("2030-12-01"),
      };
    const args = {
      source: c,
      room,
      date: "2030-11-07",
      period: "MORNING" as const,
      startTime: "08:00",
      studentIds: [memberId],
      policy: f.policy,
      bounds,
    };
    const a = buildSession(args);
    const other = {
      id: "other",
      committeeId: "other-c",
      roomId: "r2",
      start: a.end,
      end: a.end + 1800000,
      students: [],
      lecturers: [{ lecturerId: "l4", start: a.end, end: a.end + 1800000 }],
    };
    expect(bookingConflicts(a.booking, [other])).toEqual([]);
    f.policy.sessionBufferMin = 10;
    expect(bookingConflicts(buildSession(args).booking, [other])).toContain(
      "LECTURER_CONFLICT",
    );
    const without = { ...c, reviewers: [] };
    expect(() => buildSession({ ...args, source: without })).toThrow(
      "UC20_CURRENT_REVIEWERS_REQUIRED",
    );
  });
  it("orders each committee/session independently and enforces nonzero duration/capacity", async () => {
    const w = await f.workspace(),
      c = w.sources[0],
      room = w.rooms[0],
      bounds = {
        start: Date.parse("2030-11-01"),
        end: Date.parse("2030-12-01"),
      };
    const students = [
      { ...c.students[0], studentName: "Trần Bình", termStudentId: "b" },
      {
        ...c.students[0],
        studentName: "Nguyễn An",
        termStudentId: "a",
        proposalId: "pa",
        studentId: "person-a",
      },
    ];
    const result = buildSession({
      source: { ...c, students },
      room,
      date: "2030-11-07",
      period: "MORNING",
      startTime: "08:00",
      studentIds: ["b", "a"],
      policy: f.policy,
      bounds,
    });
    expect(result.slots.map((s) => s.termStudentId)).toEqual(["a", "b"]);
    expect(result.slots[1].order).toBe(2);
    expect(
      SchedulePolicySchema.safeParse({ ...f.policy, durationMin: 0 }).success,
    ).toBe(false);
    f.policy.maxStudentsPerSession = 1;
    expect(() =>
      buildSession({
        source: { ...c, students },
        room,
        date: "2030-11-07",
        period: "MORNING",
        startTime: "08:00",
        studentIds: ["a", "b"],
        policy: f.policy,
        bounds,
      }),
    ).toThrow("SESSION_CAPACITY_EXCEEDED");
  });
  it("splits one/two/multiple words, trims whitespace and uses approved compound family prefixes", () => {
    expect(splitVietnameseName("  An  ")).toEqual({
      given: "An",
      middle: "",
      family: "",
    });
    expect(splitVietnameseName("Nguyễn An")).toEqual({
      given: "An",
      middle: "",
      family: "Nguyễn",
    });
    expect(splitVietnameseName(" Tôn  Nữ   Thị An ", ["Tôn Nữ"])).toEqual({
      given: "An",
      middle: "Thị",
      family: "Tôn Nữ",
    });
  });
  it("orders given -> middle -> family -> code/id, not surname or database order", () => {
    const names = [
      "Nguyễn Văn An",
      "Lê Thị Bình",
      "Trần Minh Cường",
      "Trần Thị An",
      "Lê Thị An",
    ];
    const students = names.map((studentName, i) => ({
      studentName,
      studentCode: `S${i}`,
      termStudentId: `id${i}`,
    }));
    expect(
      sortDefenseStudents(students, f.policy).map((s) => s.studentName),
    ).toEqual([
      "Lê Thị An",
      "Trần Thị An",
      "Nguyễn Văn An",
      "Lê Thị Bình",
      "Trần Minh Cường",
    ]);
  });
  it("preserves Vietnamese accent/Đ collation and handles Unicode NFC/NFD and exact-name ties", () => {
    const students = ["Đan", "Dung", "Án", "An", "Ăn", "Ân"].map(
      (studentName, i) => ({
        studentName,
        studentCode: `S${i}`,
        termStudentId: `i${i}`,
      }),
    );
    expect(
      sortDefenseStudents(students, f.policy).map((s) => s.studentName),
    ).toEqual(["An", "Án", "Ăn", "Ân", "Dung", "Đan"]);
    const a = {
        studentName: "Nguyễn Văn Đạt",
        studentCode: "S2",
        termStudentId: "b",
      },
      b = {
        ...a,
        studentName: a.studentName.normalize("NFD"),
        studentCode: "S1",
        termStudentId: "a",
      };
    expect(sortDefenseStudents([a, b], f.policy)[0].termStudentId).toBe("a");
  });
  it("converts local Vietnam time to UTC without relying on host timezone", () => {
    expect(new Date(localInstant("2030-11-07", "08:00")).toISOString()).toBe(
      "2030-11-07T01:00:00.000Z",
    );
    expect(localParts("2030-11-07T06:30:00Z")).toMatchObject({
      date: "2030-11-07",
      time: "13:30",
    });
  });
  it("uses half-open boundaries and required buffers", () => {
    expect(overlaps(0, 30, 30, 60)).toBe(false);
    expect(overlaps(0, 31, 30, 60)).toBe(true);
  });
  const source = async () => {
    const w = await f.workspace();
    return w.sources[0];
  };
  it("skips approved breaks and rejects overflow/outside date/manual exceptions", async () => {
    const c = await source(),
      room = (await f.workspace()).rooms[0],
      bounds = {
        start: Date.parse("2030-11-01"),
        end: Date.parse("2030-12-01"),
      };
    f.policy.periods.MORNING.breaks = [{ start: "08:10", end: "08:30" }];
    const args = {
      source: c,
      room,
      date: "2030-11-07",
      period: "MORNING" as const,
      startTime: "08:00",
      studentIds: [memberId],
      policy: f.policy,
      bounds,
    };
    expect(localParts(buildSession(args).slots[0].startAt).time).toBe("08:30");
    expect(() => buildSession({ ...args, startTime: "11:20" })).toThrow(
      "SESSION_OVERFLOW",
    );
    expect(() => buildSession({ ...args, manualOrder: [memberId] })).toThrow(
      "MANUAL_ORDER_NOT_APPROVED",
    );
    f.policy.manualOrderAllowed = true;
    expect(
      buildSession({ ...args, manualOrder: [memberId] }).automaticOrder,
    ).toEqual([memberId]);
  });
  it("checks room, committee, shared members, students and attending reviewers across existing bookings", async () => {
    const w = await f.workspace(),
      c = w.sources[0],
      room = w.rooms[0],
      bounds = {
        start: Date.parse("2030-11-01"),
        end: Date.parse("2030-12-01"),
      };
    const a = buildSession({
      source: c,
      room,
      date: "2030-11-07",
      period: "MORNING",
      startTime: "08:00",
      studentIds: [memberId],
      policy: f.policy,
      bounds,
    }).booking;
    const b = {
      ...a,
      id: "existing",
      committeeId: "other",
      students: [],
      lecturers: [{ lecturerId: c.members[0], start: a.start, end: a.end }],
    };
    expect(bookingConflicts(a, [b])).toEqual(
      expect.arrayContaining(["ROOM_CONFLICT", "LECTURER_CONFLICT"]),
    );
    expect(
      bookingConflicts(a, [
        {
          ...b,
          roomId: "other",
          committeeId: c.committeeId,
          students: a.students,
          lecturers: [],
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        "COMMITTEE_CONFLICT",
        "STUDENT_CONFLICT",
        "PROPOSAL_ALREADY_SCHEDULED",
      ]),
    );
  });
  it("splits student groups over morning/afternoon, deterministic under input permutations and reports UNSAT/search-limit", async () => {
    const w = await f.workspace(),
      c = w.sources[0];
    const expanded: ScheduleSource = {
      ...c,
      students: Array.from({ length: 3 }, (_, i) => ({
        ...c.students[0],
        termStudentId: `s${i}`,
        proposalId: `p${i}`,
        studentId: `person${i}`,
        studentCode: `S${i}`,
        studentName: ["Nguyễn An", "Trần Bình", "Lê Cường"][i],
      })),
    };
    f.policy.maxStudentsPerSession = 2;
    const args = {
      sources: [expanded],
      rooms: w.rooms,
      existing: [],
      policy: f.policy,
      bounds: {
        start: Date.parse("2030-11-01"),
        end: Date.parse("2030-12-01"),
      },
    };
    const r = proposeSchedule(args);
    expect(r.status).toBe("FEASIBLE");
    expect(r.plans.map((p) => p.period)).toEqual(["MORNING", "AFTERNOON"]);
    expect(
      proposeSchedule({
        ...args,
        sources: [{ ...expanded, students: [...expanded.students].reverse() }],
        rooms: [...w.rooms].reverse(),
      }),
    ).toEqual(r);
    expect(proposeSchedule({ ...args, rooms: [] }).status).toBe("UNSAT");
    const limit = proposeSchedule({ ...args, nodeLimit: 0 });
    expect(limit.status).toBe("SEARCH_LIMIT");
    expect(limit.plans).toEqual([]);
  });
});
