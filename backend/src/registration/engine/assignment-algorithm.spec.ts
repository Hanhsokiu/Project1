import { describe, it, expect } from "vitest";
import {
  runAssignmentAlgorithm as run,
  RegistrationInput,
  LecturerCapacity,
} from "./assignment-algorithm";
const reg = (
  id: string,
  gpa: number | null,
  prefs: string[],
  extra: Partial<RegistrationInput> = {},
): RegistrationInput => ({
  registrationId: id,
  studentId: id,
  studentCode: id,
  gpa,
  directionId: "D",
  submittedAt: "2026-10-25T00:00:00.000Z",
  preferences: prefs.map((lecturerId, i) => ({ lecturerId, order: i + 1 })),
  ...extra,
});
const cap = (
  id: string,
  quota = 1,
  currentCount = 0,
  extra: Partial<LecturerCapacity> = {},
): LecturerCapacity => ({
  lecturerId: id,
  lecturerCode: id,
  quota,
  currentCount,
  directionIds: ["D"],
  active: true,
  ...extra,
});
describe("assignment rounds and implementation tie breakers", () => {
  it("all NV1 precede NV2: A→X C→Y B stays unassigned", () => {
    const rows = run(
      [reg("A", 4, ["X"]), reg("B", 3.8, ["X", "Y"]), reg("C", 3, ["Y"])],
      [cap("X"), cap("Y")],
    );
    expect(rows.map((r) => [r.registrationId, r.assignedLecturerId])).toEqual([
      ["A", "X"],
      ["B", null],
      ["C", "Y"],
    ]);
    expect(rows[1].reason).toContain("Chưa phân");
  });
  it("B falls back to Z only after all preference rounds", () => {
    const rows = run(
      [reg("A", 4, ["X"]), reg("B", 3.8, ["X", "Y"]), reg("C", 3, ["Y"])],
      [cap("X"), cap("Y"), cap("Z")],
    );
    expect(rows.map((r) => [r.assignedLecturerId, r.preference])).toEqual([
      ["X", 1],
      ["Z", 4],
      ["Y", 1],
    ]);
  });
  it("NV2 and NV3 are evaluated in order, including existing loads", () => {
    const rows = run(
      [reg("A", 4, ["X", "Y"]), reg("B", 3, ["X", "Y", "Z"])],
      [cap("X", 1, 1), cap("Y"), cap("Z")],
    );
    expect(rows.map((r) => [r.assignedLecturerId, r.preference])).toEqual([
      ["Y", 2],
      ["Z", 3],
    ]);
  });
  it("equal GPA uses earlier valid submission, then student code independent of input order", () => {
    const rows = [
      reg("C", 3, ["X"]),
      reg("B", 3, ["X"]),
      reg("A", 3, ["X"], { submittedAt: "2026-10-25T01:00:00.000Z" }),
    ];
    expect(
      run(rows, [cap("X")]).find((r) => r.assignedLecturerId)?.registrationId,
    ).toBe("B");
    expect(run([...rows].reverse(), [cap("X")])).toEqual(run(rows, [cap("X")]));
  });
  it("null GPA requires data correction; never silently treated as zero", () => {
    const r = run([reg("A", null, ["X"])], [cap("X")])[0];
    expect(r.assignedLecturerId).toBeNull();
    expect(r.reason).toContain("GPA");
  });
  it("wrong direction, inactive lecturer, zero quota, full quota never receive students", () => {
    const caps = [
      cap("W", 1, 0, { directionIds: ["OTHER"] }),
      cap("I", 1, 0, { active: false }),
      cap("Q", 0),
      cap("F", 1, 1),
    ];
    expect(
      run([reg("A", 4, ["W", "I", "Q"])], caps)[0].assignedLecturerId,
    ).toBeNull();
  });
  it("fallback minimizes load/quota, then lecturer code, without mutating capacities", () => {
    const caps = [cap("B", 4, 1), cap("A", 4, 1), cap("C", 2, 1)];
    const before = structuredClone(caps);
    expect(run([reg("S", 3, [])], caps)[0].assignedLecturerId).toBe("A");
    expect(caps).toEqual(before);
  });
  it("never guesses a missing direction", () => {
    expect(
      run([reg("S", 3, ["X"], { directionId: undefined })], [cap("X")])[0]
        .assignedLecturerId,
    ).toBeNull();
  });
});
