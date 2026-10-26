import { describe, expect, it } from "vitest";
import * as ExcelJS from "exceljs";
import { CatalogInputValidator } from "./catalog.validator";
import { studentSchema } from "../dto/catalog.dto";
import {
  ImportRowValidator,
  type ImportValidationContext,
} from "./import-row.validator";
import { ImportConfirmationValidator } from "./import-confirmation.validator";
import { ImportFileParser } from "../service/import-file.parser";
const context: ImportValidationContext = {
  trainingSystem: { id: "sys1", code: "CQ", name: "Chính quy" },
  threshold: 2,
  students: [],
  accounts: [],
};
const raw = {
  studentCode: "001234567",
  fullName: "Nguyễn Văn An",
  className: "CNTT 1",
  gpa: "3.2",
  email: "",
  phone: "",
  trainingSystemCode: "CQ",
};
const normalized = (value: Record<string, unknown> = raw) =>
  ImportRowValidator.normalize(value, 2, "CQ");
describe("CatalogInputValidator", () => {
  it("validates pagination filters with bounded page size and aliases", () => {
    expect(
      CatalogInputValidator.query({ limit: "25", academicEligible: "false" }),
    ).toMatchObject({ page: 1, pageSize: 25, academicEligible: false });
    expect(() => CatalogInputValidator.query({ page: "0" })).toThrow();
    expect(() => CatalogInputValidator.query({ pageSize: "1000" })).toThrow();
  });
  it("requires supplied GPA and valid contact fields while permitting absent email", () => {
    const fields = {
      ...raw,
      trainingSystemId: "11111111-1111-4111-8111-111111111111",
    };
    expect(
      CatalogInputValidator.parse(studentSchema, fields).email,
    ).toBeUndefined();
    expect(() =>
      CatalogInputValidator.parse(studentSchema, { ...fields, gpa: "" }),
    ).toThrow();
    expect(() =>
      CatalogInputValidator.parse(studentSchema, { ...fields, gpa: "   " }),
    ).toThrow();
    expect(() =>
      CatalogInputValidator.parse(studentSchema, { ...fields, email: "bad" }),
    ).toThrow();
  });
});
describe("ImportRowValidator", () => {
  it("preserves leading zeros and missing contacts without inventing GPA", () => {
    const row = normalized();
    expect(row.values).toMatchObject({
      studentCode: "001234567",
      gpa: 3.2,
      email: null,
      phone: null,
    });
    expect(ImportRowValidator.validate([row], context)[0].errors).toHaveLength(
      0,
    );
    const missing = ImportRowValidator.validate(
      [normalized({ ...raw, gpa: "" })],
      context,
    )[0];
    expect(missing.values.gpa).toBeNull();
    expect(missing.errors.some((e) => e.field === "gpa")).toBe(true);
  });
  it("reports numeric Excel identifiers, duplicate rows, GPA and program errors", () => {
    const rows = ImportRowValidator.validate(
      [
        normalized({
          ...raw,
          studentCode: 12345,
          gpa: 1,
          trainingSystemCode: "LT",
        }),
        normalized({ ...raw, studentCode: 12345 }),
      ],
      context,
    );
    expect(rows[0].errors.map((e) => e.code)).toEqual(
      expect.arrayContaining([
        "CODE_MUST_BE_TEXT",
        "DUPLICATE_IN_FILE",
        "GPA_INELIGIBLE",
        "PROGRAM_MISMATCH",
      ]),
    );
    expect(rows[1].status).toBe("ERROR");
  });
  it("recognizes already-rostered students and allows their own email, rejecting another owner", () => {
    const previous = {
      ...context,
      students: [
        {
          id: "s1",
          studentCode: raw.studentCode,
          userId: "u1",
          trainingSystemId: "sys1",
          inTerm: true,
        },
      ],
      accounts: [
        { id: "u1", username: raw.studentCode, email: "old@example.com" },
        { id: "u2", username: "other", email: "taken@example.com" },
      ],
    };
    expect(
      ImportRowValidator.validate(
        [normalized({ ...raw, email: "old@example.com" })],
        previous,
      )[0].action,
    ).toBe("SKIP");
    expect(
      ImportRowValidator.validate(
        [normalized({ ...raw, email: "taken@example.com" })],
        previous,
      )[0].errors.some((e) => e.code === "EMAIL_TAKEN"),
    ).toBe(true);
  });
  it("marks duplicate emails on every conflicting row and rejects an unknown eligibility value", () => {
    const rows = ImportRowValidator.validate(
      [
        normalized({ ...raw, email: "same@example.com" }),
        normalized({
          ...raw,
          studentCode: "000000002",
          email: "same@example.com",
          academicEligible: "maybe",
        }),
      ],
      context,
    );
    expect(
      rows.every((r) =>
        r.errors.some((e) => e.code === "EMAIL_DUPLICATE_IN_FILE"),
      ),
    ).toBe(true);
    expect(rows[1].errors.some((e) => e.code === "ACADEMIC_FLAG_INVALID")).toBe(
      true,
    );
  });
});
describe("ImportConfirmationValidator", () => {
  it("accepts valid mutable terms and rejects locked, completed and unconfigured terms", () => {
    expect(() =>
      ImportConfirmationValidator.term({
        trainingSystemId: "sys1",
        isLocked: false,
        status: "DRAFT",
      }),
    ).not.toThrow();
    expect(() =>
      ImportConfirmationValidator.term({
        trainingSystemId: "sys1",
        isLocked: true,
        status: "DRAFT",
      }),
    ).toThrow();
    expect(() =>
      ImportConfirmationValidator.term({
        trainingSystemId: null,
        isLocked: false,
        status: "DRAFT",
      }),
    ).toThrow();
  });
  it("requires strict completeness but explicitly permits partial valid-only confirmation", () => {
    const rows = ImportRowValidator.validate(
      [
        normalized(),
        {
          ...normalized({ ...raw, studentCode: "0002", gpa: "" }),
          rowNumber: 3,
        },
      ],
      context,
    );
    expect(() => ImportConfirmationValidator.rows(rows, "STRICT")).toThrow();
    expect(() =>
      ImportConfirmationValidator.rows(rows, "VALID_ONLY"),
    ).not.toThrow();
    expect(() =>
      ImportConfirmationValidator.rows(
        rows.filter((r) => r.errors.length),
        "VALID_ONLY",
      ),
    ).toThrow();
  });
});
describe("ImportFileParser", () => {
  it("keeps CSV physical record starts after blank lines and quoted CRLF without trusting a file metadata column", async () => {
    const buffer = Buffer.from(
      'studentCode,fullName,className,gpa,__sourceRow\r\n\r\n001234567,"Nguyễn Văn\r\nMẫu",CNTT,3.2,999\r\n\r\n001234568,Sinh Viên Thiếu GPA,CNTT,,999',
      "utf8",
    );
    const parsed = await ImportFileParser.parse({
      originalname: "blank-lines.csv",
      mimetype: "text/csv",
      size: buffer.length,
      buffer,
    });
    expect(parsed.map((r) => r.__sourceRow)).toEqual([3, 6]);
    expect(parsed[0].fullName).toBe("Nguyễn Văn\r\nMẫu");
    const rows = ImportRowValidator.validate(
      parsed.map((r) => ImportRowValidator.normalize(r, r.__sourceRow, "CQ")),
      context,
    );
    expect(rows[1].rowNumber).toBe(6);
    expect(rows[1].errors.some((e) => e.field === "gpa")).toBe(true);
  });
  it("keeps worksheet row numbers across sparse blank rows and ignores newlines inside a cell", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("SV");
    sheet.getRow(1).values = ["studentCode", "fullName", "className", "gpa"];
    sheet.getRow(3).values = ["001234567", "Nguyễn Văn\nMẫu", "CNTT", 3.2];
    sheet.getRow(7).values = ["001234568", "Sinh Viên Thiếu GPA", "CNTT", ""];
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    const parsed = await ImportFileParser.parse({
      originalname: "sparse.xlsx",
      mimetype:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: buffer.length,
      buffer,
    });
    expect(parsed.map((r) => r.__sourceRow)).toEqual([3, 7]);
    const rows = ImportRowValidator.validate(
      parsed.map((r) => ImportRowValidator.normalize(r, r.__sourceRow, "CQ")),
      context,
    );
    expect(rows[1].rowNumber).toBe(7);
    expect(rows[1].status).toBe("ERROR");
  });
  it("handles quoted CSV, BOM and multiline fields and rejects broken files", async () => {
    expect(
      ImportFileParser.csv('\uFEFFcode,name\r\n001,"An, Bình\nChi"')[1],
    ).toEqual(["001", "An, Bình\nChi"]);
    expect(() => ImportFileParser.csv('code,name\n001,"broken')).toThrow();
    await expect(
      ImportFileParser.parse({
        originalname: "wrong.pdf",
        mimetype: "application/pdf",
        size: 1,
        buffer: Buffer.from("a"),
      }),
    ).rejects.toThrow("CSV");
  });
  it("produces a real XLSX template that round-trips leading-zero identifiers", async () => {
    const buffer = await ImportFileParser.template("xlsx");
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(book.worksheets[0].getCell("A2").value).toBe("001234567");
    const rows = await ImportFileParser.parse({
      originalname: "template.xlsx",
      mimetype:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: buffer.length,
      buffer,
    });
    expect(rows[0].studentCode).toBe("001234567");
    expect(rows[0].gpa).toBe(3.2);
  });
});
