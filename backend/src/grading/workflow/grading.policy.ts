import { Prisma } from "@prisma/client";
import { HttpException } from "@nestjs/common";
import { z } from "zod";
import {
  calculationPolicySchema,
  criterionSchema,
  gradingRubricSchema,
  gradingDraftSchema,
  gradingKindSchema,
  gradingPolicySchema,
  type CalculationPolicy,
  type GradingDraft,
} from "@doan/shared";
import { hashJson } from "../../defense/workflow/defense-workflow.policy";
import { planningError } from "../../defense/planning/defense-planning.policy";
import { gradingParameterEvidenceSchema } from "./grading-parameters";
import {
  advisorGradeEvidenceSchema,
  councilEvidenceSchema,
} from "./grading-evidence";
export { hashJson };
export function gradingErrorCode(error: unknown, fallback: string) {
  if (error instanceof HttpException) {
    const response = error.getResponse() as { error?: { code?: string } };
    return response.error?.code ?? fallback;
  }
  // Do not turn unexpected I/O or programming errors into an ordinary blocker.
  throw error;
}
export function gradingError(
  status: number,
  code: string,
  message: string,
): never {
  return planningError(status, code, message);
}
const id = z.string().trim().min(1).max(36),
  rev = z.number().int().positive(),
  hash = z.string().regex(/^[0-9a-f]{64}$/),
  at = z.string().datetime({ offset: true });
const artifact = z.object({ id, revision: rev, hash }).strict();
export const gradeSourceSchema = z
  .object({
    uc18: artifact,
    committee: artifact,
    reviewer: artifact,
    schedule: artifact.nullable(),
    assignment: z
      .object({ assignmentId: id, revision: z.number().int().min(0) })
      .strict(),
    advisorId: id,
    advisorUserId: id,
    studentId: id,
    studentUserId: id,
    studentName: z.string(),
    title: z.string(),
    departmentId: id.nullable(),
    scorerLecturerId: id,
    committeeRole: z.enum(["CHAIR", "SECRETARY", "MEMBER"]).nullable(),
    pdf: z
      .object({
        finalReportId: id,
        revision: rev,
        checksum: hash,
        originalName: z.string(),
        sizeBytes: rev,
        submittedAt: at,
      })
      .strict(),
    slot: z
      .object({ startsAt: at, endsAt: at, roomId: id, committeeKey: id })
      .strict()
      .nullable(),
  })
  .strict();
export type GradeSource = z.infer<typeof gradeSourceSchema>;
export const sheetSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    sheetId: id,
    termId: id,
    proposalId: id,
    revision: rev,
    state: z.enum(["DRAFT", "SEALED"]),
    kind: gradingKindSchema,
    actorUserId: id,
    recordedAt: at,
    policyRevision: rev,
    source: gradeSourceSchema,
    rubric: gradingRubricSchema,
    draft: gradingDraftSchema,
    total: z.number().min(0).max(10).nullable(),
  })
  .strict();
export type SheetSnapshot = z.infer<typeof sheetSnapshotSchema>;
export const resultSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    termId: id,
    proposalId: id,
    revision: rev,
    state: z.enum(["SEALED", "PUBLISHED"]),
    recordedAt: at,
    actorUserId: id,
    policyRevision: rev,
    policyHash: hash,
    policy: calculationPolicySchema,
    parameters: gradingParameterEvidenceSchema,
    sourceHash: hash,
    reviewer: artifact,
    committee: z.array(artifact).min(1),
    advisor: z
      .object({
        id,
        revision: rev,
        hash,
        score: z.number().min(0).max(10),
        evidence: advisorGradeEvidenceSchema,
      })
      .strict(),
    council: z
      .object({
        id,
        revision: rev,
        hash,
        scheduleArtifactId: id,
        gradeRevisionIds: z.array(id).min(1),
        evidence: councilEvidenceSchema,
      })
      .strict(),
    gradeValues: z
      .object({
        reviewer: z.number().min(0).max(10),
        committee: z.array(z.number().min(0).max(10)).min(1),
      })
      .strict(),
    process: z.number().min(0).max(10),
    committeeScore: z.number().min(0).max(10),
    final: z.number().min(0).max(10),
    passed: z.boolean(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const ids = [r.reviewer.id, ...r.committee.map((g) => g.id)];
    if (
      new Set(ids).size !== ids.length ||
      r.committee.length !== r.gradeValues.committee.length ||
      hashJson([...ids].sort()) !==
        hashJson([...r.council.gradeRevisionIds].sort())
    )
      ctx.addIssue({
        code: "custom",
        message: "Result provenance is duplicate or incomplete.",
      });
  });
