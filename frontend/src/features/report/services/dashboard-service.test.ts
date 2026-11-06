import { describe, expect, it } from "vitest";
import { createSeed } from "../../../shared/data/seed";
import { dashboardData } from "./dashboard-service";

describe("dashboard view model for steps 1–3", () => {
  it("limits the student dashboard to that student and selected term", () => {
    const db = createSeed();
    const user = db.accounts.find((a) => a.id === "sv1")!;
    const data = dashboardData(db, user, "dot1", "STUDENT");
    expect(data.students.map((s) => s.id)).toEqual(["sv1"]);
    expect(
      data.registrations.every(
        (r) => r.studentId === "sv1" && r.termId === "dot1",
      ),
    ).toBe(true);
    expect(data.notifications.every((n) => n.userId === user.id)).toBe(true);
    db.terms.find((t) => t.id === "dot2")!.studentIds = [];
    expect(dashboardData(db, user, "dot2", "STUDENT").students).toEqual([]);
  });
  it("hides assignments and topic information until assignment publication", () => {
    const db = createSeed();
    const user = db.accounts.find((a) => a.id === "sv1")!;
    db.assignments
      .filter((a) => a.studentId === "sv1")
      .forEach((a) => {
        a.published = false;
      });
    const data = dashboardData(db, user, "dot1", "STUDENT");
    expect(data.assignments).toEqual([]);
    expect(data.topics).toEqual([]);
    expect(data.registrations).toHaveLength(1);
    db.assignments
      .filter((a) => a.studentId === "sv1")
      .forEach((a) => {
        a.published = true;
      });
    db.terms.find((t) => t.id === "dot1")!.assignmentPublished = false;
    expect(dashboardData(db, user, "dot1", "STUDENT").assignments).toEqual([]);
  });
  it("shows only published advisory students to lecturers", () => {
    const db = createSeed();
    const user = db.accounts.find((a) => a.id === "gv1")!;
    const expected = db.assignments
      .filter(
        (a) => a.termId === "dot1" && a.lecturerId === "gv1" && a.published,
      )
      .map((a) => a.studentId)
      .sort();
    const data = dashboardData(db, user, "dot1", "LECTURER");
    expect(data.students.map((s) => s.id).sort()).toEqual(expected);
    expect(data.topics.every((t) => t.lecturerId === "gv1")).toBe(true);
  });
  it("rejects switching into a role not assigned to the account", () => {
    const db = createSeed();
    const user = db.accounts.find((a) => a.id === "sv1")!;
    expect(() => dashboardData(db, user, "dot1", "FACULTY")).toThrow(
      "Không có quyền",
    );
  });
  it("derives faculty totals from the selected term and keeps post-step-3 phases out of dashboard", () => {
    const db = createSeed();
    const user = db.accounts.find((a) => a.id === "khoa")!;
    const data = dashboardData(db, user, "dot1", "FACULTY");
    expect(data.students).toHaveLength(db.terms[0].studentIds.length);
    expect(
      data.phases.every((p) =>
        /đăng ký|phân công|đề cương|đề tài/i.test(p.name),
      ),
    ).toBe(true);
    expect(dashboardData(db, user, "dot2", "FACULTY").registrations).toEqual(
      [],
    );
  });
});
