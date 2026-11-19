import { FinalResultPolicySchema } from "./defense-final-results";
import type {
  FinalResultPolicy,
  ResultCalculation,
  ResultSource,
  ResultComponent,
} from "./defense-final-results";
import {
  scoreFraction as f,
  addScoreFraction as add,
  weightedScoreFraction as weighted,
  formatScoreFraction as format,
  scoreFractionMatches as matches,
} from "./rubric-arithmetic";
import type { ScoreFraction, ScoreRounding } from "./rubric-arithmetic";
const fail = (code: string): never => {
  throw Error(code);
};
const compare = (a: string, b: string) => {
  const x = f(a),
    y = f(b);
  return x.n * y.d - y.n * x.d;
};
function unique(keys: string[]) {
  if (new Set(keys).size !== keys.length) fail("DUPLICATE_COMPONENT");
}
function weights(v: string[]) {
  if (
    v.some((w) => f(w).n <= 0n) ||
    !matches(
      "1",
      v.reduce((a, w) => add(a, f(w)), f("0")),
    )
  )
    fail("INVALID_WEIGHTS");
}
function mean(values: string[]): ScoreFraction {
  if (!values.length) fail("MISSING_COMPONENT");
  const sum = values.reduce((a, v) => add(a, f(v)), f("0"));
  return { n: sum.n, d: sum.d * BigInt(values.length) };
}
function rounded(v: ScoreFraction, r: ScoreRounding) {
  return format(v, r) ?? fail("ROUNDING_REQUIRED");
}
function sum(v: { value: string; weight: string }[]) {
  weights(v.map((x) => x.weight));
  return v.reduce((a, x) => add(a, weighted(x.value, "10", x.weight)), f("0"));
}
export function validateFinalResultPolicy(
  raw: unknown,
  now = new Date(),
): FinalResultPolicy {
  const parsed = FinalResultPolicySchema.safeParse(raw);
  if (!parsed.success) return fail("UNSUPPORTED_POLICY");
  const p = parsed.data;
  if (Date.parse(p.approvedAt) > now.getTime()) fail("UC24_POLICY_REQUIRED");
  unique(p.components.map((c) => c.source));
  weights(p.components.map((c) => c.weight));
  unique(p.confirmation.roles);
  unique(p.passRule?.minimumComponents.map((c) => c.source) ?? []);
  for (const w of [p.finalizeWindow, p.publication])
    if (Date.parse(w.notBefore) >= Date.parse(w.before))
      fail("INVALID_POLICY_WINDOW");
  if (
    f(p.finalStep).n <= 0n ||
    compare(p.finalStep, "10") > 0 ||
    p.finalRounding.decimalPlaces > p.storageDecimalPlaces ||
    format(f(p.finalStep), {
      mode: "EXACT",
      decimalPlaces: p.storageDecimalPlaces,
    }) === null
  )
    fail("UNSUPPORTED_STORAGE_PRECISION");
  if (
    p.components.some((c) => c.source === "ADVISOR_UC17") &&
    p.advisorSource !== "UC17_OFFICIAL_SUMMARY"
  )
    fail("ADVISOR_SOURCE_UNVERIFIED");
  if (
    !p.components.some((c) => c.source === "ADVISOR_UC17") &&
    p.advisorSource !== "NOT_USED"
  )
    fail("ADVISOR_SOURCE_UNVERIFIED");
  if (!p.components.some((c) => c.source === "COMMITTEE"))
    fail("COMMITTEE_COMPONENT_REQUIRED");
  if (p.components.some((c) => c.source === "PROCESS_UC16"))
    fail("UC16_OFFICIAL_GRADE_READER_REQUIRED");
  if (p.reviewerAggregate.mode === "WEIGHTED") {
    unique(p.reviewerAggregate.weights.map((w) => w.lecturerId));
    weights(p.reviewerAggregate.weights.map((w) => w.weight));
  }
  if (p.committeeAggregate.mode === "ROLE_WEIGHTED") {
    unique(p.committeeAggregate.weights.map((w) => w.role));
    weights(p.committeeAggregate.weights.map((w) => w.weight));
  }
  for (const r of p.passRule?.minimumComponents ?? [])
    if (
      !p.components.some((c) => c.source === r.source) ||
      compare(r.minimum, "10") > 0
    )
      fail("INVALID_PASS_RULE");
  if (p.passRule && compare(p.passRule.minimumFinal, "10") > 0)
    fail("INVALID_PASS_RULE");
  unique(
    p.classifications.map((c) => {
      const n = f(c.minimum);
      return `${n.n}/${n.d}`;
    }),
  );
  for (const c of p.classifications)
    if (compare(c.minimum, "10") > 0) fail("INVALID_CLASSIFICATION");
  return p;
}
// Inputs must be produced by CURRENT readers; this engine never infers completeness.
export function calculateFinalResult(
  raw: FinalResultPolicy,
  sources: ResultSource[],
): ResultCalculation {
  const p = validateFinalResultPolicy(raw);
  unique(sources.map((s) => `${s.source}:${s.lecturerId}`));
  unique(sources.map((s) => s.scoreEntryId));
  if (sources.some((s) => compare(s.totalScore, "10") > 0))
    fail("INVALID_SOURCE_SCORE");
  const components: Partial<Record<ResultComponent, string>> = {};
  for (const c of p.components) {
    const group = sources.filter((s) => s.source === c.source);
    if (!group.length) fail("MISSING_COMPONENT");
    if (c.source === "ADVISOR_UC17") {
      if (group.length !== 1) fail("DUPLICATE_COMPONENT");
      components[c.source] = group[0].totalScore;
    } else if (c.source === "REVIEWER") {
      const a = p.reviewerAggregate;
      if (a.mode === "MEAN")
        components[c.source] = rounded(
          mean(group.map((s) => s.totalScore)),
          a.rounding,
        );
      else {
        if (
          a.weights.length !== group.length ||
          a.weights.some(
            (w) => !group.some((s) => s.lecturerId === w.lecturerId),
          )
        )
          fail("REVIEWER_WEIGHT_BINDING_MISMATCH");
        components[c.source] = rounded(
          sum(
            a.weights.map((w) => ({
              value: group.find((s) => s.lecturerId === w.lecturerId)!
                .totalScore,
              weight: w.weight,
            })),
          ),
          a.rounding,
        );
      }
    } else if (c.source === "COMMITTEE") {
      const a = p.committeeAggregate;
      if (a.mode === "MEAN")
        components[c.source] = rounded(
          mean(group.map((s) => s.totalScore)),
          a.rounding,
        );
      else {
        const roles = [...new Set(group.map((s) => s.role))];
        if (
          roles.length !== a.weights.length ||
          a.weights.some((w) => !roles.includes(w.role))
        )
          fail("COMMITTEE_WEIGHT_BINDING_MISMATCH");
        // Each approved role weight is shared equally by its actual members. No chair bonus default.
        const value = a.weights.reduce((acc, w) => {
          const m = mean(
              group.filter((s) => s.role === w.role).map((s) => s.totalScore),
            ),
            weight = f(w.weight);
          return add(acc, { n: m.n * weight.n, d: m.d * weight.d });
        }, f("0"));
        components[c.source] = rounded(value, a.rounding);
      }
    } else fail("UC16_OFFICIAL_GRADE_READER_REQUIRED");
  }
  if (sources.some((s) => !p.components.some((c) => c.source === s.source)))
    fail("UNEXPECTED_COMPONENT");
  const finalScore = rounded(
      sum(
        p.components.map((c) => ({
          value: components[c.source]!,
          weight: c.weight,
        })),
      ),
      p.finalRounding,
    ),
    v = f(finalScore),
    step = f(p.finalStep);
  if ((v.n * step.d) % (v.d * step.n) !== 0n) fail("INVALID_FINAL_STEP");
  if (format(v, { mode: "EXACT", decimalPlaces: 1 }) === null)
    fail("UNSUPPORTED_STORAGE_PRECISION");
  return {
    components,
    committeeScore: components.COMMITTEE ?? null,
    reviewerScore: components.REVIEWER ?? null,
    finalScore,
    isPassed: p.passRule
      ? compare(finalScore, p.passRule.minimumFinal) >= 0 &&
        p.passRule.minimumComponents.every(
          (c) => compare(components[c.source]!, c.minimum) >= 0,
        )
      : null,
    classification:
      [...p.classifications]
        .sort((a, b) => (compare(a.minimum, b.minimum) > 0n ? -1 : 1))
        .find((c) => compare(finalScore, c.minimum) >= 0)?.label ?? null,
  };
}
