// Exact shared arithmetic for UC22 and UC23. No grading policy defaults.
export type ScoreFraction = { n: bigint; d: bigint };
function gcd(a: bigint, b: bigint): bigint {
  return b === 0n ? a : gcd(b, a % b);
}
function reduce(n: bigint, d: bigint): ScoreFraction {
  if (d === 0n) throw Error("Invalid zero score denominator");
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export function scoreFraction(v: string): ScoreFraction {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(v) || v.length > 20)
    throw Error("Invalid score decimal");
  const [w, p = ""] = v.split(".");
  return reduce(BigInt(w + p), 10n ** BigInt(p.length));
}
export function addScoreFraction(a: ScoreFraction, b: ScoreFraction) {
  return reduce(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function weightedScoreFraction(
  score: string,
  max: string,
  weight: string,
) {
  const v = scoreFraction(score),
    m = scoreFraction(max),
    w = scoreFraction(weight);
  return reduce(v.n * m.d * w.n * 10n, v.d * m.n * w.d);
}
export function scoreFractionMatches(total: string, value: ScoreFraction) {
  const t = scoreFraction(total);
  return t.n * value.d === value.n * t.d;
}
export type ScoreRounding = {
  mode: "EXACT" | "HALF_UP" | "HALF_EVEN" | "DOWN";
  decimalPlaces: number;
};
export function formatScoreFraction(
  value: ScoreFraction,
  rounding: ScoreRounding,
): string | null {
  if (
    !Number.isInteger(rounding.decimalPlaces) ||
    rounding.decimalPlaces < 0 ||
    rounding.decimalPlaces > 6
  )
    throw Error("Unsupported score precision");
  const scale = 10n ** BigInt(rounding.decimalPlaces),
    scaled = value.n * scale;
  let q = scaled / value.d;
  const rem = scaled % value.d;
  if (rounding.mode === "EXACT" && rem !== 0n) return null;
  if (rounding.mode === "HALF_UP" && rem * 2n >= value.d) q++;
  if (
    rounding.mode === "HALF_EVEN" &&
    (rem * 2n > value.d || (rem * 2n === value.d && q % 2n !== 0n))
  )
    q++;
  const whole = q / scale,
    part = (q % scale)
      .toString()
      .padStart(rounding.decimalPlaces, "0")
      .replace(/0+$/, "");
  return part ? `${whole}.${part}` : whole.toString();
}
