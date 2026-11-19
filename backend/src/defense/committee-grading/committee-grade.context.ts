import { z } from "zod";
import {
  CommitteeGradeCommandSchema,
  CommitteeRoleSchema,
  CommitteeGradePolicySchema,
} from "@doan/shared";
export const CommitteeGradeContextSchema = z
  .object({
    kind: z.literal("UC23"),
    termId: z.string().min(1).max(36),
    termStudentId: z.string().min(1).max(36),
    committeeId: z.string().min(1).max(36),
    lecturerId: z.string().min(1).max(36),
    memberRole: CommitteeRoleSchema,
    schedule: z
      .object({
        sessionId: z.string().min(1).max(36),
        revision: z.number().int().positive(),
        evidenceHash: z.string(),
        hash: z.string(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
      })
      .strict(),
    bindingHash: z.string().regex(/^[a-f0-9]{64}$/),
    policyVersion: z.string(),
    rubricVersion: z.string(),
    command: CommitteeGradeCommandSchema,
    policy: CommitteeGradePolicySchema,
    evaluation: z
      .object({
        totalScore: z.string().nullable(),
        criterionScores: z.record(z.string()),
      })
      .strict(),
    updatedBy: z.string(),
    finalizedBy: z.string().nullable(),
    finalizedAt: z.string().datetime().nullable(),
  })
  .strict();
export function committeeGradeContext(raw: unknown) {
  const v = CommitteeGradeContextSchema.safeParse(raw);
  return v.success ? v.data : null;
}
