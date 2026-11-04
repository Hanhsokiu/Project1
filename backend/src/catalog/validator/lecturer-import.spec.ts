import { describe, expect, it } from "vitest";
import { LecturerImportValidator } from "./lecturer-import.validator";
import { ImportFileParser } from "../service/import-file.parser";

const context = {
  lecturers: [],
  accounts: [],
  departments: [{ id: "dept", code: "CNPM", name: "Công nghệ phần mềm" }],
  areas: [
    {
      id: "area",
      name: "Phần mềm",
      description: null,
      isActive: true,
      createdAt: new Date(),
    },
  ],
};
const raw = {
  lecturerCode: "001GV",
  fullName: "Nguyễn Văn Mẫu",
  departmentCode: "CNPM",
  researchAreas: "Phần mềm",
  maxStudents: "5",
};
const normalize = (values = raw) =>
  LecturerImportValidator.normalize(values, 2);
describe("lecturer import", () => {
  it("accepts new codes with no email and preserves leading zeros", () => {
    expect(
      LecturerImportValidator.validate([normalize()], context)[0],
    ).toMatchObject({
      action: "CREATE",
      status: "VALID",
      errors: [],
      values: { lecturerCode: "001GV", email: null, maxStudents: 5 },
    });
  });
  it("rejects unknown departments, areas and invalid quotas", () => {
    const row = normalize({
      ...raw,
      departmentCode: "missing",
      researchAreas: "missing",
      maxStudents: "-1",
    });
    expect(
      LecturerImportValidator.validate([row], context)[0].errors.map(
        (e) => e.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "DEPARTMENT_NOT_FOUND",
        "AREAS_INVALID",
        "QUOTA_INVALID",
      ]),
    );
  });
  it("marks all duplicate codes and emails, blocking conflicting accounts", () => {
    const rows = [
      normalize({ ...raw, email: "same@example.test" } as typeof raw),
      normalize({ ...raw, email: "same@example.test" } as typeof raw),
    ];
    const result = LecturerImportValidator.validate(rows, {
      ...context,
      accounts: [
        { id: "other", username: "001GV", email: "same@example.test" },
      ],
    });
    for (const row of result)
      expect(row.errors.map((e) => e.code)).toEqual(
        expect.arrayContaining([
          "DUPLICATE_IN_FILE",
          "EMAIL_DUPLICATE_IN_FILE",
          "ACCOUNT_CONFLICT",
          "EMAIL_TAKEN",
        ]),
      );
  });
  it("plans an update for an existing lecturer and permits their email", () => {
    const lecturer = {
      id: "lecturer",
      userId: "user",
      lecturerCode: "001GV",
      fullName: "Cũ",
      departmentId: "dept",
      titleId: null,
      phone: null,
      isActive: true,
      maxStudents: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const row = LecturerImportValidator.normalize(
      { ...raw, email: "own@example.test" },
      2,
    );
    expect(
      LecturerImportValidator.validate([row], {
        ...context,
        lecturers: [lecturer],
        accounts: [
          { id: "user", username: "001GV", email: "own@example.test" },
        ],
      })[0],
    ).toMatchObject({ action: "UPDATE", lecturerId: "lecturer", errors: [] });
  });
  it("reads lecturer CSV headers and rejects student-only files", async () => {
    const buffer = Buffer.from(
      "lecturerCode,fullName,departmentCode,researchAreas,maxStudents\n001GV,Nguyễn Văn Mẫu,CNPM,Phần mềm,5",
    );
    const file = {
      originalname: "lecturers.csv",
      mimetype: "text/csv",
      size: buffer.length,
      buffer,
    };
    expect(
      (await ImportFileParser.parse(file, "lecturer"))[0].lecturerCode,
    ).toBe("001GV");
    await expect(ImportFileParser.parse(file, "student")).rejects.toThrow(
      "Thiếu cột",
    );
  });
});
