import { z } from "zod";

export const MAX_QUOTA = 500;
export const AcademicDegreeSchema = z.enum(["MASTER", "DOCTOR"]);
export const AcademicRankSchema = z.enum([
  "NONE",
  "ASSOCIATE_PROFESSOR",
  "PROFESSOR",
]);
export const academicDegreeLabels = { MASTER: "Thạc sĩ", DOCTOR: "Tiến sĩ" };
export const academicRankLabels = {
  NONE: "Không có",
  ASSOCIATE_PROFESSOR: "Phó giáo sư",
  PROFESSOR: "Giáo sư",
};
export const QuotaGroupSchema = z.enum([
  "MASTER",
  "DOCTOR",
  "ASSOCIATE_PROFESSOR",
  "PROFESSOR",
]);
const factor = z.number().finite().positive().max(10).multipleOf(0.0001);
const quota = z.number().int().min(0).max(MAX_QUOTA);
export const QuotaSettingsSchema = z
  .object({
    basis: z.enum(["ROSTER", "SUBMITTED"]),
    defaultLimit: quota,
    factors: z
      .object({
        MASTER: factor,
        DOCTOR: factor,
        ASSOCIATE_PROFESSOR: factor,
        PROFESSOR: factor,
      })
      .strict(),
  })
  .strict();
export type QuotaSettings = z.infer<typeof QuotaSettingsSchema>;
export const defaultQuotaSettings: QuotaSettings = {
  basis: "ROSTER",
  defaultLimit: 10,
  factors: { MASTER: 0.75, DOCTOR: 1, ASSOCIATE_PROFESSOR: 1, PROFESSOR: 1 },
};
export const QuotaPreviewSchema = z
  .object({
    revision: z.number().int().min(0),
    settings: QuotaSettingsSchema,
    limits: z
      .array(
        z.object({ lecturerId: z.string().min(1), maxQuota: quota }).strict(),
      )
      .max(2000),
  })
  .strict();
