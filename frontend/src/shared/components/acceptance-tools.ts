export function acceptanceClientAllowed(dev: boolean, flag: boolean, hostname: string) {
  return dev && flag && ["127.0.0.1", "localhost", "[::1]"].includes(hostname);
}
export function isolatedAcceptanceStatus(value: unknown): value is { runId: string; testClock: string } {
  if (!value || typeof value !== "object") return false;
  const status = value as Record<string, unknown>;
  return status.kind === "ISOLATED_STAGING_TEST" && status.productionConnected === false &&
    status.backgroundWorkers === 0 && ["manual", "auto"].includes(String(status.mode)) &&
    typeof status.runId === "string" && status.runId.startsWith("DATN-E2E-B1B10-TEST-") &&
    typeof status.testClock === "string" && Number.isFinite(Date.parse(status.testClock));
}
