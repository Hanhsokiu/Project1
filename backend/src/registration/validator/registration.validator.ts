import {
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { LoadedTerm } from "../../term/repository/term.repository";
import { hasPassingGpa } from "../../term/validator/term-configuration.validator";
import { parametersFromTerm } from "../../term/dto/term.mapper";
import { ContactValidator } from "../../auth/validator/contact.validator";
import { RegistrationWrite } from "../dto/registration.dto";

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new UnprocessableEntityException({
      error: { code: "REGISTRATION_INVALID", message },
    });
}
export class RegistrationValidator {
  static contact(
    user: {
      mustChangePassword: boolean;
      email: string | null;
      phone: string | null;
    },
    phone?: string | null,
  ) {
    if (user.mustChangePassword)
      throw new ForbiddenException({
        error: {
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Vui lòng đổi mật khẩu mặc định.",
        },
      });
    if (!ContactValidator.complete(user.email, user.phone || phone))
      throw new ForbiddenException({
        error: {
          code: "PROFILE_INCOMPLETE",
          message:
            "Vui lòng hoàn tất Email và số điện thoại hợp lệ trong hồ sơ.",
        },
      });
  }
  static eligibility(
    student: {
      id: string;
      isActive: boolean;
      academicEligible: boolean;
      trainingSystemId: string;
      gpa: unknown;
    },
    term: LoadedTerm,
  ) {
    requireValid(
      term.termStudents.some((r) => r.studentId === student.id),
      "Sinh viên không thuộc danh sách đủ điều kiện của đợt.",
    );
    requireValid(
      student.isActive && student.academicEligible,
      "Sinh viên chưa đủ điều kiện học vụ hoặc đã ngưng hoạt động.",
    );
    requireValid(
      !!term.trainingSystemId &&
        student.trainingSystemId === term.trainingSystemId,
      "Hệ đào tạo không khớp với đợt.",
    );
    requireValid(
      hasPassingGpa(
        student.gpa,
        parametersFromTerm(term).passing_gpa_threshold,
      ),
      "GPA còn thiếu hoặc chưa đạt ngưỡng của đợt.",
    );
  }
  static preferences(
    input: RegistrationWrite,
    submit: boolean,
    term: LoadedTerm,
    activeAreaIds: string[],
  ) {
    const max = Math.min(3, parametersFromTerm(term).max_preferences);
    requireValid(
      input.preferences.length >= (submit ? 1 : 0) &&
        input.preferences.length <= max,
      `Chọn ${submit ? "từ 1 đến" : "tối đa"} ${max} nguyện vọng.`,
    );
    requireValid(
      new Set(input.preferences.map((p) => p.lecturerId)).size ===
        input.preferences.length,
      "Không được trùng giảng viên.",
    );
    requireValid(
      input.preferences.every((p, i) => p.preferenceOrder === i + 1),
      "Thứ tự nguyện vọng phải liên tục NV1, NV2, NV3.",
    );
    const activeLecturers = term.termLecturers.filter(
      (l) => l.lecturer.isActive,
    );
    if (submit || input.directionId || input.preferences.length)
      requireValid(
        input.directionId &&
          activeAreaIds.includes(input.directionId) &&
          activeLecturers.some((l) =>
            l.lecturer.researchAreas.some(
              (a) => a.researchAreaId === input.directionId,
            ),
          ),
        "Chọn đúng một hướng đang hoạt động và có giảng viên tham gia đợt.",
      );
    for (const pref of input.preferences)
      requireValid(
        activeLecturers.some(
          (l) =>
            l.lecturerId === pref.lecturerId &&
            l.lecturer.researchAreas.some(
              (a) => a.researchAreaId === input.directionId,
            ),
        ),
        "Giảng viên không hoạt động, ngoài đợt hoặc không đúng hướng.",
      );
  }
}
