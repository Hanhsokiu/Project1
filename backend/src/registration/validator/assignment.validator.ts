import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { LoadedTerm } from "../../term/repository/term.repository";
import { AssignmentRegistration } from "../repository/assignment.repository";
import { RegistrationValidator } from "./registration.validator";
export class AssignmentValidator {
  static require(condition: unknown, message: string): asserts condition {
    if (!condition) throw new UnprocessableEntityException(message);
  }
  static revision(actual: number, expected: number) {
    if (actual !== expected)
      throw new ConflictException(
        "Phương án đã thay đổi. Hãy tải lại và xem trước.",
      );
  }
  static issue(reg: AssignmentRegistration, term: LoadedTerm): string {
    try {
      this.require(
        reg.status === "SUBMITTED" && reg.submittedAt,
        "Đăng ký chưa nộp hợp lệ.",
      );
      RegistrationValidator.eligibility(reg.student, term);
      this.require(reg.direction?.isActive, "Hướng đồ án không còn hoạt động.");
      this.require(
        reg.preferences.length >= 1 &&
          reg.preferences.length <= 3 &&
          reg.preferences.every((p, i) => p.preferenceOrder === i + 1),
        "Nguyện vọng không hợp lệ.",
      );
      return "";
    } catch (error) {
      const response = (
        error as { getResponse?: () => { error?: { message?: string } } }
      ).getResponse?.();
      return response?.error?.message ?? (error as Error).message;
    }
  }
  static advisor(
    reg: AssignmentRegistration,
    advisorId: string,
    term: LoadedTerm,
  ) {
    const member = term.termLecturers.find((l) => l.lecturerId === advisorId);
    this.require(
      member && member.lecturer.isActive,
      "GV không hoạt động hoặc không tham gia đợt.",
    );
    this.require(
      member.lecturer.researchAreas.some(
        (a) => a.researchAreaId === reg.directionId,
      ),
      "GV không đúng hướng đồ án.",
    );
    return member;
  }
}
