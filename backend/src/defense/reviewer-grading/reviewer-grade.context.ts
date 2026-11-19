import { z } from "zod";
import { ReviewerGradeCommandSchema } from "@doan/shared";
import { reviewHash } from "../../topic/proposal-reviews/proposal-review.validator";
import type { ReviewerGradeRecord } from "./reviewer-grade.repository";
export const ReviewerGradeContextSchema = z
  .object({
    kind: z.literal("UC22"),
    termStudentId: z.string().min(1).max(36),
    termId: z.string().min(1).max(36),
    reviewerId: z.string().min(1).max(36),
    bindingHash: z.string().regex(/^[a-f0-9]{64}$/),
    policyVersion: z.string().min(1).max(100),
    rubricVersion: z.string().min(1).max(100).nullable(),
    command: ReviewerGradeCommandSchema,
    updatedBy: z.string(),
    finalizedBy: z.string().nullable(),
    finalizedAt: z.string().datetime().nullable(),
  })
  .strict();
export function gradeContext(value: unknown) {
  const p = ReviewerGradeContextSchema.safeParse(value);
  return p.success ? p.data : null;
}
export function gradeSnapshot(row: ReviewerGradeRecord) {
  return {
    ...row,
    scoreDetails: [...row.scoreDetails].sort((a, b) =>
      a.rubricCriteriaId.localeCompare(b.rubricCriteriaId),
    ),
  };
}
export const gradeSnapshotHash = (row: ReviewerGradeRecord) =>
  reviewHash(gradeSnapshot(row));
