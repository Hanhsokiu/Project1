import { z } from "zod";
import { hashJson } from "../../defense/workflow/defense-workflow.policy";

const id = z.string().trim().min(1).max(36);
const revision = z.number().int().positive();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const reference = z.object({ id, revision, hash }).strict();
const metadata = z
  .object({
    schemaVersion: z.literal(1),
    termId: id,
    proposalId: id,
    recordedAt: z.string().datetime({ offset: true }),
    recordedByUserId: id,
    // A producer must verify this authority, not infer it from a council role.
    authorityReference: z.string().trim().min(1).max(2000),
  })
  .strict();

export const advisorGradeEvidenceSchema = z
  .object({
    state: z.literal("VERIFIED"),
    id,
    revision,
    hash,
    score: z.number().min(0).max(10),
    advisorUserId: id,
    assignment: z
      .object({ assignmentId: id, revision: z.number().int().min(0) })
      .strict(),
    pdf: z.object({ finalReportId: id, revision, checksum: hash }).strict(),
    evidence: metadata,
  })
  .strict();

export const councilEvidenceSchema = z
  .object({
    state: z.literal("VERIFIED"),
    id,
    revision,
    contentHash: hash,
    scheduleArtifactId: id,
    gradeRevisionIds: z.array(id).min(1),
    evidence: metadata
      .extend({
        schedule: reference,
        grades: z.array(reference).min(1),
      })
      .strict(),
  })
  .strict();
export type VerifiedAdvisorGrade = z.infer<typeof advisorGradeEvidenceSchema>;
export type VerifiedCouncilConfirmation = z.infer<typeof councilEvidenceSchema>;
export const unknownGradeEvidence = { state: "UNKNOWN" } as const;

/** Canonical JSON SHA-256 of the complete versioned evidence, not a hash-shaped string.
 * This proves integrity/binding only. Trust/authority remains the producer's duty.
 * Neither helper queries a database or promotes legacy values. */
export function gradeEvidenceHash(value: Record<string, unknown>) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !["state", "hash", "contentHash"].includes(key),
    ),
  );
  return hashJson(payload);
}
export function verifyAdvisorGrade(
  raw: unknown,
  termId: string,
  proposalId: string,
  now: Date,
) {
  const p = advisorGradeEvidenceSchema.safeParse(raw);
  if (!p.success) return unknownGradeEvidence;
  const a = p.data;
  return a.evidence.termId === termId &&
    a.evidence.proposalId === proposalId &&
    a.evidence.recordedByUserId === a.advisorUserId &&
    Date.parse(a.evidence.recordedAt) <= now.getTime() &&
    gradeEvidenceHash(a) === a.hash
    ? a
    : unknownGradeEvidence;
}
export function verifyCouncilConfirmation(
  raw: unknown,
  termId: string,
  proposalId: string,
  now: Date,
  schedule: z.infer<typeof reference>,
  grades: z.infer<typeof reference>[],
) {
  const p = councilEvidenceSchema.safeParse(raw);
  if (!p.success) return unknownGradeEvidence;
  const a = p.data;
  const ordered = (refs: z.infer<typeof reference>[]) =>
    [...refs].sort((x, y) => x.id.localeCompare(y.id));
  return a.evidence.termId === termId &&
    a.evidence.proposalId === proposalId &&
    Date.parse(a.evidence.recordedAt) <= now.getTime() &&
    a.scheduleArtifactId === schedule.id &&
    hashJson(a.evidence.schedule) === hashJson(schedule) &&
    new Set(a.gradeRevisionIds).size === a.gradeRevisionIds.length &&
    new Set(a.evidence.grades.map((g) => g.id)).size ===
      a.evidence.grades.length &&
    hashJson([...a.gradeRevisionIds].sort()) ===
      hashJson(grades.map((g) => g.id).sort()) &&
    hashJson(ordered(a.evidence.grades)) === hashJson(ordered(grades)) &&
    gradeEvidenceHash(a) === a.contentHash
    ? a
    : unknownGradeEvidence;
}
