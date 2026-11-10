import { describe, expect, it } from "vitest";
import { vietnamDateTime } from "./vietnam-time";
import { vietnamInstant } from "../../features/term/services/term-api";
import { date } from "../components/kit";
describe("Vietnam plan time round trip", () => {
  it.each([
    ["2030-11-14T17:00:00.000Z", "2030-11-15T00:00"],
    ["2030-11-15T16:59:59.999Z", "2030-11-15T23:59:59.999"],
    ["2030-11-15T01:02:03.005Z", "2030-11-15T08:02:03.005"],
    ["2030-11-15T01:02:03+00:00", "2030-11-15T08:02:03"],
  ])("preserves the UTC instant %s through the plan form", (utc, local) => {
    expect(vietnamDateTime(utc)).toBe(local);
    expect(Date.parse(vietnamInstant(vietnamDateTime(utc)))).toBe(Date.parse(utc));
  });
  it("does not reinterpret already-local inputs using the computer timezone", () => {
    expect(vietnamDateTime("2030-11-15T08:00")).toBe("2030-11-15T08:00");
    expect(vietnamDateTime("2030-11-15")).toBe("2030-11-15T00:00");
    expect(date("2030-11-15T23:30")).toBe("15/11/2030");
  });
});