export type ResultSnapshot = z.infer<typeof resultSnapshotSchema>;
export function scoreDraft(
  draft: GradingDraft,
  rubric: z.infer<typeof criterionSchema>[],
  sealed: boolean,
) {
  const keys = new Set(rubric.map((r) => r.code));
  for (const [code, value] of Object.entries(draft.values)) {
    const criterion = rubric.find((r) => r.code === code);
    if (
      !criterion ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > criterion.maxScore
    )
      gradingError(
        422,
        "GRADE_COMPONENT_INVALID",
        "Điểm nằm ngoài rubric hiện hành.",
      );
  }
  const complete =
    keys.size === Object.keys(draft.values).length &&
    [...keys].every((k) => k in draft.values);
  if (sealed && (!complete || !draft.comment.trim()))
    gradingError(
      422,
      "GRADE_INCOMPLETE",
      "Cần đủ thành phần điểm và nhận xét trước khi gửi.",
    );
  return complete
    ? Number(
        Object.values(draft.values)
          .reduce((n, v) => n.plus(v), new Prisma.Decimal(0))
          .toString(),
      )
    : null;
}
export function assertOpen(
  config: z.infer<typeof gradingPolicySchema> | null,
  key: "REVIEWER" | "COMMITTEE" | "PUBLICATION",
  now: Date,
) {
  const w = config?.windows[key];
  if (
    !w ||
    w.isLocked ||
    now < new Date(w.opensAt) ||
    now >= new Date(w.closesAt)
  )
    gradingError(
      409,
      "GRADING_WINDOW_CLOSED",
      "Mốc chấm/công bố chưa cấu hình, chưa mở, hết hạn hoặc bị khóa.",
    );
}
/** Explicit policy only. Legacy ScoreAggregator defaults are never used. */
export function calculateGrades(
  policy: CalculationPolicy,
  advisor: number,
  reviewer: number,
  members: number[],
) {
  if (!calculationPolicySchema.safeParse(policy).success)
    gradingError(
      409,
      "CALCULATION_POLICY_UNSUPPORTED",
      "Chưa có policy tính điểm với version/quorum/làm tròn được hỗ trợ.",
    );
  if (
    !members.length ||
    [advisor, reviewer, ...members].some(
      (n) => !Number.isFinite(n) || n < 0 || n > 10,
    )
  )
    gradingError(422, "GRADE_INPUT_INVALID", "Nguồn điểm chưa hợp lệ.");
  const d = (n: number) => new Prisma.Decimal(n),
    round = (n: Prisma.Decimal, digits: number) =>
      n.toDecimalPlaces(digits, Prisma.Decimal.ROUND_HALF_UP);
  const qt = d(advisor).plus(reviewer).div(2),
    kthp = members.reduce((n, s) => n.plus(s), d(0)).div(members.length),
    process = round(qt, policy.rounding.processDecimals),
    committee = round(kthp, policy.rounding.committeeDecimals),
    // Rounding intermediate inputs is an explicit part of this policy version.
    hp = process.times("0.4").plus(committee.times("0.6")),
    final = round(hp, policy.rounding.finalDecimals);
  const pass =
    policy.rounding.passOn === "RAW"
      ? [qt, kthp, hp]
      : [process, committee, final];
  return {
    process: process.toNumber(),
    committee: committee.toNumber(),
    final: final.toNumber(),
    passed:
      pass[0].gte(policy.minimum.process) &&
      pass[1].gte(policy.minimum.committee) &&
      pass[2].gte(policy.minimum.final),
  };
}
