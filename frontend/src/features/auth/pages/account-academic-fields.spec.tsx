import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountAcademicFields } from "./account-academic-fields";
import type { DemoDb } from "../../../shared/data/types";
const catalogs = [
  { id: "system", kind: "program", name: "Chính quy", active: true },
  { id: "other", kind: "program", name: "Vừa học vừa làm", active: true },
  { id: "dep", kind: "department", name: "Công nghệ phần mềm", active: true },
  { id: "area", kind: "direction", name: "Trí tuệ nhân tạo", active: true },
];
const db = {
  catalogs,
  students: [
    { program: "Chính quy", className: "CNPM-01" },
    { program: "Vừa học vừa làm", className: "OTHER-01" },
  ],
} as unknown as Pick<DemoDb, "catalogs" | "students">;
const base = { username: "test", name: "Thử nghiệm", email: "", phone: "" };
describe("role-specific account form", () => {
  it("places system before major and class, and only suggests classes from the selected system", () => {
    const html = renderToStaticMarkup(
      <AccountAcademicFields
        form={{ ...base, roles: ["STUDENT"], trainingSystemId: "system" }}
        db={db}
        onChange={() => {}}
      />,
    );
    expect(html.indexOf('aria-label="Hệ đào tạo"')).toBeLessThan(
      html.indexOf('aria-label="Ngành học"'),
    );
    expect(html.indexOf('aria-label="Ngành học"')).toBeLessThan(
      html.indexOf('aria-label="Lớp"'),
    );
    expect(html).toContain('<option value="CNPM-01"');
    expect(html).not.toContain("OTHER-01");
    expect(html).not.toContain("Hồ sơ giảng viên");
  });
  it("shows lecturer department, default load and selected teaching specialties", () => {
    const html = renderToStaticMarkup(
      <AccountAcademicFields
        form={{
          ...base,
          roles: ["LECTURER"],
          departmentId: "dep",
          researchAreaIds: ["area"],
          maxStudents: 7,
        }}
        db={db}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Bộ môn"');
    expect(html).toContain('value="7"');
    expect(html).toContain("Hướng chuyên môn có thể hướng dẫn");
    expect(html).toContain('checked=""');
    expect(html).not.toContain("Hồ sơ sinh viên");
  });
  it("shows both profiles for multiple roles and disables class until a system is selected", () => {
    const html = renderToStaticMarkup(
      <AccountAcademicFields
        form={{ ...base, roles: ["STUDENT", "LECTURER"] }}
        db={db}
        onChange={() => {}}
      />,
    );
    expect(html).toContain("Hồ sơ sinh viên");
    expect(html).toContain("Hồ sơ giảng viên");
    expect(html).toMatch(/aria-label="Lớp"[^>]*disabled=""/);
  });
});
