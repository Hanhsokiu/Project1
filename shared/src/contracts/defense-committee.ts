import { z } from "zod";
import type { EffectiveEligibility } from "./defense-eligibility";
const id = z.string().trim().min(1).max(36);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.number().int().nonnegative();
const reason = z.string().trim().min(1).max(4000);
export const CommitteeRoleSchema = z.enum(["CHAIR", "SECRETARY", "MEMBER"]);
export const CommitteeMemberInputSchema = z
  .object({ lecturerId: id, role: CommitteeRoleSchema })
  .strict();
export type CommitteeMemberInput = z.infer<typeof CommitteeMemberInputSchema>;
export const CommitteePolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    status: z.literal("APPROVED"),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    reference: reason,
    phaseCode: z.enum(["FINAL", "DEFENSE"]),
    chairCount: z.number().int().min(1).max(5),
    secretaryCount: z.number().int().min(1).max(5),
    distinctOfficers: z.literal(true),
    allowEmptyFinalization: z.boolean(),
    memberScope: z.enum(["TERM_ROSTER", "SAME_DEPARTMENT"]),
    studentScope: z.literal("SAME_DEPARTMENT"),
    allowedTitleIds: z.array(id).min(1).nullable(),
    maxCommitteesPerLecturer: z.number().int().positive().nullable(),
    maxStudentsPerCommittee: z.number().int().positive().nullable(),
    maxStudentsPerLecturer: z.number().int().positive().nullable(),
  })
  .strict()
  .refine((p) => p.chairCount + p.secretaryCount <= 5);
export type CommitteePolicy = z.infer<typeof CommitteePolicySchema>;
export const CommitteeQuerySchema = z
  .object({
    termId: id,
    search: z.string().trim().max(200).default(""),
    state: z
      .enum(["DRAFT", "FINALIZED", "STALE", "LEGACY_UNVERIFIED"])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type CommitteeQuery = z.infer<typeof CommitteeQuerySchema>;
export const CommitteeTermQuerySchema = z.object({ termId: id }).strict();
const expected = {
  termId: id,
  expectedRevision: revision,
  rosterHash: hash,
  reason,
};
const identity = {
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  departmentId: id,
};
export const CommitteeSaveSchema = z
  .object({
    ...expected,
    ...identity,
    members: z.array(CommitteeMemberInputSchema).max(5),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.members.map((m) => m.lecturerId)).size === b.members.length,
    { message: "Không thêm trùng giảng viên." },
  );
export type CommitteeSave = z.infer<typeof CommitteeSaveSchema>;
export const CommitteeFinalizeSchema = z.object(expected).strict();
export type CommitteeFinalize = z.infer<typeof CommitteeFinalizeSchema>;
export const CommitteePlacementSchema = z
  .object({
    termStudentId: id,
    committeeId: id,
    expectedAssignmentRevision: revision,
    eligibilityRevision: z.number().int().positive(),
    evidenceHash: hash,
    advisorHash: hash,
  })
  .strict();
export type CommitteePlacement = z.infer<typeof CommitteePlacementSchema>;
export const CommitteeAssignSchema = z
  .object({
    termId: id,
    rosterHash: hash,
    reason,
    committees: z
      .array(z.object({ committeeId: id, expectedRevision: revision }).strict())
      .min(1)
      .max(100),
    placements: z.array(CommitteePlacementSchema).min(1).max(200),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.placements.map((p) => p.termStudentId)).size ===
        b.placements.length &&
      new Set(b.committees.map((c) => c.committeeId)).size ===
        b.committees.length,
  );
export type CommitteeAssign = z.infer<typeof CommitteeAssignSchema>;
export const CommitteeUnassignSchema = z
  .object({
    ...expected,
    termStudentId: id,
    expectedAssignmentRevision: z.number().int().positive(),
  })
  .strict();
export type CommitteeUnassign = z.infer<typeof CommitteeUnassignSchema>;
export const CommitteeProposalQuerySchema = z
  .object({
    termId: id,
    termStudentIds: z.string().max(8000).optional(),
  })
  .strict();
export type CommitteeLecturer = {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  titleId: string | null;
  active: boolean;
  inRoster: boolean;
  committeeLoad: number;
  studentLoad: number;
};
export type CommitteeCandidate = {
  termStudentId: string;
  proposalId: string | null;
  departmentId: string | null;
  studentCode: string;
  studentName: string;
  title: string;
  eligibility: EffectiveEligibility | null;
  advisorId: string | null;
  advisorHash: string;
  advisorName: string | null;
  assignmentRevision: number;
  currentCommitteeId: string | null;
  blockers: string[];
};
export type EffectiveCommittee = {
  termId: string;
  committeeId: string;
  code: string;
  departmentId: string;
  revision: number;
  finalizedBy: string;
  finalizedAt: string;
  policyHash: string;
  evidenceHash: string;
  members: CommitteeMemberInput[];
  students: {
    termStudentId: string;
    proposalId: string;
    assignmentRevision: number;
    advisorId: string;
    advisorHash: string;
    eligibility: EffectiveEligibility;
  }[];
  effectiveStatus: "CURRENT";
};
export type CommitteeView = {
  id: string;
  termId: string;
  code: string | null;
  name: string;
  departmentId: string | null;
  revision: number;
  state: "DRAFT" | "FINALIZED" | "STALE" | "LEGACY_UNVERIFIED";
  members: (CommitteeMemberInput & { name: string; valid: boolean })[];
  students: {
    termStudentId: string;
    studentCode: string;
    studentName: string;
    advisorName: string | null;
    revision: number;
    blockers: string[];
  }[];
  issues: string[];
  blockers: { update: string[]; assign: string[]; finalize: string[] };
  history: {
    id: string;
    at: string;
    actor: string | null;
    action: string;
    reason?: string;
    revision?: number;
  }[];
  downstream: EffectiveCommittee | null;
};
export type CommitteeWorkspace = {
  termId: string;
  rosterHash: string;
  policy: CommitteePolicy | null;
  schemaReady: boolean;
  blockers: string[];
  departments: { id: string; name: string }[];
  lecturers: CommitteeLecturer[];
  committees: CommitteeView[];
  candidates: CommitteeCandidate[];
  permissions: {
    create: boolean;
    update: boolean;
    assign: boolean;
    finalize: boolean;
  };
};
export type CommitteeAllocation = {
  status: "FEASIBLE" | "UNSAT" | "SEARCH_LIMIT" | "BLOCKED";
  rosterHash: string;
  placements: CommitteePlacement[];
  committees: { committeeId: string; expectedRevision: number }[];
  reasons: string[];
  exploredNodes: number;
  loads: { committeeId: string; students: number }[];
};
