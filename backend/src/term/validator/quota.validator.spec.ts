import { describe, expect, it } from "vitest";
import {
  allocateQuotas,
  defaultQuotaSettings,
  directionShortage,
  initialQuotaPolicy,
  quotaGroup,
  quotaReady,
  quotaRosterKey,
  QuotaPreviewSchema,
} from "@doan/shared";
import { QuotaValidator } from "./quota.validator";

const lecturers = (weights: number[], maxQuota = 20) =>
  weights.map((coefficient, i) => ({
    lecturerId: `id${i}`,
    code: `GV${String(i).padStart(2, "0")}`,
    coefficient,
    maxQuota,
    currentCount: 0,
  }));
describe("weighted quota allocation", () => {
  it("allocates 60 and 63 students across ten masters without losing seats", () => {
    expect(
      allocateQuotas(60, lecturers(Array(10).fill(0.75))).members.map(
        (m) => m.suggestedQuota,
      ),
    ).toEqual(Array(10).fill(6));
    expect(
      allocateQuotas(63, lecturers(Array(10).fill(0.75))).members.map(
        (m) => m.suggestedQuota,
      ),
    ).toEqual([7, 7, 7, 6, 6, 6, 6, 6, 6, 6]);
  });
  it("allocates 6 to each master and 8 to each doctor in the 70 student example", () => {
    const result = allocateQuotas(
      70,
      lecturers([0.75, 0.75, 0.75, 0.75, 0.75, 1, 1, 1, 1, 1]),
    );
    expect(result.members.map((m) => m.suggestedQuota)).toEqual([
      6, 6, 6, 6, 6, 8, 8, 8, 8, 8,
    ]);
    expect(result.shortage).toBe(0);
  });
  it("redistributes capped seats while retaining previously assigned students", () => {
    const input = lecturers([1, 1, 1]);
    input[0].maxQuota = 2;
    input[1].currentCount = 7;
    expect(
      allocateQuotas(15, input).members.map((m) => m.suggestedQuota),
    ).toEqual([2, 7, 6]);
    expect(() => allocateQuotas(6, input)).toThrow("tải đã phân");
    input[0].currentCount = 3;
    expect(() => allocateQuotas(15, input)).toThrow("thấp hơn tải");
  });
  it("reports insufficient capacity and supports zero-capacity lecturers", () => {
    const input = lecturers([0.75, 1], 3);
    input[0].maxQuota = 0;
    input[0].coefficient = 0;
    const result = allocateQuotas(10, input);
    expect(result.shortage).toBe(7);
    expect(result.members.map((m) => m.suggestedQuota)).toEqual([0, 3]);
    expect(allocateQuotas(2, []).shortage).toBe(2);
    expect(() => allocateQuotas(1, lecturers([0]))).toThrow("Thiếu hệ số");
  });
  it("breaks remainder ties independently of database order and preserves inputs", () => {
    const input = lecturers([0.75, 0.75, 0.75]);
    const before = JSON.stringify(input);
    const map = (rows: typeof input) =>
      Object.fromEntries(
        allocateQuotas(5, rows).members.map((m) => [
          m.lecturerId,
          m.suggestedQuota,
        ]),
      );
    expect(map(input)).toEqual(map([...input].reverse()));
    expect(JSON.stringify(input)).toBe(before);
  });
  it("keeps exact integer totals and bounds across varied demand, weights and caps", () => {
    for (let n = 1; n <= 40; n++) {
      const rows = lecturers(
        Array.from({ length: (n % 9) + 1 }, (_, i) => ((i % 4) + 1) / 4),
      );
      rows.forEach((m, i) => {
        m.maxQuota = (n + i * 7) % 20;
        m.currentCount = Math.min(m.maxQuota, i % 3);
        if (!m.maxQuota) m.coefficient = 0;
      });
      const minimum = rows.reduce((v, m) => v + m.currentCount, 0),
        capacity = rows.reduce((v, m) => v + m.maxQuota, 0);
      for (let demand = minimum; demand < minimum + 80; demand++) {
        const result = allocateQuotas(demand, rows);
        expect(result.members.reduce((v, m) => v + m.suggestedQuota, 0)).toBe(
          Math.min(demand, capacity),
        );
        result.members.forEach((m, i) => {
          expect(m.suggestedQuota).toBeGreaterThanOrEqual(rows[i].currentCount);
          expect(m.suggestedQuota).toBeLessThanOrEqual(rows[i].maxQuota);
        });
      }
    }
  });
});
describe("academic mapping, specialty capacity and approval guards", () => {
  it("uses one coefficient group and never infers credentials from a name", () => {
    expect(quotaGroup("DOCTOR", "PROFESSOR")).toBe("PROFESSOR");
    expect(quotaGroup("DOCTOR", "ASSOCIATE_PROFESSOR")).toBe(
      "ASSOCIATE_PROFESSOR",
    );
    expect(quotaGroup("MASTER", "NONE")).toBe("MASTER");
    expect(quotaGroup(null, "NONE")).toBeNull();
  });
  it("detects overlapping specialty shortages without counting a lecturer twice", () => {
    const demand = [
      { directionId: "a", count: 3 },
      { directionId: "b", count: 3 },
    ];
    expect(
      directionShortage(demand, [
        { directionIds: ["a", "b"], quota: 5 },
        { directionIds: ["c"], quota: 5 },
      ]),
    ).toBe(1);
    expect(
      directionShortage(demand, [
        { directionIds: ["a", "b"], quota: 5 },
        { directionIds: ["b"], quota: 1 },
      ]),
    ).toBe(0);
  });
  it("blocks unapproved and stale policies but preserves legacy manual terms", () => {
    const roster = [{ lecturerId: "l1", quota: 2 }],
      policy = initialQuotaPolicy();
    expect(quotaReady(null, ["s1"], roster)).toBe(true);
    expect(quotaReady(policy, ["s1"], roster)).toBe(false);
    policy.status = "APPROVED";
    policy.rosterSignature = quotaRosterKey(["s1"], roster);
    expect(quotaReady(policy, ["s1"], roster)).toBe(true);
    policy.settings.basis = "SUBMITTED";
    policy.demandStudentIds = ["s1"];
    expect(quotaReady(policy, ["s1"], roster, ["s1"])).toBe(true);
    expect(quotaReady(policy, ["s1"], roster, [])).toBe(false);
    expect(quotaReady(policy, ["s1", "s2"], roster)).toBe(false);
    expect(quotaReady(policy, ["s1"], [{ lecturerId: "l1", quota: 3 }])).toBe(
      false,
    );
    expect(() =>
      QuotaValidator.ready({
        quotaPolicy: policy,
        termStudents: [{ studentId: "s2" }],
        termLecturers: roster,
      }),
    ).toThrow("chốt lại");
    expect(() => QuotaValidator.revision(2, 1)).toThrow("vừa thay đổi");
    expect(() => QuotaValidator.revision(2, 2)).not.toThrow();
    expect(quotaReady({ status: "APPROVED" }, [], [])).toBe(false);
  });
  it("rejects invalid factors, excessive precision and noninteger limits", () => {
    const input = {
      revision: 0,
      settings: structuredClone(defaultQuotaSettings),
      limits: [],
    };
    expect(QuotaPreviewSchema.safeParse(input).success).toBe(true);
    input.settings.factors.MASTER = 0;
    expect(QuotaPreviewSchema.safeParse(input).success).toBe(false);
    input.settings.factors.MASTER = 0.12345;
    expect(QuotaPreviewSchema.safeParse(input).success).toBe(false);
    input.settings.factors.MASTER = 0.75;
    input.settings.defaultLimit = 1.5;
    expect(QuotaPreviewSchema.safeParse(input).success).toBe(false);
  });
});
