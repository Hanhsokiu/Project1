import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  persist,
  readDb,
  resetDemo,
  SESSION_KEY,
} from "../../../shared/data/store";
import type { Defense } from "../../../shared/data/types";
import {
  assignReviewer,
  confirmDefermentReview,
  decideDeferment,
  eligibilityFor,
  publishDefenseSchedule,
  publishReviewerAssignments,
  requestDeferment,
  resumeDeferment,
  saveCommittee,
  saveSchedule,
  scheduleConflicts,
  sortDefenseOrder,
  submitDefermentApplication,
  validateAssignment,
} from "./defense-service";
function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, String(v)),
    removeItem: (k: string) => map.delete(k),
  };
}
function login(id: string) {
  const db = readDb();
  db.accounts.find((a) => a.id === id)!.mustChangePassword = false;
  persist(db);
  sessionStorage.setItem(SESSION_KEY, id);
}
function ready(studentId = "sv1") {
  const db = readDb();
  const topic = db.topics.find(
    (t) => t.termId === "dot1" && t.studentId === studentId,
  )!;
  topic.status = "APPROVED";
  topic.advisorAgreed = true;
  db.tasks
    .filter((t) => t.termId === "dot1" && t.studentId === studentId)
    .forEach((t) => {
      t.progress = 100;
      t.submissions = [
        {
          id: `pass-${t.id}`,
          at: "2026-10-22",
          content: "Hoàn thành",
          files: [],
          status: "PASS",
          feedback: "Đạt",
        },
      ];
    });
  db.finals = db.finals.filter((f) => f.studentId !== studentId);
  db.finals.push({
    id: `final-${studentId}`,
    termId: "dot1",
    studentId,
    file: {
      name: "do-an.pdf",
      type: "application/pdf",
      size: 100,
      dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
    },
    confirmed: true,
    comment: "Đồng ý bảo vệ",
    submittedAt: "2026-10-22",
    revisions: [],
  });
  persist(db);
}
function defense(studentId = "sv1"): Defense {
  return {
    id: `d-${studentId}`,
    termId: "dot1",
    studentId,
    committeeId: "hd1",
    reviewerId: "gv7",
    date: "2027-01-18",
    start: "08:00",
    end: "08:30",
    room: "A8-301",
    order: 1,
    minutes: "",
    revision: "",
    reviewerPublished: true,
    schedulePublished: true,
  };
}
beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  resetDemo();
  const db = readDb();
  db.defenses = [];
  db.scores = [];
  db.deferments = [];
  db.finals = [];
  db.terms[0].locked = false;
  db.terms[0].resultsPublished = false;
  persist(db);
});
describe("eligibility reads the same guidance state", () => {
  it("requires academic verification, completed reviewed tasks and advisor-confirmed final", () => {
    ready();
    let db = readDb();
    expect(eligibilityFor(db, "dot1", "sv1").eligible).toBe(true);
    db.tasks.find((t) => t.studentId === "sv1")!.progress = 90;
    expect(eligibilityFor(db, "dot1", "sv1").eligible).toBe(false);
    db = readDb();
    db.finals[0].confirmed = false;
    expect(eligibilityFor(db, "dot1", "sv1").reasons).toContain(
      "PDF final và xác nhận GVHD",
    );
    db = readDb();
    db.students[0].eligible = false;
    expect(eligibilityFor(db, "dot1", "sv1").reasons).toContain(
      "Điều kiện học vụ",
    );
  });
  it("blocks a pending revision even when the numerical pass rate is met", () => {
    ready();
    const db = readDb();
    db.terms[0].parameters.min_weekly_pass_rate = 0.5;
    db.tasks.find((t) => t.studentId === "sv1")!.submissions[0].status =
      "REVISION";
    expect(
      eligibilityFor(db, "dot1", "sv1").checks.find(
        (c) => c.name === "Báo cáo tuần đạt yêu cầu",
      )?.pass,
    ).toBe(true);
    expect(eligibilityFor(db, "dot1", "sv1").eligible).toBe(false);
  });
});
describe("committee and reviewer constraints", () => {
  it("rejects advisor, advisor committee and a reviewer from a committee containing the advisor", () => {
    const db = readDb();
    expect(() => validateAssignment(db, "dot1", "sv1", "hd1", "gv1")).toThrow(
      "GVHD",
    );
    db.committees[0].members[0].lecturerId = "gv1";
    expect(() => validateAssignment(db, "dot1", "sv1", "hd1", "gv7")).toThrow(
      "GVHD",
    );
    db.committees.push({
      id: "other",
      termId: "dot1",
      name: "Khác",
      room: "Khác",
      members: [
        { lecturerId: "gv1", role: "CHAIR" },
        { lecturerId: "gv7", role: "SECRETARY" },
        { lecturerId: "gv3", role: "MEMBER" },
      ],
    });
    db.committees[0].members[0].lecturerId = "gv4";
    expect(() => validateAssignment(db, "dot1", "sv1", "hd1", "gv7")).toThrow(
      "GVPB thuộc hội đồng",
    );
  });
  it("validates member count, distinct lecturers and exactly one chair and secretary", () => {
    login("khoa");
    const committee = readDb().committees[0];
    expect(() =>
      saveCommittee({
        ...committee,
        id: "",
        members: committee.members.slice(0, 2),
      }),
    ).toThrow("3 đến 5");
    expect(() =>
      saveCommittee({
        ...committee,
        members: committee.members.map((m) => ({ ...m, lecturerId: "gv4" })),
      }),
    ).toThrow("khác nhau");
    expect(() =>
      saveCommittee({
        ...committee,
        members: committee.members.map((m) => ({ ...m, role: "MEMBER" })),
      }),
    ).toThrow("chủ tịch");
  });
  it("requires eligibility and faculty authorization, then publishes each assignment once", () => {
    login("khoa");
    expect(() => assignReviewer("dot1", "sv1", "hd1", "gv7")).toThrow(
      "chưa đủ điều kiện",
    );
    ready();
    login("gv1");
    expect(() => assignReviewer("dot1", "sv1", "hd1", "gv7")).toThrow("quyền");
    login("khoa");
    assignReviewer("dot1", "sv1", "hd1", "gv7");
    expect(readDb().defenses[0].reviewerPublished).toBe(false);
    publishReviewerAssignments("dot1");
    const count = readDb().notifications.length;
    expect(readDb().defenses[0].reviewerPublished).toBe(true);
    expect(() => publishReviewerAssignments("dot1")).toThrow(
      "Không có phân công",
    );
    expect(readDb().notifications).toHaveLength(count);
  });
});
describe("defense schedule", () => {
  it("detects both room and lecturer conflicts, allowing an adjacent time slot", () => {
    const db = readDb();
    db.defenses = [defense()];
    const other = { ...defense("sv2"), start: "08:15", end: "08:45" };
    expect(scheduleConflicts(db, other)).toHaveLength(2);
    other.room = "B-202";
    expect(scheduleConflicts(db, other)).toHaveLength(1);
    other.start = "08:30";
    other.end = "09:00";
    expect(scheduleConflicts(db, other)).toHaveLength(0);
  });
  it("saves a draft, rejects invalid times, then publishes with notifications", () => {
    ready();
    login("khoa");
    const db = readDb();
    db.defenses = [{ ...defense(), date: "", start: "", end: "" }];
    persist(db);
    expect(() =>
      saveSchedule({ ...defense(), start: "09:00", end: "08:00" }),
    ).toThrow("không hợp lệ");
    saveSchedule(defense());
    expect(readDb().defenses[0].schedulePublished).toBe(false);
    publishDefenseSchedule("dot1");
    expect(readDb().defenses[0].schedulePublished).toBe(true);
    expect(
      readDb().notifications.some(
        (n) => n.userId === "sv1" && n.title === "Lịch bảo vệ chính thức",
      ),
    ).toBe(true);
  });
  it("sorts by given name plus family name within a session and preserves time slots", () => {
    login("khoa");
    const db = readDb();
    db.students[0].name = "Nguyễn Văn Bình";
    db.students[1].name = "Trần Ngọc An";
    db.defenses = [
      defense(),
      { ...defense("sv2"), start: "08:30", end: "09:00", order: 2 },
    ];
    persist(db);
    sortDefenseOrder("dot1");
    const items = readDb().defenses;
    expect(items.find((d) => d.studentId === "sv2")).toMatchObject({
      order: 1,
      start: "08:00",
      end: "08:30",
      schedulePublished: false,
    });
    expect(items.find((d) => d.studentId === "sv1")).toMatchObject({
      order: 2,
      start: "08:30",
      end: "09:00",
    });
  });
});
describe("deferment after review and linked continuation", () => {
  it("requires reviewer consent and an application before faculty can approve, preserving only references", () => {
    ready();
    const db = readDb();
    db.defenses = [defense()];
    db.scores = [
      {
        id: "review-1",
        termId: "dot1",
        studentId: "sv1",
        lecturerId: "gv7",
        kind: "REVIEWER",
        values: {},
        total: 7.5,
        comment: "Đã đọc duyệt và đồng ý",
        questions: ["Câu 1?", "Câu 2?"],
        status: "SUBMITTED",
        updatedAt: "2026-10-22",
      },
    ];
    persist(db);
    login("sv1");
    requestDeferment(
      "dot1",
      "sv1",
      "Sức khỏe cần điều trị và xin tiếp tục đợt sau",
      "AFTER_REVIEW",
    );
    const id = readDb().deferments[0].id;
    login("khoa");
    expect(() => decideDeferment(id, "APPROVED", "Đồng ý bảo lưu")).toThrow(
      "GVPB đồng ý",
    );
    login("gv6");
    expect(() =>
      confirmDefermentReview(id, true, "Đồng ý với nguyện vọng"),
    ).toThrow("không phải GVPB");
    login("gv7");
    confirmDefermentReview(id, true, "Đồng ý bảo lưu, giữ hồ sơ đã đọc duyệt");
    expect(readDb().deferments[0].stage).toBe("GVPB_DONG_Y");
    login("sv1");
    submitDefermentApplication(id);
    login("khoa");
    decideDeferment(id, "APPROVED", "Khoa đồng ý bảo lưu theo nguyện vọng");
    expect(readDb().defenses).toHaveLength(0);
    expect(eligibilityFor(readDb(), "dot1", "sv1").eligible).toBe(false);
    resumeDeferment(id, "dot2");
    const result = readDb();
    expect(result.deferments[0]).toMatchObject({
      stage: "DA_TIEP_TUC",
      carryOverTermId: "dot2",
      reviewerScoreId: "review-1",
      reviewerScore: 7.5,
    });
    expect(
      result.topics.find((t) => t.termId === "dot2" && t.studentId === "sv1"),
    ).toMatchObject({ status: "DRAFT", advisorAgreed: false });
    expect(
      result.topics.find((t) => t.termId === "dot1" && t.studentId === "sv1")
        ?.status,
    ).toBe("APPROVED");
    expect(result.scores.filter((s) => s.termId === "dot2")).toHaveLength(0);
  });
});
