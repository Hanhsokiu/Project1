import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { ConfirmMode, StudentImportRow } from "../dto/catalog.dto";
export class ImportConfirmationValidator {
  static mode(value: unknown): ConfirmMode {
    if (value !== "STRICT" && value !== "VALID_ONLY")
      throw new BadRequestException("mode phải là STRICT hoặc VALID_ONLY");
    return value;
  }
  static term(
    term: {
      trainingSystemId: string | null;
      isLocked: boolean;
      status: string;
    } | null,
  ) {
    if (!term) throw new BadRequestException("Đợt đích không tồn tại");
    if (!term.trainingSystemId)
      throw new UnprocessableEntityException(
        "Đợt chưa được cấu hình hệ đào tạo",
      );
    if (term.isLocked || !["DRAFT", "OPEN_REGISTRATION"].includes(term.status))
      throw new ConflictException(
        "Chỉ nhập SV vào đợt Nháp/Mở đăng ký và chưa khóa",
      );
  }
  static rows(rows: StudentImportRow[], mode: ConfirmMode) {
    if (mode === "STRICT" && rows.some((r) => r.errors.length))
      throw new UnprocessableEntityException({
        success: false,
        error: {
          code: "IMPORT_HAS_ERRORS",
          message:
            "Chế độ STRICT yêu cầu sửa tất cả dòng lỗi trước khi xác nhận",
          details: { invalidRows: rows.filter((r) => r.errors.length).length },
        },
      });
    if (!rows.some((r) => !r.errors.length))
      throw new UnprocessableEntityException("Không có dòng hợp lệ để nhập");
  }
}
