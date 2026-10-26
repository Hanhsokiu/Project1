/** Missing academic data never satisfies a GPA threshold, including a threshold of zero. */
export function hasEligibleGpa(
  value: number | null | undefined,
  minimum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 4 &&
    value >= minimum
  );
}
export function formatGpa(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "—";
}
