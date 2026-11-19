import { z } from "zod";
import { FinalResultPolicySchema, ResultComponentSchema } from "@doan/shared";
const id = z.string().min(1).max(36),
  hash = z.string().regex(/^[a-f0-9]{64}$/),
  decimal = z.string().regex(/^(?:0|[1-9]\d?)(?:\.\d{1,6})?$/);
const source = z
  .object({
    source: ResultComponentSchema,
    lecturerId: id,
    role: z.string().min(1),
    scoreEntryId: id,
    revision: z.number().int().nonnegative(),
    totalScore: decimal,
    evidenceHash: hash,
    reportVersionId: id,
    reportChecksum: hash,
  })
  .strict();
const calculation = z
  .object({
    components: z
      .object({
        ADVISOR_UC17: decimal.optional(),
        PROCESS_UC16: decimal.optional(),
        REVIEWER: decimal.optional(),
        COMMITTEE: decimal.optional(),
      })
      .strict(),
    committeeScore: decimal.nullable(),
    reviewerScore: decimal.nullable(),
    finalScore: decimal,
    isPassed: z.boolean().nullable(),
    classification: z.string().nullable(),
  })
  .strict();
const confirmation = z
  .object({
    actor: id,
    lecturerId: id,
    role: z.enum(["CHAIR", "SECRETARY", "MEMBER"]),
    at: z.string().datetime(),
    evidenceHash: hash,
    reason: z.string().nullable(),
  })
  .strict();
export const FinalResultContextSchema = z
  .object({
    kind: z.literal("UC24"),
    termId: id,
    termStudentId: id,
    proposalId: id,
    evidenceHash: hash,
    evidence: z
      .object({
        termId: id,
        memberId: id,
        proposalId: id,
        committee: z.unknown(),
        policy: FinalResultPolicySchema,
        sources: z.array(source).min(1).max(30),
        proof: z.array(z.unknown()).max(40),
        schedule: z.unknown(),
      })
      .strict(),
    policy: FinalResultPolicySchema,
    calculation,
    confirmations: z.array(confirmation).max(3),
  })
  .strict();
export function finalResultContext(raw: unknown) {
  const parsed = FinalResultContextSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
