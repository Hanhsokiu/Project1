import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  persist,
  readDb,
  resetDemo,
  SESSION_KEY,
} from "../../../shared/data/store";
import type { DemoDb, Score } from "../../../shared/data/types";
import {
  aggregateResult,
  canScore,
  lockResults,
  publishResults,
  saveRubric,
  saveScore,
} from "./grading-service";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, String(v)),
    removeItem: (k: string) => values.delete(k),
  };
}
function login(id: string) {
  const db = readDb();
  db.accounts.find((a) => a.id === id)!.mustChangePassword = false;
  persist(db);
  sessionStorage.setItem(SESSION_KEY, id);
}
function score(
  kind: Score["kind"],
  lecturerId: string,
  total: number,
  status: Score["status"] = "SUBMITTED",
): Score {
  return {
    id: `${kind}-${lecturerId}`,
    termId: "dot1",
    studentId: "sv1",
    lecturerId,
    kind,
    values: {},
    total,
    comment: "Nhận xét đầy đủ",
    questions: ["Câu hỏi một", "Câu hỏi hai"],
    status,
    updatedAt: "2026-10-22",
  };
}
function complete(db: DemoDb) {
  db.scores = [
    score("ADVISOR", "gv1", 9),
    score("REVIEWER", "gv7", 7),
    score("COMMITTEE", "gv4", 7.5),
    score("COMMITTEE", "gv5", 8),
    score("COMMITTEE", "gv6", 8.5),
    score("COMMITTEE", "gv8", 9),
  ];
}
beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  resetDemo();
  const db = readDb();
  db.terms[0].locked = false;
  db.terms[0].resultsPublished = false;
  db.scores = [];
  db.committees[0].members = [
    { lecturerId: "gv4", role: "CHAIR" },
    { lecturerId: "gv5", role: "SECRETARY" },
    { lecturerId: "gv6", role: "MEMBER" },
    { lecturerId: "gv8", role: "MEMBER" },
  ];
  db.defenses = [
    {
      id: "defense1",
      termId: "dot1",
      studentId: "sv1",
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
    },
  ];
  persist(db);
});
describe("grading actor authorization and validation", () => {
  it("limits each role to the actual advisor, reviewer or assigned committee member", () => {
    const db = readDb();
    expect(
      canScore(
        db,
        db.accounts.find((a) => a.id === "gv1"),
        "dot1",
        "sv1",
        "ADVISOR",
      ),
    ).toBe(true);
    expect(
      canScore(
        db,
        db.accounts.find((a) => a.id === "gv2"),
        "dot1",
        "sv1",
        "ADVISOR",
      ),
    ).toBe(false);
    expect(
      canScore(
        db,
        db.accounts.find((a) => a.id === "khoa"),
        "dot1",
        "sv1",
        "COMMITTEE",
      ),
    ).toBe(false);
    expect(
      canScore(
        db,
        db.accounts.find((a) => a.id === "gv4"),
        "dot1",
        "sv1",
        "COMMITTEE",
      ),
    ).toBe(true);
    db.defenses[0].schedulePublished = false;
    expect(
      canScore(
        db,
        db.accounts.find((a) => a.id === "gv4"),
        "dot1",
        "sv1",
        "COMMITTEE",
      ),
    ).toBe(false);
  });
  it("rejects scores beyond rubric maxima and requires two reviewer questions to submit", () => {
    login("gv7");
    const input = {
      termId: "dot1",
      studentId: "sv1",
      kind: "REVIEWER" as const,
      values: { format: 2, content: 3, practical: 1, complete: 2, mastery: 2 },
      comment: "Đánh giá đầy đủ theo mẫu",
      questions: ["Chỉ một câu hỏi?"],
      submit: true,
    };
    expect(() => saveScore(input)).toThrow("2 câu hỏi");
    expect(() =>
      saveScore({
        ...input,
        values: { ...input.values, format: 2.1 },
        questions: ["Câu 1?", "Câu 2?"],
      }),
    ).toThrow("0 đến 2");
    saveScore({ ...input, submit: false });
    expect(readDb().scores[0].status).toBe("DRAFT");
    saveScore({ ...input, questions: ["Câu 1?", "Câu 2?"] });
    expect(readDb().scores[0].status).toBe("SUBMITTED");
    expect(() => saveScore({ ...input, submit: false })).toThrow(
      "không được sửa",
    );
  });
  it("blocks a lecturer grading another advisor’s student and rejects rubric totals other than ten", () => {
    login("gv2");
    expect(() =>
      saveScore({
        termId: "dot1",
        studentId: "sv1",
        kind: "ADVISOR",
        values: {},
        comment: "",
        questions: [],
        submit: false,
      }),
    ).toThrow("không được phân công");
    login("khoa");
    expect(() =>
      saveRubric("ADVISOR", [{ id: "x", name: "Tiêu chí", max: 9 }]),
    ).toThrow("bằng 10");
  });
});
describe("aggregation, locking and publication", () => {
  it("matches the UTC reference calculation at full precision", () => {
    const db = readDb();
    complete(db);
    const result = aggregateResult(db, "dot1", "sv1");
    expect(result.process).toBe(8);
    expect(result.defenseScore).toBe(8.25);
    expect(result.total).toBeCloseTo(8.15, 8);
    expect(result.passed).toBe(true);
  });
  it("reads term weights rather than hardcoding and excludes draft/missing committee scores", () => {
    const db = readDb();
    complete(db);
    db.terms[0].parameters = {
      ...db.terms[0].parameters,
      process_weight: 0.6,
      committee_weight: 0.4,
      advisor_weight_in_process: 0.75,
      reviewer_weight_in_process: 0.25,
    };
    expect(aggregateResult(db, "dot1", "sv1").total).toBeCloseTo(8.4);
    db.scores.find((s) => s.lecturerId === "gv8")!.status = "DRAFT";
    const result = aggregateResult(db, "dot1", "sv1");
    expect(result.complete).toBe(false);
    expect(result.defenseScore).toBeNull();
    expect(result.total).toBeNull();
  });
  it("requires QT and KTHP to pass even when HP exceeds five", () => {
    const db = readDb();
    complete(db);
    db.scores[0].total = 4;
    db.scores[1].total = 4;
    const result = aggregateResult(db, "dot1", "sv1");
    expect(result.total).toBeGreaterThan(5);
    expect(result.passed).toBe(false);
  });
  it("does not include an advisor accidentally assigned to their student’s committee", () => {
    const db = readDb();
    complete(db);
    db.committees[0].members[0].lecturerId = "gv1";
    expect(aggregateResult(db, "dot1", "sv1").complete).toBe(false);
  });
  it("rejects incomplete locking, requires locks to publish and notifies exactly the affected student", () => {
    login("khoa");
    expect(() => lockResults("dot1")).toThrow("thiếu phiếu");
    const db = readDb();
    complete(db);
    persist(db);
    expect(() => publishResults("dot1")).toThrow("chốt đầy đủ");
    lockResults("dot1");
    expect(readDb().scores.every((s) => s.status === "LOCKED")).toBe(true);
    publishResults("dot1");
    expect(readDb().terms[0].resultsPublished).toBe(true);
    expect(readDb().notifications[0].userId).toBe("sv1");
    expect(() => publishResults("dot1")).toThrow("công bố");
  });
});
