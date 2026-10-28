import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  checkCommittees,
  checkReviewers,
  checkSchedule,
} from "./defense-planning.policy";
import { planningFixture } from "./defense-planning.test-fixtures";

describe("UC19/UC20/UC21 pure preview rules", () => {
  it.each(["empty", "partial", "complete", "invalid-time"])(
    "reports unscheduled allocated students in a %s draft without blocking preview",
    async (kind) => {
      const f = planningFixture(),
        context = await f.service.context("advisor-user", "term");
      context.students.push({
        ...context.students[0],
        proposalId: "proposal-2",
        studentId: "student-2",
        termStudentId: "member-2",
      });
      const committee = {
        ...f.committee,
        proposalIds: ["proposal", "proposal-2"],
      };
      const slots =
        kind === "empty"
          ? []
          : kind === "invalid-time"
            ? [{ ...f.slot, endsAt: f.slot.startsAt }]
            : kind === "partial"
              ? [f.slot]
              : [
                  f.slot,
                  {
                    ...f.slot,
                    key: "second-slot",
                    proposalId: "proposal-2",
                    startsAt: f.slot.endsAt,
                    endsAt: "2026-11-02T03:00:00.000Z",
                  },
                ];
      const result = checkSchedule(
        context,
        [committee],
        [
          ...f.reviewers,
          { proposalId: "proposal-2", reviewerIds: ["reviewer"] },
        ],
        slots,
        false,
        [],
      );
      const warning = result.warnings.find(
        (w) => w.code === "SCHEDULE_STUDENTS_UNSCHEDULED",
      );
      if (kind === "complete") expect(warning).toBeUndefined();
      else
        expect(warning?.message).toContain(
          `Còn ${kind === "partial" ? 1 : 2} hồ sơ`,
        );
      if (kind !== "invalid-time") expect(result.issues).toEqual([]);
      else
        expect(result.issues.map((i) => i.code)).toContain(
          "SCHEDULE_TIME_INVALID",
        );
    },
  );
  it("schedule coverage excludes foreign IDs and students not admitted by the frozen list", async () => {
    const f = planningFixture();
    f.finalized();
    const context = await f.service.context("advisor-user", "term");
    context.students[0].admitted = false;
    const result = checkSchedule(
      context,
      [{ ...f.committee, proposalIds: ["proposal", "foreign-proposal"] }],
      [],
      [],
      false,
      [],
    );
    expect(result.warnings.map((w) => w.code)).not.toContain(
      "SCHEDULE_STUDENTS_UNSCHEDULED",
    );
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["NOT_ADMITTED_BY_UC18", "PROPOSAL_OUT_OF_SCOPE"]),
    );
  });
  it("invalid foreign IDs cannot probe another student's or lecturer's bookings", async () => {
    const f = planningFixture(),
      context = await f.service.context("advisor-user", "term");
    const committee = structuredClone(f.committee);
    committee.members[0].lecturerId = "foreign-lecturer";
    committee.proposalIds = ["foreign-proposal"];
    const slot = { ...f.slot, proposalId: "foreign-proposal" };
    const result = checkSchedule(context, [committee], [], [slot], true, [
      {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        roomId: "different-room",
        lecturerIds: ["foreign-lecturer"],
        proposalIds: ["foreign-proposal"],
        studentIds: ["foreign-student"],
      },
    ]);
    expect(result.issues.map((i) => i.code)).toContain("PROPOSAL_OUT_OF_SCOPE");
    expect(result.issues.map((i) => i.code)).not.toEqual(
      expect.arrayContaining(["STUDENT_ALREADY_SCHEDULED"]),
    );
    expect(result.issues.map((i) => i.code)).not.toContain(
      "LECTURER_ALREADY_BOOKED",
    );
  });
  it.each(["duplicate", "role", "too-few", "wrong-term", "advisor"])(
    "rejects committee %s conflicts",
    async (kind) => {
      const f = planningFixture(),
        c = structuredClone(f.committee),
        context = await f.service.context("advisor-user", "term");
      if (kind === "duplicate")
        c.members[2].lecturerId = c.members[0].lecturerId;
      if (kind === "role") c.members[1].role = "MEMBER" as "SECRETARY";
      if (kind === "too-few") c.members.pop();
      if (kind === "wrong-term") c.members[2].lecturerId = "outsider";
      if (kind === "advisor") c.members[2].lecturerId = "advisor";
      expect(checkCommittees(context, [c]).issues.length).toBeGreaterThan(0);
    },
  );
  it("checks duplicate allocations, explicit hypothetical capacity, and unknown proposals", async () => {
    const f = planningFixture(),
      c = await f.service.context("advisor-user", "term");
    const second = {
      ...f.committee,
      key: "another",
      name: "Khác",
      proposalIds: ["proposal", "outsider"],
      maxStudents: 1,
    };
    const result = checkCommittees(c, [f.committee, second]);
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "DUPLICATE_STUDENT_ALLOCATION",
        "ASSUMED_CAPACITY_EXCEEDED",
        "PROPOSAL_OUT_OF_SCOPE",
      ]),
    );
  });
  it("does not silently turn quorum, capacity or reviewer cardinality into fixed defaults", async () => {
    const f = planningFixture(),
      c = await f.service.context("advisor-user", "term");
    const result = checkReviewers(
      c,
      [f.committee],
      [{ proposalId: "proposal", reviewerIds: ["reviewer", "secretary"] }],
    );
    expect(result.issues).toEqual([]);
    expect(result.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining([
        "REVIEWER_CARDINALITY_UNCONFIRMED",
        "COMMITTEE_CAPACITY_UNCONFIGURED",
      ]),
    );
    expect(result.workload).toHaveLength(2);
  });
  it.each(["advisor", "duplicate", "outsider", "not-allocated"])(
    "checks reviewer %s conflict",
    async (kind) => {
      const f = planningFixture(),
        c = await f.service.context("advisor-user", "term");
      const r = {
        proposalId: kind === "not-allocated" ? "other" : "proposal",
        reviewerIds:
          kind === "duplicate"
            ? ["reviewer", "reviewer"]
            : [
                kind === "advisor"
                  ? "advisor"
                  : kind === "outsider"
                    ? "outsider"
                    : "reviewer",
              ],
      };
      expect(
        checkReviewers(c, [f.committee], [r]).issues.length,
      ).toBeGreaterThan(0);
    },
  );
  it.each(["room", "committee", "student", "lecturer"])(
    "detects overlapping %s in a proposed schedule",
    async (conflict) => {
      const f = planningFixture(),
        context = await f.service.context("advisor-user", "term");
      context.students.push({
        ...context.students[0],
        proposalId: "proposal-2",
        studentId: "student-2",
        termStudentId: "member-2",
      });
      const committees = [
        f.committee,
        {
          ...f.committee,
          key: "committee-2",
          name: "Hai",
          proposalIds: ["proposal-2"],
        },
      ];
      const second = {
        ...f.slot,
        key: "slot-2",
        proposalId: conflict === "student" ? "proposal" : "proposal-2",
        committeeKey:
          conflict === "committee" ? f.committee.key : "committee-2",
        roomId: conflict === "room" ? "room" : "room-2",
      };
      context.rooms.push({ id: "room-2", code: "P102", capacity: 20 });
      const codes = checkSchedule(
        context,
        committees,
        [
          ...f.reviewers,
          { proposalId: "proposal-2", reviewerIds: ["reviewer"] },
        ],
        [f.slot, second],
        true,
        [],
      ).issues.map((i) => i.code);
      expect(codes).toContain(
        {
          room: "ROOM_TIME_CONFLICT",
          committee: "COMMITTEE_TIME_CONFLICT",
          student: "STUDENT_TIME_CONFLICT",
          lecturer: "LECTURER_TIME_CONFLICT",
        }[conflict],
      );
    },
  );
  it("adjacent half-open slots do not conflict", async () => {
    const f = planningFixture(),
      c = await f.service.context("advisor-user", "term");
    c.students.push({
      ...c.students[0],
      proposalId: "proposal-2",
      studentId: "student-2",
      termStudentId: "member-2",
    });
    const committee = {
      ...f.committee,
      proposalIds: ["proposal", "proposal-2"],
    };
    const next = {
      ...f.slot,
      key: "next",
      proposalId: "proposal-2",
      startsAt: f.slot.endsAt,
      endsAt: "2026-11-02T03:00:00.000Z",
    };
    const result = checkSchedule(
      c,
      [committee],
      [...f.reviewers, { proposalId: "proposal-2", reviewerIds: ["reviewer"] }],
      [f.slot, next],
      true,
      [],
    );
    expect(result.issues).toEqual([]);
  });
  it.each(["time", "term", "room", "capacity", "reviewer"])(
    "rejects schedule %s violations",
    async (kind) => {
      const f = planningFixture(),
        c = await f.service.context("advisor-user", "term"),
        slot = { ...f.slot };
      if (kind === "time") slot.endsAt = slot.startsAt;
      if (kind === "term") slot.startsAt = "2025-01-01T00:00:00Z";
      if (kind === "room") slot.roomId = "unknown-room";
      if (kind === "capacity") c.rooms[0].capacity = 2;
      const result = checkSchedule(
        c,
        [f.committee],
        kind === "reviewer" ? [] : f.reviewers,
        [slot],
        true,
        [],
      );
      expect(result.issues.length).toBeGreaterThan(0);
    },
  );
});
