import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentUser,
  persist,
  readDb,
  resetDemo,
  SESSION_KEY,
} from "../../../shared/data/store";
import type { DemoDb, Topic } from "../../../shared/data/types";
import {
  exportExcel,
  exportPdf,
} from "../../../shared/services/export-service";
import {
  allowedReportKinds,
  buildReport,
  createReport,
} from "./report-service";
vi.mock("../../../shared/services/export-service", () => ({
  exportExcel: vi.fn().mockResolvedValue(undefined),
  exportPdf: vi.fn().mockResolvedValue(undefined),
}));
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  };
}
function login(id: string) {
  const db = readDb();
  db.accounts.find((a) => a.id === id)!.mustChangePassword = false;
  persist(db);
  sessionStorage.setItem(SESSION_KEY, id);
  return currentUser()!;
}
function topic(
  studentId: string,
  lecturerId: string,
  directionId: string,
): Topic {
  return {
    id: `topic-${studentId}`,
    termId: "dot1",
    studentId,
    lecturerId,
    directionId,
    title: `Đề tài của ${studentId}`,
    advisorAgreed: true,
    status: "SUBMITTED",
    objectives: "Mục tiêu nghiên cứu và triển khai hệ thống",
    scope: "Ứng dụng web trong phạm vi Khoa",
    technology: "React, TypeScript",
    expected: "Ứng dụng và báo cáo",
    plan: [{ week: "1–3", content: "Khảo sát và phân tích" }],
    versions: [],
    groupId: "",
    comment: "",
  };
}
function fixture(db: DemoDb) {
  db.terms[0].assignmentPublished = true;
  db.terms[0].studentIds = ["sv1", "sv2", "sv3"];
  db.exports = [];
  db.assignments = [
    {
      id: "a1",
      termId: "dot1",
      studentId: "sv1",
      lecturerId: "gv1",
      published: true,
      manual: false,
      preference: 1,
      reason: "",
    },
    {
      id: "a2",
      termId: "dot1",
      studentId: "sv2",
      lecturerId: "gv2",
      published: true,
      manual: false,
      preference: 2,
      reason: "",
    },
  ];
  db.registrations = [
    {
      id: "r1",
      termId: "dot1",
      studentId: "sv1",
      directionId: "h1",
      preferences: ["gv1"],
      note: "",
      status: "SUBMITTED",
      updatedAt: "2026-10-22",
    },
    {
      id: "r2",
      termId: "dot1",
      studentId: "sv2",
      directionId: "h2",
      preferences: ["gv2"],
      note: "",
      status: "DRAFT",
      updatedAt: "2026-10-22",
    },
  ];
  db.topics = [topic("sv1", "gv1", "h1"), topic("sv2", "gv2", "h2")];
}
beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  resetDemo();
  const db = readDb();
  fixture(db);
  persist(db);
  vi.mocked(exportPdf).mockReset().mockResolvedValue(undefined);
  vi.mocked(exportExcel).mockReset().mockResolvedValue(undefined);
});
describe("Bước 1–3 report ownership and filters", () => {
  it("gives managers the full report set and restricts lecturers to officially assigned students", () => {
    const db = readDb();
    const manager = db.accounts.find((a) => a.id === "khoa")!;
    const lecturer = db.accounts.find((a) => a.id === "gv1")!;
    expect(allowedReportKinds(manager)).toHaveLength(7);
    expect(buildReport(db, manager, "dot1", "STUDENTS").rows).toHaveLength(3);
    const own = buildReport(db, lecturer, "dot1", "STUDENTS");
    expect(own.rows).toHaveLength(1);
    expect(own.rows[0]["Mã sinh viên"]).toBe(db.students[0].code);
    expect(() => buildReport(db, lecturer, "dot1", "REGISTRATIONS")).toThrow(
      "quyền",
    );
  });
  it("allows a student only their own published assignment and proposal, never the whole catalog", () => {
    const db = readDb();
    const student = db.accounts.find((a) => a.id === "sv1")!;
    expect(allowedReportKinds(student)).toEqual(["ASSIGNMENTS", "PROPOSAL"]);
    expect(buildReport(db, student, "dot1", "ASSIGNMENTS").rows).toHaveLength(
      1,
    );
    const report = buildReport(db, student, "dot1", "PROPOSAL");
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]["Đề tài"]).toBe("Đề tài của sv1");
    expect(() => buildReport(db, student, "dot1", "STUDENTS")).toThrow("quyền");
    expect(
      buildReport(db, student, "dot1", "PROPOSAL", { studentId: "sv2" }).rows,
    ).toHaveLength(0);
  });
  it("does not reveal assignments or proposals before both term and individual publication", () => {
    const db = readDb();
    const student = db.accounts.find((a) => a.id === "sv1")!;
    db.terms[0].assignmentPublished = false;
    expect(buildReport(db, student, "dot1", "ASSIGNMENTS").rows).toHaveLength(
      0,
    );
    expect(buildReport(db, student, "dot1", "PROPOSAL").rows).toHaveLength(0);
    db.terms[0].assignmentPublished = true;
    db.assignments[0].published = false;
    expect(buildReport(db, student, "dot1", "ASSIGNMENTS").rows).toHaveLength(
      0,
    );
  });
  it("combines term, direction, lecturer and status filters without widening the actor’s scope", () => {
    const db = readDb();
    const manager = db.accounts.find((a) => a.id === "admin")!;
    const lecturer = db.accounts.find((a) => a.id === "gv1")!;
    expect(
      buildReport(db, manager, "dot1", "REGISTRATIONS", {
        directionId: "h2",
        lecturerId: "gv2",
        status: "DRAFT",
      }).rows,
    ).toHaveLength(1);
    expect(
      buildReport(db, manager, "dot1", "STUDENTS", { program: "Không khớp" })
        .rows,
    ).toHaveLength(0);
    expect(
      buildReport(db, manager, "dot1", "ASSIGNMENTS", { status: "UNASSIGNED" })
        .rows,
    ).toHaveLength(1);
    expect(
      buildReport(db, lecturer, "dot1", "TOPICS", { lecturerId: "gv2" }).rows,
    ).toHaveLength(0);
    expect(buildReport(db, manager, "dot2", "TOPICS").rows).toHaveLength(0);
  });
  it("builds a degree-specific proposal with the source form fields and signature regions", () => {
    const db = readDb();
    const student = db.accounts.find((a) => a.id === "sv1")!;
    const report = buildReport(db, student, "dot1", "PROPOSAL", {
      degree: "Kỹ sư",
    });
    const text = report.lines.join("\n");
    expect(text).toContain("KỸ SƯ");
    expect(text).toContain("CHƯA PHÊ DUYỆT");
    expect(text).toContain("Mục tiêu nghiên cứu");
    expect(text).toContain("TRƯỞNG KHOA");
    expect(text).toContain("TRƯỞNG BỘ MÔN");
    expect(text).toContain("GIẢNG VIÊN HƯỚNG DẪN");
    expect(text).toContain("SINH VIÊN");
  });
});
describe("export job lifecycle and file adapter boundaries", () => {
  it("persists a pending job before calling the PDF adapter, then completes it with owner and filters", async () => {
    login("khoa");
    vi.mocked(exportPdf).mockImplementation(async () => {
      expect(readDb().exports[0].status).toBe("PENDING");
    });
    await createReport("dot1", "ASSIGNMENTS", "PDF", { directionId: "h1" });
    expect(exportPdf).toHaveBeenCalledWith(
      "Kết quả phân công GVHD",
      expect.any(Array),
      "assignments-dot1.pdf",
    );
    expect(readDb().exports[0]).toMatchObject({
      status: "COMPLETED",
      requestedBy: "khoa",
      reportKind: "ASSIGNMENTS",
      format: "PDF",
      filters: { directionId: "h1" },
    });
    expect(readDb().exports[0].completedAt).toBeTruthy();
  });
  it("uses the XLSX adapter and records failures, allowing a new job to retry the same request", async () => {
    login("admin");
    vi.mocked(exportExcel).mockRejectedValueOnce(
      new Error("Không thể tạo workbook"),
    );
    await expect(createReport("dot1", "STUDENTS", "XLSX")).rejects.toThrow(
      "workbook",
    );
    expect(readDb().exports[0]).toMatchObject({
      status: "FAILED",
      error: "Không thể tạo workbook",
    });
    await createReport("dot1", "STUDENTS", "XLSX");
    expect(readDb().exports[0].status).toBe("COMPLETED");
    expect(readDb().exports).toHaveLength(2);
    expect(exportExcel).toHaveBeenLastCalledWith(
      "Danh sách sinh viên",
      expect.any(Array),
      "students-dot1.xlsx",
    );
  });
  it("does not create a file/job for empty results, unauthorized actors or required password changes", async () => {
    login("sv1");
    await expect(
      createReport("dot1", "PROPOSAL", "PDF", { studentId: "sv2" }),
    ).rejects.toThrow("Không có dữ liệu");
    expect(readDb().exports).toHaveLength(0);
    expect(exportPdf).not.toHaveBeenCalled();
    await expect(createReport("dot1", "REGISTRATIONS", "PDF")).rejects.toThrow(
      "quyền",
    );
    const db = readDb();
    db.accounts.find((a) => a.id === "sv1")!.mustChangePassword = true;
    persist(db);
    await expect(createReport("dot1", "PROPOSAL", "PDF")).rejects.toThrow(
      "đổi mật khẩu",
    );
    expect(readDb().exports).toHaveLength(0);
  });
});
