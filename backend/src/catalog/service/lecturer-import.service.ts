import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";
import * as ExcelJS from "exceljs";
import { ImportRepository } from "../repository/import.repository";
import { ImportFileParser } from "./import-file.parser";
import { LecturerImportValidator } from "../validator/lecturer-import.validator";
import { ImportConfirmationValidator } from "../validator/import-confirmation.validator";
import { jobDto } from "./import.service";
import type {
  ConfirmMode,
  ImportFile,
  LecturerImportRow,
} from "../dto/catalog.dto";

@Injectable()
export class LecturerImportService {
  constructor(private readonly repo: ImportRepository) {}
  async template(format: string) {
    if (!["csv", "xlsx"].includes(format))
      throw new BadRequestException("format phải là csv hoặc xlsx");
    const context = await this.repo.lecturerContext([], []);
    const values = {
      lecturerCode: "GV_MAU_01",
      fullName: "Trần Văn Mẫu",
      departmentCode: context.departments[0]?.code || "CNPM",
      researchAreas: context.areas[0]?.name || "Phần mềm",
      maxStudents: 5,
      email: "",
      phone: "",
    };
    const headers = Object.keys(values);
    if (format === "csv") {
      const escape = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      return Buffer.from(
        "\uFEFF" +
          headers.map(escape).join(",") +
          "\r\n" +
          Object.values(values).map(escape).join(",") +
          "\r\n",
        "utf8",
      );
    }
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Giảng viên");
    sheet.columns = headers.map((key) => ({
      header: key,
      key,
      width: 25,
      style: { numFmt: key === "maxStudents" ? "0" : "@" },
    }));
    sheet.addRow(values);
    sheet.getRow(1).font = { bold: true };
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  async preview(file: ImportFile, actorId: string) {
    const raw = await ImportFileParser.parse(file, "lecturer");
    const normalized = raw.map((r) =>
      LecturerImportValidator.normalize(r, r.__sourceRow),
    );
    const context = await this.repo.lecturerContext(
      normalized.map((r) => r.values.lecturerCode),
      normalized.flatMap((r) => (r.values.email ? [r.values.email] : [])),
    );
    const rows = LecturerImportValidator.validate(normalized, context);
    return jobDto<LecturerImportRow>(
      await this.repo.createPreview({
        type: "LECTURER",
        createdBy: actorId,
        fileName: file.originalname.slice(0, 255),
        fileHash: createHash("sha256").update(file.buffer).digest("hex"),
        rows,
      }),
    );
  }
  async detail(id: string) {
    const job = await this.repo.job(id);
    if (!job || job.type !== "LECTURER")
      throw new NotFoundException("Không tìm thấy công việc import giảng viên");
    return jobDto<LecturerImportRow>(job);
  }
  async confirm(id: string, mode: ConfirmMode, actorId: string) {
    ImportConfirmationValidator.mode(mode);
    const result = await this.repo.serializable(async (tx) => {
      const job = await tx.job(id);
      if (!job || job.type !== "LECTURER")
        throw new NotFoundException(
          "Không tìm thấy công việc import giảng viên",
        );
      if (job.confirmedAt) return job;
      if (job.status !== "VALIDATED" || !Array.isArray(job.rows))
        throw new ConflictException("Công việc import chưa sẵn sàng xác nhận");
      const original = job.rows as unknown as LecturerImportRow[];
      const context = await tx.lecturerContext(
        original.map((r) => r.values.lecturerCode),
        original.flatMap((r) => (r.values.email ? [r.values.email] : [])),
      );
      const rows = LecturerImportValidator.validate(original, context);
      ImportConfirmationValidator.rows(rows, mode);
      for (const row of rows) {
        if (row.errors.length) continue;
        row.lecturerId = await tx.applyLecturer(row, context);
        row.status = "IMPORTED";
      }
      return tx.finish(id, rows, mode, actorId);
    });
    return jobDto<LecturerImportRow>(result);
  }
}
