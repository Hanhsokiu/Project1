import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "crypto";
import * as bcrypt from "bcryptjs";
import type { ImportJob } from "@prisma/client";
import { ImportRepository } from "../repository/import.repository";
import { ImportFileParser } from "./import-file.parser";
import {
  ImportRowValidator,
  type ImportValidationContext,
} from "../validator/import-row.validator";
import { ImportConfirmationValidator } from "../validator/import-confirmation.validator";
import type {
  ConfirmMode,
  ImportFile,
  StudentImportRow,
} from "../dto/catalog.dto";
type ImportContext = Awaited<ReturnType<ImportRepository["context"]>>;
function validationContext(context: ImportContext): ImportValidationContext {
  const term = context.term!;
  return {
    trainingSystem: term.trainingSystem!,
    threshold: Number(
      term.parameters.find((p) => p.key === "passing_gpa_threshold")?.value ??
        2,
    ),
    students: context.students.map((s) => ({
      id: s.id,
      studentCode: s.studentCode,
      trainingSystemId: s.trainingSystemId,
      userId: s.userId,
      inTerm: s.termStudents.length > 0,
    })),
    accounts: context.accounts,
  };
}
function jobDto(job: ImportJob) {
  const rows = (Array.isArray(job.rows)
    ? job.rows
    : []) as unknown as StudentImportRow[];
  return {
    id: job.id,
    termId: job.termId,
    fileName: job.fileName,
    status: job.status,
    totalRows: job.totalRows,
    validRows: rows.filter((r) => !r.errors.length).length,
    invalidRows: rows.filter((r) => r.errors.length).length,
    successRows: job.successRows,
    errorRows: job.errorRows,
    skippedRows: rows.filter(
      (r) => r.status === "SKIPPED" || r.action === "SKIP",
    ).length,
    createdAt: job.createdAt,
    confirmedAt: job.confirmedAt,
    mode: job.mode,
    rows,
    canConfirm:
      job.status === "VALIDATED" && rows.some((r) => !r.errors.length),
  };
}
@Injectable()
export class ImportService {
  constructor(private readonly repo: ImportRepository) {}
  template(format: string) {
    if (!["csv", "xlsx"].includes(format))
      throw new BadRequestException("format phải là csv hoặc xlsx");
    return ImportFileParser.template(format as "csv" | "xlsx");
  }
  async preview(file: ImportFile, termId: string, actorId: string) {
    if (!termId) throw new BadRequestException("Chọn đợt đích");
    const raw = await ImportFileParser.parse(file);
    if (!raw.length) throw new BadRequestException("Tệp không có dòng dữ liệu");
    const preliminary = raw.map((r) =>
      ImportRowValidator.normalize(r, r.__sourceRow, ""),
    );
    const context = await this.repo.context(
      termId,
      preliminary.map((r) => r.values.studentCode),
      preliminary.flatMap((r) => (r.values.email ? [r.values.email] : [])),
    );
    ImportConfirmationValidator.term(context.term);
    const target = context.term!.trainingSystem!;
    const normalized = raw.map((r) =>
      ImportRowValidator.normalize(r, r.__sourceRow, target.code),
    );
    const rows = ImportRowValidator.validate(
      normalized,
      validationContext(context),
    );
    const job = await this.repo.createPreview({
      termId,
      createdBy: actorId,
      fileName: file.originalname.slice(0, 255),
      fileHash: createHash("sha256").update(file.buffer).digest("hex"),
      rows,
    });
    return jobDto(job);
  }
  async detail(id: string) {
    const job = await this.repo.job(id);
    if (!job || job.type !== "STUDENT")
      throw new NotFoundException("Không tìm thấy công việc import");
    return jobDto(job);
  }
  async confirm(id: string, mode: ConfirmMode, actorId: string) {
    ImportConfirmationValidator.mode(mode);
    const current = await this.repo.job(id);
    if (!current || current.type !== "STUDENT")
      throw new NotFoundException("Không tìm thấy công việc import");
    if (current.confirmedAt) return jobDto(current);
    if (current.status !== "VALIDATED" || !current.termId)
      throw new ConflictException("Công việc import chưa sẵn sàng xác nhận");
    const originalRows = current.rows as unknown as StudentImportRow[];
    if (!Array.isArray(originalRows))
      throw new UnprocessableEntityException("Dữ liệu xem trước không hợp lệ");
    // Password hashing happens before the database transaction. Existing users never receive a new hash.
    const hashes = new Map<string, string>();
    for (const row of originalRows.filter(
      (r) => r.action === "CREATE" && !r.errors.length,
    ))
      hashes.set(
        row.values.studentCode,
        await bcrypt.hash(row.values.studentCode, 10),
      );
    const result = await this.repo.serializable(async (tx) => {
      const job = await tx.job(id);
      if (!job) throw new NotFoundException("Không tìm thấy công việc import");
      if (job.confirmedAt) return job;
      if (job.status !== "VALIDATED" || !job.termId)
        throw new ConflictException("Trạng thái công việc đã thay đổi");
      const context = await tx.context(
        job.termId,
        originalRows.map((r) => r.values.studentCode),
        originalRows.flatMap((r) => (r.values.email ? [r.values.email] : [])),
      );
      ImportConfirmationValidator.term(context.term);
      if (!context.role)
        throw new UnprocessableEntityException("Chưa cấu hình vai trò STUDENT");
      const rows = ImportRowValidator.validate(
        originalRows,
        validationContext(context),
      );
      ImportConfirmationValidator.rows(rows, mode);
      for (const row of rows) {
        if (row.errors.length) continue;
        if (row.action === "SKIP") {
          row.status = "SKIPPED";
          continue;
        }
        if (row.action === "CREATE" && !hashes.has(row.values.studentCode))
          throw new ConflictException(
            "Hồ sơ SV đã thay đổi; vui lòng tạo lại bản xem trước",
          );
        row.studentId = await tx.apply(
          row,
          job.termId,
          context.term!.trainingSystemId!,
          context.role.id,
          hashes.get(row.values.studentCode),
        );
        row.status = "IMPORTED";
      }
      return tx.finish(job.id, rows, mode, actorId);
    });
    return jobDto(result);
  }
}
