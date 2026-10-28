import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { defenseConfirmationReportQuerySchema } from "./defense-confirmation-report.dto";
import { DefenseConfirmationReportValidator } from "./defense-confirmation-report.validator";
import { fixture } from "./defense-confirmation.test-fixtures";

const validator = new DefenseConfirmationReportValidator();
const snapshot = fixture().snapshot.pdf!;
const identity = {
  finalReportId: snapshot.finalReportId,
  revision: snapshot.revision,
  checksum: snapshot.checksum,
};

describe("UC17 download identity validation", () => {
  it("accepts the exact context identity and a decimal HTTP query revision", () => {
    expect(validator.input(identity)).toEqual(identity);
    expect(
      defenseConfirmationReportQuerySchema.parse({
        ...identity,
        revision: "1",
      }),
    ).toEqual(identity);
  });

  it.each([
    {},
    { finalReportId: "report", revision: 1 },
    { ...identity, revision: undefined },
    { ...identity, revision: 0 },
    { ...identity, revision: "01" },
    { ...identity, revision: "1e0" },
    { ...identity, revision: "1.0" },
    { ...identity, revision: ["1", "2"] },
    { ...identity, revision: 2147483648 },
    { ...identity, finalReportId: " " },
    { ...identity, checksum: "a".repeat(63) },
    { ...identity, checksum: "A".repeat(64) },
    { ...identity, checksum: [identity.checksum] },
    { ...identity, storageKey: "final-reports/client-key" },
    { ...identity, filePath: "C:/private/file.pdf" },
    { ...identity, actorId: "someone-else" },
  ])("rejects missing/ambiguous/client authority input %#", (input) => {
    expect(() => validator.input(input)).toThrow();
    expect(defenseConfirmationReportQuerySchema.safeParse(input).success).toBe(
      false,
    );
  });

  it("never treats a new revision with the same checksum as the viewed PDF", () => {
    expect(() => validator.expected(identity, snapshot)).not.toThrow();
    expect(() =>
      validator.expected(identity, { ...snapshot, revision: 2 }),
    ).toThrow();
  });
});
