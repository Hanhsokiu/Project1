import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "../../auth/services/auth-service";
import { topicService } from "../../topic/services/topic-service";
import {
  persist,
  readDb,
  resetDemo,
  SESSION_KEY,
} from "../../../shared/data/store";
import type { DemoDb, Registration } from "../../../shared/data/types";
import {
  buildAssignment,
  registrationService,
  registrationWindow,
} from "./registration-service";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
function login(id: string) {
  const db = readDb();
  db.accounts.find((a) => a.id === id)!.mustChangePassword = false;
  persist(db);
  sessionStorage.setItem(SESSION_KEY, id);
}
function registration(
  studentId: string,
  preferences: string[],
  directionId = "h1",
): Registration {
  return {
    id: `reg-${studentId}`,
    termId: "dot1",
    studentId,
    directionId,
    preferences,
    status: "SUBMITTED",
    note: "",
    updatedAt: "2026-10-22T01:00:00Z",
  };
}
function configure(db: DemoDb) {
  const term = db.terms[0];
  term.status = "OPEN_REGISTRATION";
  term.locked = false;
  term.assignmentPublished = false;
  term.registrationStart = "2026-10-01";
  term.registrationEnd = "2026-10-22";
  term.studentIds = ["sv1", "sv2", "sv3"];
  term.phases[0].locked = false;
  term.lecturers = ["gv1", "gv2", "gv3"].map((lecturerId) => ({
    lecturerId,
    quota: 1,
  }));
  db.students.slice(0, 3).forEach((student, index) => {
    student.program = term.program;
    student.eligible = true;
    student.gpa = 4 - index * 0.5;
  });
  db.lecturers.slice(0, 3).forEach((lecturer) => {
    lecturer.directionIds = ["h1"];
  });
  db.registrations = [];
  db.assignments = [];
  db.topics = [];
  db.notifications = [];
  db.scores = [];
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T03:00:00Z"));
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  resetDemo();
  const db = readDb();
  configure(db);
  persist(db);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("auth and required onboarding", () => {
  it("blocks business mutations until the initial password is changed", () => {
    const db = readDb();
    const student = db.accounts.find((a) => a.id === "sv1")!;
    authService.login(student.username, student.password);
    expect(() =>
      registrationService.save(
        "dot1",
        { directionId: "h1", preferences: ["gv1"], note: "" },
        true,
        student.email,
        student.phone,
      ),
    ).toThrow("đổi mật khẩu");
    authService.changePassword(student.password, "NewPass@2026");
    registrationService.save(
      "dot1",
      { directionId: "h1", preferences: ["gv1"], note: "" },
      true,
      student.email,
      student.phone,
    );
    expect(
      readDb().accounts.find((a) => a.id === "sv1")!.mustChangePassword,
    ).toBe(false);
    expect(readDb().registrations[0].status).toBe("SUBMITTED");
  });
  it("rejects locked accounts and incorrect credentials without opening a session", () => {
    const db = readDb();
    db.accounts.find((a) => a.id === "sv1")!.locked = true;
    persist(db);
    const student = db.accounts.find((a) => a.id === "sv1")!;
    expect(() => authService.login(student.username, student.password)).toThrow(
      "bị khóa",
    );
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(() => authService.login("unknown", "wrong")).toThrow("không đúng");
  });
  it("keeps account and catalog contact details consistent and protects the last admin", () => {
    login("sv1");
    authService.updateProfile(
      "Nguyễn Minh Anh",
      "updated@example.com",
      "0912345678",
    );
    expect(readDb().students[0].email).toBe("updated@example.com");
    expect(readDb().accounts.find((a) => a.id === "sv1")!.phone).toBe(
      "0912345678",
    );
    login("admin");
    const admin = readDb().accounts.find((a) => a.id === "admin")!;
    expect(() =>
      authService.saveAccount({ ...admin, roles: ["FACULTY"] }),
    ).toThrow("cuối cùng");
  });
});

describe("registration deadline, draft and validation", () => {
  it("includes the entire Vietnam deadline date and excludes the next midnight", () => {
    const db = readDb();
    expect(
      registrationWindow(db, "dot1", new Date("2026-10-22T23:59:59.999+07:00")),
    ).toBe("");
    expect(
      registrationWindow(db, "dot1", new Date("2026-10-23T00:00:00+07:00")),
    ).toContain("hết hạn");
    db.terms[0].registrationEnd = "2026-10-22T12:00:00+07:00";
    expect(
      registrationWindow(db, "dot1", new Date("2026-10-22T12:00:00+07:00")),
    ).toContain("hết hạn");
    expect(
      registrationWindow(db, "dot1", new Date("2026-10-01T00:00:00+07:00")),
    ).toBe("");
  });
  it("allows an incomplete draft without corrupting valid contact information", () => {
    login("sv1");
    const previous = readDb().students[0].email;
    registrationService.save(
      "dot1",
      { directionId: "h1", preferences: [], note: "Đang cân nhắc" },
      false,
      "unfinished@",
      "",
    );
    expect(readDb().registrations[0]).toMatchObject({
      studentId: "sv1",
      status: "DRAFT",
      preferences: [],
    });
    expect(readDb().students[0].email).toBe(previous);
    expect(() =>
      registrationService.save(
        "dot1",
        { directionId: "h1", preferences: [], note: "" },
        true,
        "student@example.com",
        "0912345678",
      ),
    ).toThrow("nguyện vọng");
  });
  it("checks contact details, distinct preferences and lecturer expertise on submission", () => {
    login("sv1");
    expect(() =>
      registrationService.save(
        "dot1",
        { directionId: "h1", preferences: ["gv1"], note: "" },
        true,
        "bad",
        "",
      ),
    ).toThrow("Email");
    expect(() =>
      registrationService.save(
        "dot1",
        { directionId: "h1", preferences: ["gv1", "gv1"], note: "" },
        true,
        "s@example.com",
        "0912345678",
      ),
    ).toThrow("trùng");
    expect(() =>
      registrationService.save(
        "dot1",
        { directionId: "h2", preferences: ["gv1"], note: "" },
        true,
        "s@example.com",
        "0912345678",
      ),
    ).toThrow("đúng hướng");
    expect(readDb().registrations).toHaveLength(0);
  });
  it("rechecks current academic eligibility, GPA and program after roster admission", () => {
    login("sv1");
    let db = readDb();
    db.students[0].eligible = false;
    persist(db);
    const save = () =>
      registrationService.save(
        "dot1",
        { directionId: "h1", preferences: ["gv1"], note: "" },
        true,
        "s@example.com",
        "0912345678",
      );
    expect(save).toThrow("học vụ");
    db = readDb();
    db.students[0].eligible = true;
    db.students[0].gpa = 1;
    persist(db);
    expect(save).toThrow("GPA");
    db = readDb();
    db.students[0].gpa = 3;
    db.students[0].program = "Hệ khác";
    persist(db);
    expect(save).toThrow("Hệ đào tạo");
  });
  it("blocks locked phases, unpublished roster access and edits after assignment publication", () => {
    login("sv1");
    let db = readDb();
    db.terms[0].phases[0].locked = true;
    persist(db);
    const save = () =>
      registrationService.save(
        "dot1",
        { directionId: "h1", preferences: ["gv1"], note: "" },
        true,
        "s@example.com",
        "0912345678",
      );
    expect(save).toThrow("khóa");
    db = readDb();
    db.terms[0].phases[0].locked = false;
    db.terms[0].studentIds = [];
    persist(db);
    expect(save).toThrow("danh sách");
    db = readDb();
    db.terms[0].studentIds = ["sv1"];
    db.terms[0].assignmentPublished = true;
    persist(db);
    expect(save).toThrow("công bố");
  });
});

describe("preference rounds, quotas and publication", () => {
  it("completes NV1 for the whole cohort before considering NV2 or automatic fallback", () => {
    const db = readDb();
    db.registrations = [
      registration("sv1", ["gv1", "gv2"]),
      registration("sv2", ["gv1", "gv2"]),
      registration("sv3", ["gv2", "gv3"]),
    ];
    const result = buildAssignment(db, "dot1");
    expect(result.find((a) => a.studentId === "sv1")).toMatchObject({
      lecturerId: "gv1",
      preference: 1,
    });
    expect(result.find((a) => a.studentId === "sv3")).toMatchObject({
      lecturerId: "gv2",
      preference: 1,
    });
    expect(result.find((a) => a.studentId === "sv2")).toMatchObject({
      lecturerId: "gv3",
      preference: 4,
    });
    expect(
      result.every(
        (a) => result.filter((x) => x.lecturerId === a.lecturerId).length <= 1,
      ),
    ).toBe(true);
  });
  it("breaks equal GPA by student code and leaves students unassigned when suitable capacity is exhausted", () => {
    const db = readDb();
    db.students[0].gpa = db.students[1].gpa;
    db.registrations = [
      registration("sv2", ["gv1"]),
      registration("sv1", ["gv1"]),
    ];
    db.registrations[0].updatedAt = "2026-10-01";
    db.terms[0].lecturers = [{ lecturerId: "gv1", quota: 1 }];
    const result = buildAssignment(db, "dot1");
    expect(result).toHaveLength(1);
    expect(result[0].studentId).toBe("sv1");
  });
  it("excludes stale or academically ineligible registrations from the trial plan", () => {
    const db = readDb();
    db.registrations = [
      registration("sv1", ["gv1"]),
      registration("sv2", ["gv2"]),
    ];
    db.students[1].eligible = false;
    expect(buildAssignment(db, "dot1").map((a) => a.studentId)).toEqual([
      "sv1",
    ]);
  });
  it("keeps read-only trials separate from persisted plans and enforces faculty permission", () => {
    const db = readDb();
    db.registrations = [registration("sv1", ["gv1"])];
    persist(db);
    login("sv1");
    expect(() => registrationService.trial("dot1")).toThrow("quyền");
    login("khoa");
    const trial = registrationService.trial("dot1");
    expect(trial).toHaveLength(1);
    expect(readDb().assignments).toHaveLength(0);
    expect(() => registrationService.saveTrial("dot1")).toThrow("đóng đăng ký");
    const closed = readDb();
    closed.terms[0].status = "CLOSED_REGISTRATION";
    persist(closed);
    registrationService.saveTrial("dot1");
    expect(readDb().assignments[0].published).toBe(false);
  });
  it("rejects stale over-quota publication and publishes notifications exactly once", () => {
    const db = readDb();
    db.terms[0].status = "CLOSED_REGISTRATION";
    db.registrations = [registration("sv1", ["gv1"])];
    persist(db);
    login("khoa");
    registrationService.saveTrial("dot1");
    const stale = readDb();
    stale.terms[0].lecturers[0].quota = 0;
    persist(stale);
    expect(() => registrationService.publish("dot1")).toThrow("quota");
    expect(readDb().notifications).toHaveLength(0);
    const fixed = readDb();
    fixed.terms[0].lecturers[0].quota = 1;
    persist(fixed);
    registrationService.publish("dot1");
    expect(readDb().assignments[0].published).toBe(true);
    expect(readDb().notifications).toHaveLength(2);
    expect(() => registrationService.publish("dot1")).toThrow(
      "đã được công bố",
    );
    expect(readDb().notifications).toHaveLength(2);
  });
  it("requires registration closure, an explanation and spare quota for manual assignment", () => {
    const db = readDb();
    db.registrations = [
      registration("sv1", ["gv1"]),
      registration("sv2", ["gv2"]),
    ];
    persist(db);
    login("khoa");
    expect(() =>
      registrationService.adjust("dot1", "sv1", "gv1", "Điều chỉnh hợp lệ"),
    ).toThrow("đóng đăng ký");
    const closed = readDb();
    closed.terms[0].status = "CLOSED_REGISTRATION";
    persist(closed);
    registrationService.saveTrial("dot1");
    expect(() =>
      registrationService.adjust("dot1", "sv1", "gv3", "ngắn"),
    ).toThrow("10 ký tự");
    expect(() =>
      registrationService.adjust(
        "dot1",
        "sv1",
        "gv2",
        "Điều chỉnh theo nguyện vọng",
      ),
    ).toThrow("quota");
    registrationService.adjust(
      "dot1",
      "sv1",
      "gv3",
      "Điều chỉnh theo nguyện vọng",
    );
    expect(
      readDb().assignments.find((a) => a.studentId === "sv1"),
    ).toMatchObject({ lecturerId: "gv3", manual: true });
  });
});

describe("topic agreement, proposal submission and version ownership", () => {
  const proposal = {
    title: "Xây dựng hệ thống quản lý đồ án",
    objectives: "Xây dựng hệ thống quản lý và theo dõi đồ án.",
    scope: "Ứng dụng web quản lý nghiệp vụ trong phạm vi Khoa.",
    technology: "React, TypeScript",
    expected: "Ứng dụng, mã nguồn và báo cáo hoàn chỉnh",
    plan: [{ week: "1–3", content: "Khảo sát và phân tích yêu cầu" }],
  };
  function published() {
    const db = readDb();
    db.terms[0].status = "IN_PROGRESS";
    db.terms[0].assignmentPublished = true;
    db.assignments = [
      {
        id: "assignment1",
        termId: "dot1",
        studentId: "sv1",
        lecturerId: "gv1",
        preference: 1,
        manual: false,
        reason: "",
        published: true,
      },
    ];
    db.registrations = [registration("sv1", ["gv1"])];
    persist(db);
  }
  it("requires a published assignment and the actual advisor’s agreement before submission", () => {
    login("sv1");
    expect(() => topicService.save("dot1", proposal, false)).toThrow(
      "phân công",
    );
    published();
    topicService.save("dot1", proposal, false);
    expect(() => topicService.save("dot1", proposal, true)).toThrow(
      "thống nhất",
    );
    const id = readDb().topics[0].id;
    login("gv2");
    expect(() => topicService.agree(id, true)).toThrow("Chỉ GVHD");
    login("gv1");
    topicService.agree(id, true);
    login("sv1");
    topicService.save("dot1", proposal, true);
    expect(readDb().topics).toHaveLength(1);
    expect(readDb().topics[0]).toMatchObject({
      status: "SUBMITTED",
      advisorAgreed: true,
    });
    expect(readDb().topics[0].versions).toHaveLength(1);
  });
  it("resets agreement when the title changes and preserves submitted versions", () => {
    published();
    login("sv1");
    topicService.save("dot1", proposal, false);
    const id = readDb().topics[0].id;
    login("gv1");
    topicService.agree(id, true);
    login("sv1");
    const changed = {
      ...proposal,
      title: "Xây dựng cổng thông tin quản lý đồ án",
    };
    topicService.save("dot1", changed, false);
    expect(readDb().topics[0].advisorAgreed).toBe(false);
    login("gv1");
    topicService.agree(id, true);
    login("sv1");
    topicService.save("dot1", changed, true);
    const version = structuredClone(readDb().topics[0].versions[0]);
    expect(() => topicService.save("dot1", proposal, false)).toThrow(
      "không thể sửa",
    );
    expect(readDb().topics[0].versions[0]).toEqual(version);
  });
  it("blocks agreement in locked terms and when the advisor’s published assignment is stale", () => {
    published();
    login("sv1");
    topicService.save("dot1", proposal, false);
    const id = readDb().topics[0].id;
    login("gv1");
    let db = readDb();
    db.terms[0].locked = true;
    persist(db);
    expect(() => topicService.agree(id, true)).toThrow("khóa");
    db = readDb();
    db.terms[0].locked = false;
    db.assignments[0].lecturerId = "gv2";
    persist(db);
    expect(() => topicService.agree(id, true)).toThrow("chính thức");
    expect(readDb().topics[0].advisorAgreed).toBe(false);
  });
  it("returns a submitted topic to draft on advisor change while keeping versions and rejecting no-op or approved changes", () => {
    published();
    login("sv1");
    topicService.save("dot1", proposal, false);
    const id = readDb().topics[0].id;
    login("gv1");
    topicService.agree(id, true);
    login("sv1");
    topicService.save("dot1", proposal, true);
    const version = structuredClone(readDb().topics[0].versions[0]);
    login("khoa");
    expect(() =>
      registrationService.adjust(
        "dot1",
        "sv1",
        "gv1",
        "Giữ nguyên người hướng dẫn",
      ),
    ).toThrow("khác giảng viên");
    expect(readDb().topics[0].status).toBe("SUBMITTED");
    registrationService.adjust(
      "dot1",
      "sv1",
      "gv2",
      "Điều chỉnh theo phân công của Bộ môn",
    );
    expect(readDb().topics[0]).toMatchObject({
      lecturerId: "gv2",
      status: "DRAFT",
      advisorAgreed: false,
    });
    expect(readDb().topics[0].versions[0]).toEqual(version);
    login("gv2");
    topicService.agree(id, true);
    expect(readDb().topics[0].advisorAgreed).toBe(true);
    login("khoa");
    const approved = readDb();
    approved.topics[0].status = "APPROVED";
    persist(approved);
    expect(() =>
      registrationService.adjust(
        "dot1",
        "sv1",
        "gv3",
        "Đổi người hướng dẫn sau khi đã duyệt",
      ),
    ).toThrow("duyệt/chốt");
    expect(readDb().assignments[0].lecturerId).toBe("gv2");
  });
});
