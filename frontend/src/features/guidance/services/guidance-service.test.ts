import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  persist,
  readDb,
  resetDemo,
  SESSION_KEY,
} from "../../../shared/data/store";
import type { StoredFile, Task } from "../../../shared/data/types";
import {
  defenseReadiness,
  guidanceService,
  guidanceStudents,
  isOverdue,
  validatePdf,
} from "./guidance-service";

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
    clear: () => values.clear(),
  };
}
const report: StoredFile = {
  name: "bao-cao-tuan.txt",
  size: 25,
  type: "text/plain",
  dataUrl: "data:text/plain,Noi%20dung%20bao%20cao",
};
const source: StoredFile = {
  name: "Source code",
  size: 0,
  type: "text/uri-list",
  url: "https://github.com/example/thesis",
};
const pdf: StoredFile = {
  name: "do-an.pdf",
  size: 40,
  type: "application/pdf",
  dataUrl:
    "data:application/pdf;base64," +
    btoa("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"),
};
const taskInput = {
  week: 4,
  title: "Xây dựng chức năng",
  description: "Báo cáo và mã nguồn chức năng",
  deadline: "2026-10-30",
};

function login(id: string) {
  const db = readDb();
  const account = db.accounts.find((a) => a.id === id)!;
  account.mustChangePassword = false;
  persist(db);
  sessionStorage.setItem(SESSION_KEY, id);
}
function remainingTask(): Task {
  return readDb().tasks.find((t) => t.studentId === "sv1" && t.week === 3)!;
}
function completeTasks() {
  const db = readDb();
  db.tasks
    .filter((t) => t.studentId === "sv1" && t.termId === "dot1")
    .forEach((t) => {
      t.progress = 100;
      t.submissions = [
        {
          id: `done-${t.id}`,
          at: new Date().toISOString(),
          content: "Hoàn thành",
          files: [report, source],
          status: "PASS",
          feedback: "Đạt yêu cầu",
        },
      ];
    });
  persist(db);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T03:00:00Z"));
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  resetDemo();
  // These inactive post-step-3 unit fixtures must not depend on the active registration-demo seed state.
  const db = readDb();
  const topic = db.topics.find(
    (t) => t.termId === "dot1" && t.studentId === "sv1",
  )!;
  topic.status = "APPROVED";
  topic.advisorAgreed = true;
  persist(db);
});

describe("guidance authorization and prerequisites", () => {
  it("allows the assigned advisor to create a task and notifies the correct student", () => {
    login("gv1");
    const task = guidanceService.saveTask("dot1", "sv1", taskInput);
    expect(task.lecturerId).toBe("gv1");
    expect(readDb().notifications[0]).toMatchObject({
      userId: "sv1",
      termId: "dot1",
    });
  });
  it("rejects a lecturer acting on another advisor’s student without persisting a task", () => {
    login("gv2");
    const count = readDb().tasks.length;
    expect(() => guidanceService.saveTask("dot1", "sv1", taskInput)).toThrow(
      "Chỉ GVHD",
    );
    expect(readDb().tasks).toHaveLength(count);
  });
  it("blocks assignments until the proposal is approved by the review workflow", () => {
    login("gv1");
    expect(() => guidanceService.saveTask("dot1", "sv4", taskInput)).toThrow(
      "Đề cương",
    );
  });
  it("isolates student and lecturer lists by published assignments and term", () => {
    const db = readDb();
    const lecturer = db.accounts.find((a) => a.id === "gv1")!;
    expect(
      guidanceStudents(db, "dot1", lecturer).every((s) =>
        db.assignments.some(
          (a) => a.studentId === s.id && a.lecturerId === "gv1" && a.published,
        ),
      ),
    ).toBe(true);
    db.terms.find((t) => t.id === "dot2")!.studentIds = [];
    expect(guidanceStudents(db, "dot2", lecturer)).toEqual([]);
    expect(
      guidanceStudents(
        db,
        "dot1",
        db.accounts.find((a) => a.id === "sv1"),
      ),
    ).toHaveLength(1);
  });
  it("blocks writes to a locked term, including a legitimate advisor", () => {
    login("gv1");
    const db = readDb();
    db.terms[0].locked = true;
    persist(db);
    expect(() =>
      guidanceService.savePlan("dot1", "sv1", {
        content: "Kế hoạch",
        milestones: "Mốc tuần 4",
      }),
    ).toThrow("Đợt đã khóa");
  });
});

