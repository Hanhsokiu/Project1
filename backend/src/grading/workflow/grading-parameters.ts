import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { CalculationPolicy } from "@doan/shared";
import { hashJson } from "../../defense/workflow/defense-workflow.policy";
export const gradingParameterKeys = [
  "advisor_weight_in_process",
  "reviewer_weight_in_process",
  "process_weight",
  "committee_weight",
  "min_pass_score",
] as const;
const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    termId: z.string().min(1).max(36),
    entries: z
      .array(
        z
          .object({
            id: z.string().min(1).max(36),
            key: z.enum(gradingParameterKeys),
            value: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/),
            updatedAt: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .length(gradingParameterKeys.length),
  })
  .strict();
export const gradingParameterEvidenceSchema = z
  .object({
    snapshot: snapshotSchema,
    hash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export function verifyGradingParameters(
  raw: unknown,
  termId: string,
  now: Date,
) {
  const p = gradingParameterEvidenceSchema.safeParse(raw);
  if (!p.success) return { state: "UNKNOWN" } as const;
  const { snapshot, hash } = p.data;
  if (
    snapshot.termId !== termId ||
    new Set(snapshot.entries.map((e) => e.key)).size !==
      gradingParameterKeys.length ||
    new Set(snapshot.entries.map((e) => e.id)).size !==
      gradingParameterKeys.length ||
    snapshot.entries.some((e) => Date.parse(e.updatedAt) > now.getTime()) ||
    hashJson(snapshot) !== hash
  )
    return { state: "UNKNOWN" } as const;
  const values = Object.fromEntries(
    snapshot.entries.map((e) => [e.key, new Prisma.Decimal(e.value)]),
  ) as Record<(typeof gradingParameterKeys)[number], Prisma.Decimal>;
  if (
    snapshot.entries.some(
      (e) =>
        !values[e.key].isFinite() ||
        values[e.key].lt(0) ||
        values[e.key].gt(e.key === "min_pass_score" ? 10 : 1),
    ) ||
    !values.process_weight.plus(values.committee_weight).eq(1) ||
    !values.advisor_weight_in_process
      .plus(values.reviewer_weight_in_process)
      .eq(1)
  )
    return { state: "UNKNOWN" } as const;
  return { state: "VERIFIED", evidence: p.data, values } as const;
}
export function readGradingParameters(
  termId: string,
  rows: {
    id: string;
    termId: string;
    key: string;
    value: string;
    updatedAt: Date;
  }[],
  now: Date,
) {
  if (
    rows.some(
      (r) => r.termId !== termId || !Number.isFinite(r.updatedAt?.getTime()),
    )
  )
    return { state: "UNKNOWN" } as const;
  const snapshot = {
    schemaVersion: 1,
    termId,
    entries: rows
      .map((r) => ({
        id: r.id,
        key: r.key,
        value: r.value,
        updatedAt: r.updatedAt.toISOString(),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
  return verifyGradingParameters(
    { snapshot, hash: hashJson(snapshot) },
    termId,
    now,
  );
}
/** V1 supports the documented UTC profile only. Different configured weights
 * require a separately reviewed scheme, not silently ignored TermParameters. */
export function parametersMatchPolicy(
  parameters: ReturnType<typeof verifyGradingParameters>,
  policy: CalculationPolicy,
) {
  return (
    parameters.state === "VERIFIED" &&
    policy.scheme === "UTC_40_60_V1" &&
    parameters.values.advisor_weight_in_process.eq("0.5") &&
    parameters.values.reviewer_weight_in_process.eq("0.5") &&
    parameters.values.process_weight.eq("0.4") &&
    parameters.values.committee_weight.eq("0.6") &&
    Object.values(policy.minimum).every((n) =>
      parameters.values.min_pass_score.eq(n),
    )
  );
}
