import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../common/exception/business.exception";
import { ErrorCode } from "../../common/exception/error-code.enum";
import { PhaseInput, phaseCodes } from "../dto/term.dto";

export const defaultTermParameters: Record<string, number> = {
  process_weight: 0.4,
  committee_weight: 0.6,
  advisor_weight_in_process: 0.5,
  reviewer_weight_in_process: 0.5,
  min_pass_score: 5,
  passing_gpa_threshold: 2,
  max_preferences: 3,
  min_weekly_pass_rate: 0.8,
};

export function hasPassingGpa(value: unknown, minimum: number): boolean {
  if (value === null || value === undefined || value === "") return false;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 4 && score >= minimum;
}
export function termAssert(
  condition: unknown,
  message: string,
  code = ErrorCode.VALIDATION_FAILED,
  status = HttpStatus.UNPROCESSABLE_ENTITY,
): asserts condition {
  if (!condition) throw new BusinessException(code, message, status);
}
export function validateDateRange(start: Date, end: Date, label: string) {
  termAssert(
    Number.isFinite(start.getTime()) &&
      Number.isFinite(end.getTime()) &&
      start < end,
    `${label}: thời điểm kết thúc phải sau bắt đầu.`,
  );
}
export function validateAcademicYear(value: string) {
  const [start, end] = value.split("-").map(Number);
  termAssert(
    Number.isInteger(start) &&
      end === start + 1 &&
      start >= 2000 &&
      end <= 2201,
    "Năm học phải gồm hai năm liên tiếp trong khoảng 2000–2201.",
  );
}
export function validatePhasePlan(
  phases: PhaseInput[],
  start: Date,
  end: Date,
) {
  termAssert(
    phases.length === phaseCodes.length &&
      new Set(phases.map((p) => p.code)).size === phaseCodes.length,
    "Cần đúng sáu giai đoạn khác nhau theo quy trình.",
  );
  const ids = phases.map((p) => p.id).filter(Boolean);
  termAssert(
    new Set(ids).size === ids.length,
    "Mã giai đoạn không được trùng.",
  );
  let previousEnd = start;
  for (const code of phaseCodes) {
    const phase = phases.find((p) => p.code === code);
    termAssert(phase, `Thiếu giai đoạn ${code}.`);
    const phaseStart = new Date(phase.start),
      phaseEnd = new Date(phase.end);
    validateDateRange(phaseStart, phaseEnd, `Giai đoạn ${phase.name}`);
    termAssert(
      phaseStart >= start && phaseEnd <= end,
      "Giai đoạn phải nằm trong thời gian của đợt.",
    );
    termAssert(
      phaseStart >= previousEnd,
      "Các giai đoạn phải đúng thứ tự, không chồng lấn thời gian.",
      ErrorCode.TERM_PHASE_OVERLAP,
    );
    previousEnd = phaseEnd;
  }
}
export function validateParameters(values: Record<string, number>) {
  termAssert(
    Object.values(values).every(Number.isFinite),
    "Tham số phải là số hữu hạn.",
  );
  for (const key of [
    "process_weight",
    "committee_weight",
    "advisor_weight_in_process",
    "reviewer_weight_in_process",
    "min_weekly_pass_rate",
  ])
    termAssert(
      values[key] >= 0 && values[key] <= 1,
      `${key} phải trong khoảng 0–1.`,
    );
  termAssert(
    Math.abs(values.process_weight + values.committee_weight - 1) < 0.000001,
    "Tổng trọng số QT và HĐ phải bằng 1.",
  );
  termAssert(
    Math.abs(
      values.advisor_weight_in_process + values.reviewer_weight_in_process - 1,
    ) < 0.000001,
    "Tổng trọng số GVHD và GVPB phải bằng 1.",
  );
  termAssert(
    values.min_pass_score >= 0 && values.min_pass_score <= 10,
    "Ngưỡng đạt phải trong thang 10.",
  );
  termAssert(
    values.passing_gpa_threshold >= 0 && values.passing_gpa_threshold <= 4,
    "Ngưỡng GPA phải trong thang 4.",
  );
  termAssert(
    Number.isInteger(values.max_preferences) &&
      values.max_preferences >= 1 &&
      values.max_preferences <= 3,
    "Số nguyện vọng phải là số nguyên từ 1 đến 3.",
  );
}
export function defaultPhasePlan(
  start: Date,
  end: Date,
  registrationStart?: string,
  registrationEnd?: string,
): PhaseInput[] {
  termAssert(
    !!registrationStart === !!registrationEnd,
    "Cần nhập cả thời điểm mở và hạn đăng ký.",
  );
  const labels = [
    "Đăng ký nguyện vọng",
    "Phân công GVHD",
    "Đề tài và đề cương",
    "Hướng dẫn và báo cáo tuần",
    "Nộp đồ án final",
    "Tổ chức bảo vệ",
  ];
  const registration = registrationStart
    ? { start: new Date(registrationStart), end: new Date(registrationEnd!) }
    : {
        start,
        end: new Date(start.getTime() + (end.getTime() - start.getTime()) / 6),
      };
  const remaining = end.getTime() - registration.end.getTime();
  const phases = phaseCodes.map((code, index) => ({
    code,
    name: labels[index],
    start: (index === 0
      ? registration.start
      : new Date(registration.end.getTime() + (remaining * (index - 1)) / 5)
    ).toISOString(),
    end: (index === 0
      ? registration.end
      : new Date(registration.end.getTime() + (remaining * index) / 5)
    ).toISOString(),
    locked: false,
  }));
  validatePhasePlan(phases, start, end);
  return phases;
}
