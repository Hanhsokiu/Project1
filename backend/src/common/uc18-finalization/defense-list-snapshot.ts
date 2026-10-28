import { createHash } from "node:crypto";
import { z } from "zod";
import { defenseWorkflowPolicySchema } from "@doan/shared";

export const DEFENSE_LIST_SNAPSHOT_SCHEMA_VERSION = 1;
const id = z
  .string()
  .min(1)
  .max(36)
  .refine((v) => v.trim() === v);
const revision = z.number().int().min(0).max(2147483647);
const positive = revision.refine((v) => v > 0);
const instant = z.string().datetime({ offset: true });
const checksum = z.string().regex(/^[0-9a-f]{64}$/);
const assignment = z.object({ assignmentId: id, revision }).strict();
const pdf = z
  .object({
    finalReportId: id,
    revision: positive,
    checksum,
    originalName: z.string().min(1),
    sizeBytes: z.number().int().positive().safe(),
    submittedAt: instant,
  })
  .strict();
const decisionContext = z
  .object({
    schemaVersion: z.literal(1),
    assignment,
    pdf: pdf.nullable(),
  })
  .strict();
const member = z.object({ termStudentId: id, studentId: id }).strict();
const student = member
  .extend({
    // Missing/legacy evidence is retained explicitly, never filtered out.
    proposalId: id.nullable(),
    pdf: pdf.nullable(),
    confirmation: z
      .object({
        id,
        revision,
        status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]),
        advisorId: id,
        decidedAt: instant.nullable(),
        decidedByUserId: id.nullable(),
        snapshot: decisionContext.nullable(),
      })
      .strict()
      .nullable(),
    eligibility: z
      .object({
        id,
        status: z.enum(["PENDING", "ELIGIBLE", "INELIGIBLE", "DEFERRED"]),
        checkedAt: instant.nullable(),
        note: z.string().nullable(),
      })
      .strict()
      .nullable(),
    admitted: z.boolean(),
    exclusionReasons: z.array(z.string().min(1)),
  })
  .strict();

/** V1 wire contract shared with the future UC18 producer.
 * roster is the FULL frozen TermStudent manifest, students includes every member,
 * and admitted identifies the separate defense subset. Null evidence is explicit.
 * This validates historical structure/coverage, not academic eligibility rules or
 * current database contents. The producer must capture the full roster atomically.
 * Any envelope/field change requires a new snapshotSchemaVersion.
 */
export const defenseListSnapshotV1Schema = z
  .object({
    schemaVersion: z.literal(DEFENSE_LIST_SNAPSHOT_SCHEMA_VERSION),
    termId: id,
    listRevision: positive,
    finalizationVersion: positive,
    finalizedAt: instant,
    finalizedByUserId: id,
    roster: z.object({ count: revision, members: z.array(member) }).strict(),
    students: z.array(student),
  })
  .strict()
  .superRefine((value, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (
      value.roster.count !== value.roster.members.length ||
      value.students.length !== value.roster.count
    )
      fail("Incomplete roster coverage");
    const roster = new Map<string, string>(),
      studentIds = new Set<string>();
    for (const m of value.roster.members) {
      if (roster.has(m.termStudentId) || studentIds.has(m.studentId))
        fail("Duplicate roster member");
      roster.set(m.termStudentId, m.studentId);
      studentIds.add(m.studentId);
    }
    const members = new Set<string>(),
      students = new Set<string>(),
      proposals = new Set<string>();
    const evidenceIds = {
      pdf: new Set<string>(),
      confirmation: new Set<string>(),
      eligibility: new Set<string>(),
    };
    for (const s of value.students) {
      if (members.has(s.termStudentId) || students.has(s.studentId))
        fail("Duplicate student entry");
      if (roster.get(s.termStudentId) !== s.studentId)
        fail("Student not in captured roster");
      if (s.proposalId !== null) {
        if (proposals.has(s.proposalId)) fail("Duplicate proposal");
        proposals.add(s.proposalId);
      } else if (
        s.pdf !== null ||
        s.confirmation !== null ||
        s.eligibility !== null
      ) {
        fail("Proposal evidence without a proposal");
      }
      if (
        s.admitted
          ? s.exclusionReasons.length !== 0
          : s.exclusionReasons.length === 0
      )
        fail("Missing or contradictory admission explanation");
      for (const [kind, evidenceId] of [
        ["pdf", s.pdf?.finalReportId],
        ["confirmation", s.confirmation?.id],
        ["eligibility", s.eligibility?.id],
      ] as const) {
        if (!evidenceId) continue;
        if (evidenceIds[kind].has(evidenceId))
          fail("Duplicate evidence identifier");
        evidenceIds[kind].add(evidenceId);
      }
      members.add(s.termStudentId);
      students.add(s.studentId);
    }
  });
