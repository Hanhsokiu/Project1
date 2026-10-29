import { BadRequestException } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import type { ImportFile } from "../dto/catalog.dto";

interface SourceRecord {
  values: unknown[];
  sourceRow: number;
}
export interface ParsedImportRecord extends Record<string, unknown> {
  __sourceRow: number;
}

/** Tokenize CSV while retaining the physical line where each logical record starts. */
function csvRecords(text: string): SourceRecord[] {
  const records: SourceRecord[] = [];
  const source = text.replace(/^\uFEFF/, "");
  const header = source.split(/\r\n|\r|\n/).find((line) => line.trim()) || "";
  const separator = header.includes(";") && !header.includes(",") ? ";" : ",";
  let row: string[] = [],
    value = "",
    quoted = false,
    line = 1,
    recordStart = 1;
  const finish = () => {
    row.push(value.trim());
    if (row.some(Boolean))
      records.push({ values: row, sourceRow: recordStart });
    row = [];
    value = "";
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === separator && !quoted) {
      row.push(value.trim());
      value = "";
    } else if (c === "\n" || c === "\r") {
      const newline = c === "\r" && source[i + 1] === "\n" ? "\r\n" : c;
      if (newline === "\r\n") i++;
      if (quoted) value += newline;
      else finish();
      line++;
      if (!quoted) recordStart = line;
    } else value += c;
  }
  if (quoted) throw new BadRequestException("CSV có dấu ngoặc kép chưa đóng");
  finish();
  return records;
}

export class ImportFileParser {
  /** Public compatibility API; source coordinates are retained by parse(). */
  static csv(text: string): string[][] {
    return csvRecords(text).map((record) => record.values as string[]);
  }

  static async parse(file: ImportFile): Promise<ParsedImportRecord[]> {
    if (!file || !file.buffer?.length)
      throw new BadRequestException("Chưa tải tệp dữ liệu");
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException("Tệp tối đa 5 MB");
    let records: SourceRecord[] = [];
    if (/\.csv$/i.test(file.originalname))
      records = csvRecords(file.buffer.toString("utf8"));
    else if (/\.xlsx$/i.test(file.originalname)) {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error();
        if (sheet.columnCount > 30)
          throw new BadRequestException("Tệp tối đa 1000 dòng và 30 cột");
        sheet.eachRow((row) => {
          const values: unknown[] = [];
          for (let c = 1; c <= sheet.columnCount; c++) {
            const cell = row.getCell(c);
            values.push(
              typeof cell.value === "number" ? cell.value : cell.text,
            );
          }
          if (values.some((v) => v !== "" && v !== null && v !== undefined))
            records.push({ values, sourceRow: row.number });
          if (records.length > 1001)
            throw new BadRequestException("Tệp tối đa 1000 dòng và 30 cột");
        });
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException("Không đọc được workbook XLSX");
      }
    } else throw new BadRequestException("Chỉ nhận tệp CSV UTF-8 hoặc XLSX");
    if (records.length < 2)
      throw new BadRequestException(
        "Tệp cần tiêu đề và ít nhất một dòng dữ liệu",
      );
    if (records.length > 1001)
      throw new BadRequestException("Tệp tối đa 1000 dòng");
    const headers = records[0].values.map((v) => String(v).trim());
    if (new Set(headers).size !== headers.length)
      throw new BadRequestException("Tên cột bị trùng");
    const present = (aliases: string[]) =>
      aliases.some((key) => headers.includes(key));
    if (
      !present(["studentCode", "code", "Mã SV", "MSSV"]) ||
      !present(["fullName", "name", "Họ và tên"]) ||
      !present(["className", "Lớp"]) ||
      !present(["gpa", "GPA"])
    )
      throw new BadRequestException(
        "Thiếu cột bắt buộc: studentCode, fullName, className, gpa",
      );
    // The parser owns this reserved metadata field, even if a file supplies the same column.
    return records
      .slice(1)
      .map((record) => ({
        ...Object.fromEntries(
          headers.map((key, i) => [key, record.values[i] ?? ""]),
        ),
        __sourceRow: record.sourceRow,
      }));
  }

  static async template(format: "csv" | "xlsx") {
    const headers = [
      "studentCode",
      "fullName",
      "className",
      "majorName",
      "cohort",
      "trainingSystemCode",
      "gpa",
      "email",
      "phone",
      "academicEligible",
    ];
    if (format === "csv")
      return Buffer.from(
        "\uFEFF" +
          headers.join(",") +
          "\r\n001234567,Nguyễn Văn Mẫu,CNTT K64,K64,,3.20,,,true\r\n",
        "utf8",
      );
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Sinh viên");
    sheet.columns = headers.map((key) => ({
      header: key,
      key,
      width: 24,
      style: { numFmt: key === "gpa" ? "0.00" : "@" },
    }));
    sheet.addRow({
      studentCode: "001234567",
      fullName: "Nguyễn Văn Mẫu",
      className: "CNTT K64",
      majorName: "Công nghệ thông tin",
      cohort: "K64",
      trainingSystemCode: "",
      gpa: 3.2,
      email: "",
      phone: "",
      academicEligible: "true",
    });
    sheet.getRow(1).font = { bold: true };
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
