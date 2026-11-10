import { Injectable } from "@nestjs/common";
import { FinalDefensePolicySchema } from "@doan/shared";
import type { AdvisorSummary, FinalDefensePolicy } from "@doan/shared";
import { groupError } from "../../topic/review-groups/review-group.errors";
import { reviewHash } from "../../topic/proposal-reviews/proposal-review.validator";

export type FinalContext = {
  assignmentId: string;
  assignmentRevision: number;
  topicRevision: number;
  policyHash: string;
};
@Injectable()
export class FinalDefenseValidator {
  policy(raw?: string | null): FinalDefensePolicy | null {
    try {
      const p = FinalDefensePolicySchema.parse(JSON.parse(raw ?? "null"));
      return new Date(p.approvedAt) <= new Date() ? p : null;
    } catch {
      return null;
    }
  }
  key(value: string) {
    if (!value || !/^[\w.-]{1,200}$/.test(value))
      groupError(400, "COMMON_003", "Cần Idempotency-Key hợp lệ.");
  }
  summary(body: AdvisorSummary, policy: FinalDefensePolicy) {
    if (
      Math.abs(
        body.score / policy.scoreStep -
          Math.round(body.score / policy.scoreStep),
      ) > 1e-7 ||
      Math.abs(body.score * 10 - Math.round(body.score * 10)) > 1e-7
    )
      groupError(
        400,
        "SCORE_INVALID",
        "Điểm không đúng bước điểm đã duyệt hoặc độ chính xác của SCORE_ENTRY.",
      );
    const rubric = policy.rubric;
    if (!rubric && Object.keys(body.criterionScores).length)
      groupError(400, "SCORE_INVALID", "Chưa có rubric được duyệt.");
    if (rubric) {
      if (
        Object.keys(body.criterionScores).length !== rubric.length ||
        rubric.some(
          (r) =>
            !(r.key in body.criterionScores) ||
            body.criterionScores[r.key] > r.maxScore,
        )
      )
        groupError(
          400,
          "SCORE_INVALID",
          "Cần điểm hợp lệ cho toàn bộ tiêu chí rubric.",
        );
      const total = rubric.reduce(
        (n, r) =>
          n + (body.criterionScores[r.key] / r.maxScore) * r.weight * 10,
        0,
      );
      if (Math.abs(total - body.score) > 1e-7)
        groupError(
          400,
          "SCORE_INVALID",
          "Điểm tổng không khớp rubric; hệ thống không tự làm tròn.",
        );
    }
  }
  current(value: unknown, expected: FinalContext) {
    return reviewHash(value) === reviewHash(expected);
  }
}