export type DefenseListSnapshotV1 = z.infer<typeof defenseListSnapshotV1Schema>;

export const academicProofSchema = z
  .object({
    id,
    termId: id,
    termStudentId: id,
    studentId: id,
    revision: positive,
    verdict: z.enum(["SATISFIED", "NOT_SATISFIED", "SPECIAL"]),
    sourceReference: z.string().trim().min(1).max(2000),
    note: z.string().max(4000),
    schemaVersion: z.literal(1),
    verifiedAt: instant,
    verifiedByUserId: id,
    contentHash: checksum,
  })
  .strict();
export type AcademicProof = z.infer<typeof academicProofSchema>;
export function academicProofHash(proof: Omit<AcademicProof, "contentHash">) {
  return defenseListSnapshotHash(proof);
}
export const defenseListSnapshotV2Schema = defenseListSnapshotV1Schema
  .innerType()
  .extend({
    schemaVersion: z.literal(2),
    policyRevision: positive,
    policy: defenseWorkflowPolicySchema,
    academicEvidence: z.array(
      z
        .object({
          termStudentId: id,
          studentId: id,
          proposalStatus: z.string().min(1).max(50).nullable(),
          proof: academicProofSchema.nullable(),
          advisorUserId: id.nullable(),
          assignment: assignment.nullable(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((s, ctx) => {
    const { academicEvidence } = s;
    const base = Object.fromEntries(
      Object.entries(s).filter(
        ([key]) =>
          !["policyRevision", "policy", "academicEvidence"].includes(key),
      ),
    );
    const v1 = defenseListSnapshotV1Schema.safeParse({
      ...base,
      schemaVersion: 1,
    });
    if (!v1.success) for (const issue of v1.error.issues) ctx.addIssue(issue);
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (academicEvidence.length !== s.roster.count)
      fail("Incomplete academic evidence coverage");
    const seen = new Set<string>();
    for (const a of academicEvidence) {
      const row = s.students.find(
        (r) =>
          r.termStudentId === a.termStudentId && r.studentId === a.studentId,
      );
      if (!row || seen.has(a.termStudentId)) {
        fail("Invalid academic roster");
        continue;
      }
      seen.add(a.termStudentId);
      if (a.proof) {
        const { contentHash, ...proof } = a.proof;
        if (
          proof.termId !== s.termId ||
          proof.termStudentId !== a.termStudentId ||
          proof.studentId !== a.studentId ||
          academicProofHash(proof) !== contentHash ||
          Date.parse(proof.verifiedAt) > Date.parse(s.finalizedAt)
        )
          fail("Invalid academic proof");
      }
      if (row.admitted) {
        const c = row.confirmation,
          pdf = row.pdf;
        if (
          !row.proposalId ||
          a.proposalStatus !== "APPROVED" ||
          a.proof?.verdict !== "SATISFIED" ||
          !a.assignment ||
          !a.advisorUserId ||
          !pdf ||
          !c ||
          c.revision <= 0 ||
          c.status !== "CONFIRMED" ||
          c.decidedByUserId !== a.advisorUserId ||
          !c.decidedAt ||
          !c.snapshot ||
          c.snapshot.assignment.assignmentId !== a.assignment.assignmentId ||
          c.snapshot.assignment.revision !== a.assignment.revision ||
          c.snapshot.pdf?.finalReportId !== pdf.finalReportId ||
          c.snapshot.pdf.revision !== pdf.revision ||
          c.snapshot.pdf.checksum !== pdf.checksum
        )
          fail("Admission lacks current official academic/UC17/PDF proof");
      }
    }
  });
export type DefenseListSnapshotV2 = z.infer<typeof defenseListSnapshotV2Schema>;
export const defenseListSnapshotSchema = z.union([
  defenseListSnapshotV1Schema,
  defenseListSnapshotV2Schema,
]);

/** Canonical V1: JSON scalars, recursive lexicographic object keys, array order
 * preserved, JSON.stringify number/string encoding, UTF-8, no whitespace.
 * Independent of JSONB object key order. Never hash a stripped/transformed parse.
 * Not RFC 8785; future producers must use this exact helper and persist JSON only.
 */
export function canonicalDefenseListJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length)
      throw new Error("Non-JSON array");
    return `[${value.map(canonicalDefenseListJson).join(",")}]`;
  }
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalDefenseListJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Non-JSON snapshot value");
}
export function defenseListSnapshotHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalDefenseListJson(value), "utf8")
    .digest("hex");
}
