import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CommitteeGradePolicySchema, committeeRubricTotal } from "@doan/shared";
import type { CommitteeGradeCommand, CommitteeGradePolicy } from "@doan/shared";
import { gradeDecimal } from "../reviewer-grading/reviewer-grade.validator";
import { groupError } from "../../topic/review-groups/review-group.errors";
const D = (v: string) => new Prisma.Decimal(v);
function invalid(code: string, message: string): never {
  return groupError(400, code, message);
}
@Injectable()
export class CommitteeGradeValidator {
  policy(raw?: string | null): CommitteeGradePolicy | null {
    try {
      const p = CommitteeGradePolicySchema.parse(JSON.parse(raw ?? "null")),
        now = new Date();
      if (
        new Date(p.approvedAt) > now ||
        new Set(p.gradingRoles).size !== p.gradingRoles.length
      )
        return null;
      if (
        p.effectiveUntil &&
        new Date(p.effectiveFrom) >= new Date(p.effectiveUntil)
      )
        return null;
      const cs = p.rubric.criteria;
      if (
        new Set(cs.map((c) => c.id)).size !== cs.length ||
        p.rubric.rounding.decimalPlaces > 1 ||
        D(p.rubric.totalStep).lte(0) ||
        D(p.rubric.totalStep).gt(10) ||
        D(p.rubric.totalStep).decimalPlaces() > 1
      )
        return null;
      if (
        cs.some(
          (c) =>
            D(c.minScore).lt(0) ||
            D(c.minScore).gt(c.maxScore) ||
            D(c.maxScore).lte(0) ||
            D(c.maxScore).gt(10) ||
            D(c.step).lte(0) ||
            D(c.step).gt(c.maxScore) ||
            [c.minScore, c.maxScore, c.step].some(
              (v) => D(v).decimalPlaces() > 1,
            ) ||
            D(c.weight).lte(0) ||
            D(c.weight).decimalPlaces() > 2 ||
            (!c.required &&
              p.rubric.missingOptional === "ZERO" &&
              !D(c.minScore).isZero()),
        )
      )
        return null;
      if (!cs.reduce((n, c) => n.plus(c.weight), D("0")).eq(1)) return null;
      return p;
    } catch {
      return null;
    }
  }
  applicable(p: CommitteeGradePolicy, at = new Date()) {
    return (
      at >= new Date(p.effectiveFrom) &&
      (!p.effectiveUntil || at < new Date(p.effectiveUntil))
    );
  }
  policyIssue(raw?: string | null) {
    try {
      const p = CommitteeGradePolicySchema.parse(JSON.parse(raw ?? "null"));
      if (
        p.rubric.rounding.decimalPlaces > 1 ||
        D(p.rubric.totalStep).decimalPlaces() > 1 ||
        p.rubric.criteria.some((c) =>
          [c.minScore, c.maxScore, c.step].some(
            (v) => D(v).decimalPlaces() > 1,
          ),
        )
      )
        return "SCORE_PRECISION_UNSUPPORTED";
    } catch {
      /* approved policy required */
    }
    return "UC23_POLICY_REQUIRED";
  }
  score(b: CommitteeGradeCommand, p: CommitteeGradePolicy, final: boolean) {
    if (final && p.commentRequired && !b.comment.trim())
      invalid("FEEDBACK_REQUIRED", "Cần nhận xét trước khi chốt.");
    const scores = Object.fromEntries(
      b.criterionScores.map((c) => [c.criterionId, c.score]),
    );
    for (const [id, score] of Object.entries(scores)) {
      const c = p.rubric.criteria.find((c) => c.id === id);
      if (!c) invalid("RUBRIC_INVALID", "Tiêu chí ngoài rubric đã duyệt.");
      if (D(score).lt(c.minScore))
        invalid("SCORE_INVALID", "Điểm nhỏ hơn mức tối thiểu.");
      // Steps are measured from configured minimum, never an assumed zero origin.
      gradeDecimal(score, c.maxScore);
      if (!D(score).minus(c.minScore).mod(c.step).isZero())
        invalid("SCORE_INVALID", "Sai bước điểm tiêu chí.");
    }
    let computed: ReturnType<typeof committeeRubricTotal>;
    try {
      computed = committeeRubricTotal(p, scores, final);
    } catch {
      invalid("RUBRIC_INCOMPLETE", "Thiếu tiêu chí bắt buộc.");
    }
    if (final && computed.totalScore === null)
      invalid(
        "SCORE_PRECISION_UNSUPPORTED",
        "Tổng không biểu diễn chính xác theo precision/rounding được duyệt; không tự làm tròn.",
      );
    if (computed.totalScore !== null)
      gradeDecimal(computed.totalScore, "10", p.rubric.totalStep);
    return {
      totalScore: computed.totalScore,
      criterionScores: computed.normalized,
    };
  }
}
