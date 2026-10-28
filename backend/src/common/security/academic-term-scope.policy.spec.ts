import { describe, expect, it } from "vitest";
import { academicTermScope } from "./academic-term-scope.policy";

describe("AcademicTermGrant scope", () => {
  const grant = {
    userId: "user",
    termId: "term",
    allDepartments: false,
    pr2bGrantDepartmentGrantId: [{ departmentId: "department" }],
  };
  it("does not infer a scope from missing grants", () => {
    expect(academicTermScope([], "user", "term").configured).toBe(false);
  });
  it("ignores grants for a different actor or term", () => {
    expect(
      academicTermScope([grant], "other-user", "term").contains("department"),
    ).toBe(false);
    expect(academicTermScope([grant], "user", "other-term").configured).toBe(
      false,
    );
  });
  it("requires an exact department for partial grants", () => {
    const scope = academicTermScope([grant], "user", "term");
    expect(scope.contains("department")).toBe(true);
    expect(scope.contains("other")).toBe(false);
    expect(scope.contains(null)).toBe(false);
    expect(scope.allDepartments).toBe(false);
  });
  it("allows whole-term operations only for allDepartments grants", () => {
    const scope = academicTermScope(
      [{ ...grant, allDepartments: true }],
      "user",
      "term",
    );
    expect(scope.allDepartments).toBe(true);
    expect(scope.contains(null)).toBe(true);
  });
});
