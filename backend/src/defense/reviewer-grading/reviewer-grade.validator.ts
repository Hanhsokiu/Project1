import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ReviewerGradePolicySchema,
  scoreFraction,
  addScoreFraction,
  weightedScoreFraction,
  scoreFractionMatches,
} from "@doan/shared";
import type { ReviewerGradeCommand, ReviewerGradePolicy } from "@doan/shared";
import { groupError } from "../../topic/review-groups/review-group.errors";
const D = (v: string) => new Prisma.Decimal(v);
const invalid = (code: string, message: string): never =>
  groupError(400, code, message);
export function gradeDecimal(value: string, max = "10", step?: string) {
  const v = D(value);
  if (v.isNegative() || v.gt(max) || (step && !v.mod(D(step)).isZero()))
    invalid("SCORE_INVALID", "Điểm vượt giới hạn hoặc sai bước điểm đã duyệt.");
  if (v.decimalPlaces() > 1)
    invalid(
      "SCORE_PRECISION_UNSUPPORTED",
      "SCORE_ENTRY/SCORE_DETAIL Decimal(4,1) không lưu chính xác điểm này; không tự làm tròn.",
    );
  return v.toString();
}
@Injectable()
export class ReviewerGradeValidator {
  policyIssue(raw?: string | null) {
    try {
      const p = ReviewerGradePolicySchema.parse(JSON.parse(raw ?? "null"));
      if (
        D(p.scoreStep).decimalPlaces() > 1 ||
        p.rubric?.criteria.some(
          (c) =>
            D(c.step).decimalPlaces() > 1 || D(c.maxScore).decimalPlaces() > 1,
        )
      )
        return "SCORE_PRECISION_UNSUPPORTED";
      if (p.rubric?.criteria.some((c) => D(c.maxScore).gt(10)))
        return "RUBRIC_RANGE_UNSUPPORTED";
    } catch {
      /* Missing or unapproved policy stays closed. */
    }
    return "UC22_POLICY_REQUIRED";
  }
  policy(raw?: string | null): ReviewerGradePolicy | null {
    try {
      const p = ReviewerGradePolicySchema.parse(JSON.parse(raw ?? "null"));
      if (
        new Date(p.approvedAt) > new Date() ||
        D(p.scoreStep).lte(0) ||
        D(p.scoreStep).gt(10) ||
        D(p.scoreStep).decimalPlaces() > 1
      )
        return null;
      if (new Set(p.requiredFeedback).size !== p.requiredFeedback.length)
        return null;
      if (p.rubric) {
        if (
          new Set(p.rubric.criteria.map((c) => c.id)).size !==
          p.rubric.criteria.length
        )
          return null;
        let sum = D("0");
        for (const c of p.rubric.criteria) {
          if (
            D(c.maxScore).lte(0) ||
            D(c.maxScore).gt(10) ||
            D(c.maxScore).decimalPlaces() > 1 ||
            D(c.weight).lte(0) ||
            D(c.weight).decimalPlaces() > 2 ||
            D(c.step).lte(0) ||
            D(c.step).gt(c.maxScore) ||
            D(c.step).decimalPlaces() > 1
          )
            return null;
          sum = sum.plus(c.weight);
        }
        if (!sum.eq(1)) return null;
      }
      return p;
    } catch {
      return null;
    }
  }
  score(b: ReviewerGradeCommand, p: ReviewerGradePolicy, final: boolean) {
    if (final)
      for (const key of p.requiredFeedback)
        if (!b[key].trim())
          invalid("FEEDBACK_REQUIRED", `Thiếu nội dung bắt buộc: ${key}.`);
    if (final && p.minimumQuestions) {
      const questions = b.questions.split(/\r?\n/)
        .map(q => q.replace(/^[\s\d.)\-•]+/u, "").trim().normalize("NFC").toLocaleLowerCase("vi"))
        .filter(Boolean);
      if (new Set(questions).size < p.minimumQuestions)
        invalid("QUESTIONS_REQUIRED", `Cần ít nhất ${p.minimumQuestions} câu hỏi riêng biệt, mỗi câu một dòng.`);
    }
    if (final && b.totalScore === null)
      invalid("SCORE_REQUIRED", "Cần điểm tổng trước khi chốt.");
    if (b.totalScore !== null) gradeDecimal(b.totalScore, "10", p.scoreStep);
    if (!p.rubric) {
      if (Object.keys(b.criterionScores).length)
        invalid(
          "RUBRIC_INVALID",
          "Policy cho nhập tổng trực tiếp, không có rubric.",
        );
      return b.totalScore === null ? null : D(b.totalScore).toString();
    }
    const criteria = p.rubric.criteria;
    if (
      Object.keys(b.criterionScores).some(
        (id) => !criteria.some((c) => c.id === id),
      )
    )
      invalid("RUBRIC_INVALID", "Có tiêu chí ngoài rubric được duyệt.");
    let total = scoreFraction("0");
    for (const c of criteria) {
      const v = b.criterionScores[c.id];
      if (v === undefined) {
        if (final || b.totalScore !== null)
          invalid(
            "RUBRIC_INCOMPLETE",
            "Cần điểm toàn bộ tiêu chí để tính tổng.",
          );
        continue;
      }
      gradeDecimal(v, c.maxScore, c.step);
      total = addScoreFraction(
        total,
        weightedScoreFraction(v, c.maxScore, c.weight),
      );
    }
    if (b.totalScore !== null) {
      // BigInt rational arithmetic: even recurring fractions never round before comparison.
      if (!scoreFractionMatches(b.totalScore, total))
        invalid(
          "RUBRIC_TOTAL_INVALID",
          "Tổng không khớp trọng số/quy đổi chính xác; không tự làm tròn.",
        );
    }
    return b.totalScore === null ? null : D(b.totalScore).toString();
  }
}
