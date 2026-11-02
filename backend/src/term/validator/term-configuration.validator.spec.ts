import { describe, expect, it } from "vitest";
import {
  defaultPhasePlan,
  validatePhasePlan,
} from "./term-configuration.validator";

const day = 24 * 60 * 60 * 1000;

describe("default term phase schedule", () => {
  it("allocates three days each to registration and assignment, then splits the remaining time equally", () => {
    const start = new Date("2026-10-30T08:00:00+07:00");
    const end = new Date("2026-11-21T08:00:00+07:00");
    const phases = defaultPhasePlan(start, end);

    expect(phases.map((phase) => phase.code)).toEqual([
      "REGISTRATION",
      "ASSIGNMENT",
      "PROPOSAL",
      "WEEKLY",
      "FINAL",
      "DEFENSE",
    ]);
    expect(
      phases.map(
        (phase) =>
          (new Date(phase.end).getTime() - new Date(phase.start).getTime()) /
          day,
      ),
    ).toEqual([3, 3, 4, 4, 4, 4]);
    expect(phases[0].start).toBe(start.toISOString());
    expect(phases[0].end).toBe("2026-11-02T01:00:00.000Z");
    expect(phases[1].end).toBe("2026-11-05T01:00:00.000Z");
    expect(phases[5].end).toBe(end.toISOString());
    for (let index = 1; index < phases.length; index++) {
      expect(phases[index].start).toBe(phases[index - 1].end);
    }
    expect(() => validatePhasePlan(phases, start, end)).not.toThrow();
  });

  it("uses the exact term end even when the remainder cannot be divided evenly", () => {
    const start = new Date("2026-12-29T17:00:00+07:00");
    const end = new Date(start.getTime() + 10 * day + 3);
    const phases = defaultPhasePlan(start, end);
    const remainingDurations = phases
      .slice(2)
      .map(
        (phase) =>
          new Date(phase.end).getTime() - new Date(phase.start).getTime(),
      );

    expect(
      Math.max(...remainingDurations) - Math.min(...remainingDurations),
    ).toBe(1);
    expect(phases[5].end).toBe(end.toISOString());
    for (let index = 1; index < phases.length; index++) {
      expect(phases[index].start).toBe(phases[index - 1].end);
    }
  });

  it.each([3, 6])(
    "rejects a %i-day term that leaves no time for the remaining phases",
    (duration) => {
      const start = new Date("2026-10-30T00:00:00+07:00");
      expect(() =>
        defaultPhasePlan(start, new Date(start.getTime() + duration * day)),
      ).toThrowError(
        expect.objectContaining({
          response: expect.objectContaining({
            error: expect.objectContaining({
              message: expect.stringContaining(
                "Sau khi đóng đăng ký, đợt phải còn hơn 3 ngày",
              ),
            }),
          }),
        }),
      );
    },
  );

  it("keeps custom registration dates and schedules three days of assignment immediately after closing", () => {
    const start = new Date("2026-10-30T00:00:00+07:00");
    const end = new Date("2026-11-26T17:15:00+07:00");
    const phases = defaultPhasePlan(
      start,
      end,
      "2026-11-01T08:00:00+07:00",
      "2026-11-07T17:15:00+07:00",
    );
    expect(phases[0].start).toBe(
      new Date("2026-11-01T08:00:00+07:00").toISOString(),
    );
    expect(phases[0].end).toBe(
      new Date("2026-11-07T17:15:00+07:00").toISOString(),
    );
    expect(phases[1].start).toBe(phases[0].end);
    expect(phases[1].end).toBe(
      new Date("2026-11-10T17:15:00+07:00").toISOString(),
    );
    expect(
      phases
        .slice(2)
        .map(
          (phase) =>
            (new Date(phase.end).getTime() - new Date(phase.start).getTime()) /
            day,
        ),
    ).toEqual([4, 4, 4, 4]);
    expect(phases[5].end).toBe(end.toISOString());
    expect(() => validatePhasePlan(phases, start, end)).not.toThrow();
  });

  it.each([
    ["2026-10-29T08:00:00+07:00", "2026-11-02T08:00:00+07:00"],
    ["2026-11-01T08:00:00+07:00", "2026-11-01T08:00:00+07:00"],
    ["2026-11-03T08:00:00+07:00", "2026-11-01T08:00:00+07:00"],
    ["2026-11-01T08:00:00+07:00", "2026-12-01T08:00:00+07:00"],
    ["2026-11-01T08:00:00+07:00", "2026-11-28T08:00:00+07:00"],
  ])(
    "rejects invalid or insufficient custom registration windows (%s to %s)",
    (open, close) => {
      expect(() =>
        defaultPhasePlan(
          new Date("2026-10-30T00:00:00+07:00"),
          new Date("2026-11-30T23:59:59.999+07:00"),
          open,
          close,
        ),
      ).toThrow();
    },
  );

  it("requires both custom registration dates", () => {
    const start = new Date("2026-10-30T00:00:00+07:00");
    const end = new Date("2026-11-30T23:59:59.999+07:00");
    expect(() =>
      defaultPhasePlan(start, end, "2026-10-30T00:00:00+07:00"),
    ).toThrowError(
      expect.objectContaining({
        response: expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining(
              "Cần nhập cả thời điểm mở và hạn đăng ký",
            ),
          }),
        }),
      }),
    );
  });

  it("allows the saved plan to be adjusted after creation", () => {
    const start = new Date("2026-10-30T00:00:00+07:00");
    const end = new Date("2026-11-30T00:00:00+07:00");
    const phases = defaultPhasePlan(start, end);
    phases[0].end = "2026-11-03T00:00:00+07:00";
    phases[1].start = phases[0].end;
    expect(() => validatePhasePlan(phases, start, end)).not.toThrow();
  });
});
