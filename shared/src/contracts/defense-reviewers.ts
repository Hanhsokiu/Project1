import { z } from "zod";
import type { EffectiveCommittee } from "./defense-committee";
import type { EffectiveEligibility } from "./defense-eligibility";
const id = z.string().trim().min(1).max(36);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const rev = z.number().int().nonnegative();
const reason = z.string().trim().min(1).max(4000);
// All academic values must be explicitly approved; no production defaults.
export const ReviewerPolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    status: z.literal("APPROVED"),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    reference: reason,
    phaseCode: z.enum(["FINAL", "DEFENSE"]),
    reviewersPerStudent: z.number().int().positive().max(20),
    maxReviewsPerLecturer: z.number().int().positive().nullable(),
    maxTotalStudentDuties: z.number().int().positive().nullable(),
    totalLoadRule: z.literal("ADVISOR_PLUS_COMMITTEE_PLUS_REVIEW"),
    departmentRule: z.enum(["SAME_DEPARTMENT", "CROSS_DEPARTMENT"]),
    allowedTitleIds: z.array(id).min(1).nullable(),
    expertiseRule: z.enum(["NONE", "REQUIRED_AREA_MATCH"]),
    committeeMembership: z.enum(["ALLOW", "FORBID", "PENDING_APPROVAL"]),
    formerAdvisorRule: z.enum(["ALLOW", "FORBID", "PENDING_APPROVAL"]),
  })
  .strict();
export type ReviewerPolicy = z.infer<typeof ReviewerPolicySchema>;
export const ReviewerBindingSchema = z
  .object({
    termStudentId: id,
    expectedRevision: rev,
    evidenceHash: hash,
    committeeId: id,
    committeeRevision: z.number().int().positive(),
    committeeEvidenceHash: hash,
    eligibilityRevision: z.number().int().positive(),
    eligibilityEvidenceHash: hash,
    advisorHash: hash,
  })
  .strict();
export type ReviewerBinding = z.infer<typeof ReviewerBindingSchema>;
export const ReviewerPlacementSchema = ReviewerBindingSchema.extend({
  reviewerIds: z.array(id).max(20),
})
  .strict()
  .refine((b) => new Set(b.reviewerIds).size === b.reviewerIds.length, {
    message: "Không phân trùng giảng viên phản biện.",
  });
export type ReviewerPlacement = z.infer<typeof ReviewerPlacementSchema>;
const command = { termId: id, rosterHash: hash, reason };
export const ReviewerAssignSchema = z
  .object({
    ...command,
    placements: z.array(ReviewerPlacementSchema).min(1).max(200),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.placements.map((p) => p.termStudentId)).size ===
      b.placements.length,
  );
export type ReviewerAssign = z.infer<typeof ReviewerAssignSchema>;
export const ReviewerFinalizeSchema = z
  .object({
    ...command,
    members: z.array(ReviewerBindingSchema).min(1).max(200),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.members.map((p) => p.termStudentId)).size === b.members.length,
  );
export type ReviewerFinalize = z.infer<typeof ReviewerFinalizeSchema>;
export const ReviewerQuerySchema = z
  .object({
    termId: id,
    search: z.string().trim().max(200).default(""),
    state: z
      .enum(["NONE", "DRAFT", "FINALIZED", "STALE", "LEGACY_UNVERIFIED"])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();
export type ReviewerQuery = z.infer<typeof ReviewerQuerySchema>;
export const ReviewerTermQuerySchema = z.object({ termId: id }).strict();
export const ReviewerProposalQuerySchema = z
  .object({ termId: id, termStudentIds: z.string().max(8000).optional() })
  .strict();
export type ReviewerLecturer = {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  titleId: string | null;
  active: boolean;
  inRoster: boolean;
  areaIds: string[];
  reviewLoad: number;
  otherStudentDuties: number;
  totalLoad: number;
};
export type EffectiveReviewerAssignment = {
  termId: string;
  termStudentId: string;
  proposalId: string;
  committeeId: string;
  lecturerId: string;
  assignmentId: string;
  revision: number;
  finalizedAt: string;
  finalizedBy: string;
  policyVersion: string;
  policyHash: string;
  evidenceHash: string;
  eligibility: EffectiveEligibility;
  committee: Pick<
    EffectiveCommittee,
    "revision" | "evidenceHash" | "policyHash"
  >;
  committeeAssignmentRevision: number;
  advisorId: string;
  advisorHash: string;
  effectiveStatus: "CURRENT";
};
export type ReviewerView = {
  id: string;
  termId: string;
  proposalId: string | null;
  departmentId: string | null;
  studentCode: string;
  studentName: string;
  title: string;
  advisorId: string | null;
  advisorName: string | null;
  committeeId: string | null;
  committeeCode: string | null;
  revision: number;
  evidenceHash: string;
  state: "NONE" | "DRAFT" | "FINALIZED" | "STALE" | "LEGACY_UNVERIFIED";
  reviewerIds: string[];
  binding: ReviewerBinding | null;
  candidates: { lecturerId: string; reasons: string[] }[];
  issues: string[];
  blockers: { assign: string[]; finalize: string[] };
  history: {
    id: string;
    actor: string | null;
    at: string;
    action: string;
    reason: string;
    revision: number;
  }[];
  downstream: EffectiveReviewerAssignment[] | null;
};
export type ReviewerWorkspace = {
  termId: string;
  rosterHash: string;
  policy: ReviewerPolicy | null;
  schemaReady: boolean;
  blockers: string[];
  permissions: { assign: boolean; update: boolean; finalize: boolean };
  lecturers: ReviewerLecturer[];
  students: ReviewerView[];
};
export type ReviewerAllocation = {
  status: "FEASIBLE" | "UNSAT" | "SEARCH_LIMIT" | "BLOCKED";
  rosterHash: string;
  placements: ReviewerPlacement[];
  reasons: string[];
  exploredNodes: number;
  loads: { lecturerId: string; reviews: number; total: number }[];
};