export const QuotaApproveSchema = z
  .object({
    revision: z.number().int().positive(),
    members: z
      .array(
        z
          .object({
            lecturerId: z.string().min(1),
            quota,
            reason: z.string().trim().max(1000).default(""),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();
export type QuotaPreviewInput = z.infer<typeof QuotaPreviewSchema>;
export type QuotaApproveInput = z.infer<typeof QuotaApproveSchema>;
export interface QuotaMember {
  lecturerId: string;
  code: string;
  name: string;
  academicDegree: string | null;
  academicRank: string;
  coefficient: number;
  maxQuota: number;
  currentCount: number;
  idealQuota: number;
  suggestedQuota: number;
  quota: number;
  reason: string;
}
export interface QuotaPolicy {
  version: 1;
  revision: number;
  status: "DRAFT" | "APPROVED";
  settings: QuotaSettings;
  members: QuotaMember[];
  demandCount: number;
  demandStudentIds: string[];
  totalCoefficient: number;
  averageCoefficient: number;
  shortage: number;
  warnings: string[];
  inputSignature: string;
  rosterSignature: string;
  updatedAt: string;
  updatedBy: string;
  approvedAt: string | null;
}
export const QuotaPolicySchema = z.object({
  version: z.literal(1),
  revision: z.number().int().min(0),
  status: z.enum(["DRAFT", "APPROVED"]),
  settings: QuotaSettingsSchema,
  members: z.array(
    z.object({
      lecturerId: z.string(),
      code: z.string(),
      name: z.string(),
      academicDegree: z.string().nullable(),
      academicRank: z.string(),
      coefficient: z.number().finite().min(0),
      maxQuota: quota,
      currentCount: quota,
      idealQuota: z.number().finite().min(0),
      suggestedQuota: quota,
      quota,
      reason: z.string(),
    }),
  ),
  demandCount: z.number().int().min(0),
  demandStudentIds: z.array(z.string()),
  totalCoefficient: z.number().finite().min(0),
  averageCoefficient: z.number().finite().min(0),
  shortage: z.number().int().min(0),
  warnings: z.array(z.string()),
  inputSignature: z.string(),
  rosterSignature: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  approvedAt: z.string().nullable(),
});
export function readQuotaPolicy(value: unknown): QuotaPolicy | null {
  return value == null ? null : QuotaPolicySchema.parse(value);
}
export function initialQuotaPolicy(): QuotaPolicy {
  return {
    version: 1,
    revision: 0,
    status: "DRAFT",
    settings: structuredClone(defaultQuotaSettings),
    members: [],
    demandCount: 0,
    demandStudentIds: [],
    totalCoefficient: 0,
    averageCoefficient: 0,
    shortage: 0,
    warnings: [],
    inputSignature: "",
    rosterSignature: "",
    updatedAt: "",
    updatedBy: "",
    approvedAt: null,
  };
}
export function quotaReady(
  policy: unknown,
  studentIds: string[],
  lecturers: { lecturerId: string; quota: number }[],
  submittedStudentIds?: string[],
): boolean {
  if (policy == null) return true; // Preserve manually configured legacy terms.
  const parsed = QuotaPolicySchema.safeParse(policy);
  if (
    !parsed.success ||
    parsed.data.status !== "APPROVED" ||
    parsed.data.rosterSignature !== quotaRosterKey(studentIds, lecturers)
  )
    return false;
  return (
    parsed.data.settings.basis !== "SUBMITTED" ||
    submittedStudentIds === undefined ||
    JSON.stringify([...submittedStudentIds].sort()) ===
      JSON.stringify([...parsed.data.demandStudentIds].sort())
  );
}
export function quotaGroup(
  degree?: string | null,
  rank?: string | null,
): z.infer<typeof QuotaGroupSchema> | null {
  if (rank === "PROFESSOR" || rank === "ASSOCIATE_PROFESSOR") return rank;
  return degree === "MASTER" || degree === "DOCTOR" ? degree : null;
}

/** Canonical roster identity. Academic credentials are frozen in the approved snapshot. */
export function quotaRosterKey(
  studentIds: string[],
  lecturers: { lecturerId: string; quota: number }[],
): string {
  return JSON.stringify({
    students: [...studentIds].sort(),
    lecturers: lecturers
      .map((l) => [l.lecturerId, l.quota])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "en")),
  });
}

/** Capped proportional allocation with lower bounds, followed by largest remainders.
 * Ties use lecturer code then ID, independent of input/database order. */
export function allocateQuotas(
  demand: number,
  members: {
    lecturerId: string;
    code: string;
    coefficient: number;
    maxQuota: number;
    currentCount: number;
  }[],
) {
  if (!Number.isInteger(demand) || demand < 0)
    throw new Error("Số sinh viên không hợp lệ.");
  for (const m of members) {
    if (
      !Number.isInteger(m.maxQuota) ||
      m.maxQuota < 0 ||
      m.maxQuota > MAX_QUOTA ||
      !Number.isInteger(m.currentCount) ||
      m.currentCount < 0 ||
      m.currentCount > m.maxQuota
    )
      throw new Error(
        `Giới hạn của ${m.code} không hợp lệ hoặc thấp hơn tải hiện tại.`,
      );
    if (
      !Number.isFinite(m.coefficient) ||
      m.coefficient < 0 ||
      (m.maxQuota > 0 && m.coefficient <= 0)
    )
      throw new Error(`Thiếu hệ số của ${m.code}.`);
  }
  if (new Set(members.map((m) => m.lecturerId)).size !== members.length)
    throw new Error("Giảng viên bị trùng.");
  const totalCapacity = members.reduce((n, m) => n + m.maxQuota, 0);
  const target = Math.min(demand, totalCapacity);
  if (members.reduce((n, m) => n + m.currentCount, 0) > target)
    throw new Error("Số sinh viên cần phân thấp hơn tải đã phân công.");
  let low = 0,
    high = Math.max(
      1,
      ...members.map((m) =>
        m.coefficient > 0 ? m.maxQuota / m.coefficient : 0,
      ),
    );
  for (let i = 0; i < 100; i++) {
    const scale = (low + high) / 2;
    const total = members.reduce(
      (n, m) =>
        n +
        Math.max(m.currentCount, Math.min(m.maxQuota, scale * m.coefficient)),
      0,
    );
    if (total < target) low = scale;
    else high = scale;
  }
  const result = members.map((m) => {
    const idealQuota = Math.max(
      m.currentCount,
      Math.min(m.maxQuota, high * m.coefficient),
    );
    return {
      lecturerId: m.lecturerId,
      code: m.code,
      idealQuota,
      suggestedQuota: Math.min(
        m.maxQuota,
        Math.max(m.currentCount, Math.floor(idealQuota + 1e-9)),
      ),
    };
  });
  let remaining = target - result.reduce((n, m) => n + m.suggestedQuota, 0);
  const order = result
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => m.suggestedQuota < members[i].maxQuota)
    .sort((a, b) => {
      const fraction =
        b.m.idealQuota -
        b.m.suggestedQuota -
        (a.m.idealQuota - a.m.suggestedQuota);
      return Math.abs(fraction) > 1e-9
        ? fraction
        : a.m.code.localeCompare(b.m.code, "en") ||
            a.m.lecturerId.localeCompare(b.m.lecturerId, "en");
    });
  for (const { m } of order) {
    if (remaining <= 0) break;
    m.suggestedQuota++;
    remaining--;
  }
  if (remaining !== 0)
    throw new Error("Không thể làm tròn chỉ tiêu; vui lòng kiểm tra cấu hình.");
  return { members: result, shortage: demand - target };
}

/** Maximum flow on direction groups avoids double-counting multi-specialty lecturers. */
export function directionShortage(
  demands: { directionId: string; count: number }[],
  lecturers: { directionIds: string[]; quota: number }[],
): number {
  const size = demands.length + lecturers.length + 2,
    sink = size - 1;
  const edges: { to: number; capacity: number; reverse: number }[][] =
    Array.from({ length: size }, () => []);
  const add = (from: number, to: number, capacity: number) => {
    edges[from].push({ to, capacity, reverse: edges[to].length });
    edges[to].push({ to: from, capacity: 0, reverse: edges[from].length - 1 });
  };
  const total = demands.reduce((n, d) => n + d.count, 0);
  demands.forEach((d, i) => {
    add(0, i + 1, d.count);
    lecturers.forEach((l, j) => {
      if (l.directionIds.includes(d.directionId))
        add(i + 1, 1 + demands.length + j, total);
    });
  });
  lecturers.forEach((l, j) => add(1 + demands.length + j, sink, l.quota));
  let flow = 0;
  for (;;) {
    const parent: ({ from: number; index: number } | undefined)[] = Array(size);
    const queue = [0];
    parent[0] = { from: -1, index: -1 };
    for (let k = 0; k < queue.length && !parent[sink]; k++) {
      const from = queue[k];
      edges[from].forEach((e, index) => {
        if (e.capacity > 0 && !parent[e.to]) {
          parent[e.to] = { from, index };
          queue.push(e.to);
        }
      });
    }
    if (!parent[sink]) return total - flow;
    let amount = total;
    for (let v = sink; v !== 0;) {
      const p = parent[v]!;
      amount = Math.min(amount, edges[p.from][p.index].capacity);
      v = p.from;
    }
    for (let v = sink; v !== 0;) {
      const p = parent[v]!,
        edge = edges[p.from][p.index];
      edge.capacity -= amount;
      edges[v][edge.reverse].capacity += amount;
      v = p.from;
    }
    flow += amount;
  }
}
