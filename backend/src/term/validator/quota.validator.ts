import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { quotaReady } from "@doan/shared";

export class QuotaValidator {
  static require(condition: unknown, message: string): asserts condition {
    if (!condition) throw new UnprocessableEntityException(message);
  }
  static revision(actual: number, expected: number) {
    if (actual !== expected)
      throw new ConflictException(
        "Chính sách chỉ tiêu vừa thay đổi. Hãy tải lại trang trước khi tiếp tục.",
      );
  }
  static ready(
    term: {
      quotaPolicy?: unknown;
      termStudents: { studentId: string }[];
      termLecturers: { lecturerId: string; quota: number }[];
    },
    submittedStudentIds?: string[],
  ) {
    if (
      !quotaReady(
        term.quotaPolicy,
        term.termStudents.map((s) => s.studentId),
        term.termLecturers,
        submittedStudentIds,
      )
    )
      throw new ConflictException(
        "Chỉ tiêu chưa được chốt hoặc danh sách tham gia đã thay đổi. Khoa cần tính và chốt lại chỉ tiêu trước khi phân công.",
      );
  }
}
