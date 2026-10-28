import { describe, expect, it } from "vitest";
import {
  canonicalDefenseListJson,
  defenseListSnapshotHash,
  defenseListSnapshotV1Schema,
  type DefenseListSnapshotV1,
} from "./defense-list-snapshot";
import { uc18Fixture } from "./uc18-finalization.test-fixtures";

describe("UC18 snapshot V1 and canonical SHA-256", () => {
  it("accepts the full roster including a student with no proposal or evidence", () => {
    expect(
      defenseListSnapshotV1Schema.safeParse(uc18Fixture().snapshot).success,
    ).toBe(true);
  });
  it("has a fixed independent SHA-256 test vector", () => {
    expect(canonicalDefenseListJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(defenseListSnapshotHash({ b: 2, a: 1 })).toBe(
      "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
    );
  });
  it("sorts nested object keys without changing Unicode or array order", () => {
    expect(
      canonicalDefenseListJson({ z: [{ b: "Đồ án", a: null }], a: true }),
    ).toBe('{"a":true,"z":[{"a":null,"b":"Đồ án"}]}');
    expect(defenseListSnapshotHash([1, 2])).not.toBe(
      defenseListSnapshotHash([2, 1]),
    );
  });
  it("is unchanged when JSONB reorders keys throughout the snapshot", () => {
    const source = uc18Fixture().snapshot;
    const reordered = JSON.parse(
      JSON.stringify(source, (_, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse())
          : value,
      ),
    );
    expect(defenseListSnapshotHash(reordered)).toBe(
      defenseListSnapshotHash(source),
    );
  });
  it.each([
    undefined,
    NaN,
    Infinity,
    new Date(),
    { a: undefined },
    [undefined],
    new Array(2),
  ])("rejects values outside persisted JSON (%s)", (value) => {
    expect(() => canonicalDefenseListJson(value)).toThrow();
  });
  const invalid: Array<[string, (s: DefenseListSnapshotV1) => void]> = [
    [
      "missing student",
      (s) => {
        s.students.pop();
      },
    ],
    [
      "missing roster member",
      (s) => {
        s.roster.members.pop();
      },
    ],
    [
      "incorrect roster count",
      (s) => {
        s.roster.count = 1;
      },
    ],
    [
      "duplicate roster ID",
      (s) => {
        s.roster.members[1].termStudentId = s.roster.members[0].termStudentId;
      },
    ],
    [
      "duplicate roster student",
      (s) => {
        s.roster.members[1].studentId = s.roster.members[0].studentId;
      },
    ],
    [
      "duplicate student entry",
      (s) => {
        s.students[1] = structuredClone(s.students[0]);
      },
    ],
    [
      "wrong student/roster pair",
      (s) => {
        s.students[0].studentId = "another-student";
      },
    ],
    [
      "extra student",
      (s) => {
        s.students.push(structuredClone(s.students[0]));
      },
    ],
    [
      "duplicate proposal",
      (s) => {
        s.students[1].proposalId = s.students[0].proposalId;
      },
    ],
    [
      "evidence without proposal",
      (s) => {
        s.students[1].pdf = s.students[0].pdf;
      },
    ],
    [
      "duplicate report",
      (s) => {
        s.students[1].proposalId = "other-proposal";
        s.students[1].pdf = s.students[0].pdf;
      },
    ],
    [
      "duplicate decision",
      (s) => {
        s.students[1].proposalId = "other-proposal";
        s.students[1].confirmation = s.students[0].confirmation;
      },
    ],
    [
      "duplicate eligibility",
      (s) => {
        s.students[1].proposalId = "other-proposal";
        s.students[1].eligibility = s.students[0].eligibility;
      },
    ],
    [
      "missing exclusion explanation",
      (s) => {
        s.students[1].exclusionReasons = [];
      },
    ],
    [
      "contradictory admission",
      (s) => {
        s.students[0].exclusionReasons = ["EXCLUDED"];
      },
    ],
  ];
  it.each(invalid)("rejects %s", (_, mutate) => {
    const { snapshot } = uc18Fixture();
    mutate(snapshot);
    expect(defenseListSnapshotV1Schema.safeParse(snapshot).success).toBe(false);
  });
  it("requires all evidence keys, rejects unknown fields and unsupported envelope versions", () => {
    const { snapshot } = uc18Fixture();
    const missing = JSON.parse(JSON.stringify(snapshot));
    delete missing.students[1].pdf;
    expect(defenseListSnapshotV1Schema.safeParse(missing).success).toBe(false);
    expect(
      defenseListSnapshotV1Schema.safeParse({
        ...snapshot,
        storageKey: "private/path",
      }).success,
    ).toBe(false);
    expect(
      defenseListSnapshotV1Schema.safeParse({ ...snapshot, schemaVersion: 2 })
        .success,
    ).toBe(false);
  });
  it("preserves legacy/missing decision data without inventing a recorded decision", () => {
    const { snapshot } = uc18Fixture();
    Object.assign(snapshot.students[0].confirmation!, {
      revision: 0,
      decidedAt: null,
      decidedByUserId: null,
      snapshot: null,
    });
    snapshot.students[0].admitted = false;
    snapshot.students[0].exclusionReasons = ["LEGACY_DECISION"];
    expect(defenseListSnapshotV1Schema.safeParse(snapshot).success).toBe(true);
  });
});
