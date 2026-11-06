import { describe, it, expect } from "vitest";
import { AssignmentValidator as V } from "./assignment.validator";
import { AssignmentRegistration } from "../repository/assignment.repository";
import { LoadedTerm } from "../../term/repository/term.repository";
const term = {
  trainingSystemId: "SYS",
  termStudents: [{ studentId: "S" }],
  parameters: [],
} as unknown as LoadedTerm;
function reg(gpa: number | null) {
  return {
    status: "SUBMITTED",
    submittedAt: new Date(),
    student: {
      id: "S",
      isActive: true,
      academicEligible: true,
      trainingSystemId: "SYS",
      gpa,
    },
    direction: { isActive: true },
    preferences: [{ preferenceOrder: 1 }],
  } as unknown as AssignmentRegistration;
}
describe("assignment data issue reporting", () => {
  it("accepts current submitted registration with eligible GPA and roster", () => {
    expect(V.issue(reg(3.5), term)).toBe("");
  });
  it("returns actionable GPA error for null instead of treating it as zero or a generic HTTP exception", () => {
    expect(V.issue(reg(null), term)).toContain("GPA");
    expect(V.issue(reg(null), term)).toContain("thiếu");
  });
});