describe("weekly submissions and immutable feedback history", () => {
  it("requires both the weekly report and source code", () => {
    login("sv1");
    expect(() =>
      guidanceService.submitTask(remainingTask().id, {
        content: "Hoàn thành công việc được giao",
        progress: 100,
        files: [report],
      }),
    ).toThrow("mã nguồn");
    expect(remainingTask().submissions).toHaveLength(0);
  });
  it("rejects unsafe repository protocols", () => {
    login("sv1");
    expect(() =>
      guidanceService.submitTask(remainingTask().id, {
        content: "Hoàn thành công việc được giao",
        progress: 100,
        files: [report, { ...source, url: "javascript:alert(1)" }],
      }),
    ).toThrow("http://");
  });
  it("stores a complete submission, lets only its advisor review, and preserves resubmissions", () => {
    login("sv1");
    const id = remainingTask().id;
    guidanceService.submitTask(id, {
      content: "Hoàn thành công việc được giao",
      progress: 100,
      files: [report, source],
    });
    const firstId = remainingTask().submissions[0].id;
    login("gv2");
    expect(() =>
      guidanceService.reviewTask(id, firstId, "PASS", "Đạt yêu cầu"),
    ).toThrow("Chỉ GVHD");
    login("gv1");
    guidanceService.reviewTask(
      id,
      firstId,
      "REVISION",
      "Bổ sung tài liệu kiểm thử",
    );
    login("sv1");
    guidanceService.submitTask(id, {
      content: "Đã bổ sung tài liệu kiểm thử",
      progress: 100,
      files: [report, source],
    });
    expect(remainingTask().submissions).toHaveLength(2);
    expect(remainingTask().submissions[0]).toMatchObject({
      status: "REVISION",
      feedback: "Bổ sung tài liệu kiểm thử",
    });
    login("gv1");
    expect(() =>
      guidanceService.reviewTask(id, firstId, "PASS", "Đạt yêu cầu"),
    ).toThrow("lần nộp mới nhất");
  });
  it("uses the actual Vietnam end of day and blocks late submission until extended", () => {
    expect(isOverdue("2026-10-22")).toBe(false);
    vi.setSystemTime(new Date("2026-10-22T17:00:00Z"));
    expect(isOverdue("2026-10-22")).toBe(true);
    login("sv1");
    expect(() =>
      guidanceService.submitTask(remainingTask().id, {
        content: "Hoàn thành công việc được giao",
        progress: 100,
        files: [report, source],
      }),
    ).toThrow("hết hạn");
    login("gv1");
    const task = remainingTask();
    guidanceService.saveTask(
      "dot1",
      "sv1",
      { ...taskInput, week: task.week },
      task.id,
    );
    login("sv1");
    expect(() =>
      guidanceService.submitTask(task.id, {
        content: "Hoàn thành công việc được giao",
        progress: 100,
        files: [report, source],
      }),
    ).not.toThrow();
  });
  it("does not delete tasks with existing submission history", () => {
    login("gv1");
    expect(() =>
      guidanceService.deleteTask(
        readDb().tasks.find((t) => t.studentId === "sv1" && t.week === 1)!.id,
      ),
    ).toThrow("không thể xóa");
  });
});

describe("PDF versions and advisor confirmation", () => {
  it("accepts a PDF signature and rejects renamed or incorrectly typed files", () => {
    expect(() => validatePdf(pdf)).not.toThrow();
    expect(() => validatePdf({ ...pdf, type: "text/plain" })).toThrow("MIME");
    expect(() =>
      validatePdf({
        ...pdf,
        dataUrl: "data:application/pdf;base64," + btoa("renamed text file"),
      }),
    ).toThrow("%PDF-");
  });
  it("preserves the previous PDF version and requires all readiness gates before confirmation", () => {
    login("sv1");
    guidanceService.submitFinal("dot1", "sv1", pdf);
    guidanceService.submitFinal("dot1", "sv1", {
      ...pdf,
      name: "do-an-v2.pdf",
    });
    expect(
      readDb().finals.find((f) => f.studentId === "sv1")!.revisions,
    ).toHaveLength(1);
    login("gv1");
    expect(() =>
      guidanceService.confirmDefense(
        "dot1",
        "sv1",
        true,
        "Đồ án đủ điều kiện bảo vệ",
      ),
    ).toThrow("nhiệm vụ");
    completeTasks();
    guidanceService.confirmDefense(
      "dot1",
      "sv1",
      true,
      "Đồ án đủ điều kiện bảo vệ",
    );
    expect(readDb().finals.find((f) => f.studentId === "sv1")!.confirmed).toBe(
      true,
    );
    login("sv1");
    expect(() => guidanceService.submitFinal("dot1", "sv1", pdf)).toThrow(
      "đã xác nhận",
    );
  });
  it("checks the weekly passing rate independently from reviewed completion and respects deferment", () => {
    login("sv1");
    guidanceService.submitFinal("dot1", "sv1", pdf);
    completeTasks();
    let db = readDb();
    const tasks = db.tasks.filter((t) => t.studentId === "sv1");
    tasks[0].submissions[0].status = "FAIL";
    persist(db);
    const readiness = defenseReadiness(readDb(), "dot1", "sv1");
    expect(readiness.completed).toBe(readiness.tasks.length);
    expect(readiness.eligible).toBe(false);
    db = readDb();
    db.terms[0].parameters.min_weekly_pass_rate = 0.6;
    persist(db);
    expect(defenseReadiness(readDb(), "dot1", "sv1").eligible).toBe(true);
    db = readDb();
    db.deferments.push({
      id: "defer-test",
      termId: "dot1",
      studentId: "sv1",
      reason: "Lý do sức khỏe",
      status: "APPROVED",
      decision: "Đồng ý",
    });
    persist(db);
    expect(defenseReadiness(readDb(), "dot1", "sv1").eligible).toBe(false);
  });
});
