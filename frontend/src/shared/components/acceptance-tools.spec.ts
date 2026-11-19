import { describe, expect, it } from "vitest";
import { acceptanceClientAllowed, isolatedAcceptanceStatus } from "./acceptance-tools";
describe("acceptance tools isolation", () => {
  it("hides tools in a production build even with the flag set and a loopback host", () => {
    expect(acceptanceClientAllowed(false, true, "127.0.0.1")).toBe(false);
    expect(acceptanceClientAllowed(true, true, "faculty.example.edu")).toBe(false);
    expect(acceptanceClientAllowed(true, false, "localhost")).toBe(false);
    expect(acceptanceClientAllowed(true, true, "127.0.0.1")).toBe(true);
  });
  const valid = { kind: "ISOLATED_STAGING_TEST", mode: "manual", productionConnected: false,
    backgroundWorkers: 0, runId: "DATN-E2E-B1B10-TEST-owned", testClock: "2030-01-01T00:00:00Z" };
  it("requires the backend to attest isolated staging rather than trusting the frontend flag", () => {
    expect(isolatedAcceptanceStatus(valid)).toBe(true);
    for (const patch of [{ productionConnected: true }, { backgroundWorkers: 1 }, { kind: "PRODUCTION" },
      { runId: "other" }, { mode: "shared" }, { testClock: "bad" }]) {
      expect(isolatedAcceptanceStatus({ ...valid, ...patch })).toBe(false);
    }
    expect(isolatedAcceptanceStatus(null)).toBe(false);
  });
});
