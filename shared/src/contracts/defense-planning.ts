import { z } from "zod";

// Array caps below are preview request/resource limits, not approved term
// capacities, reviewer cardinality, quorum or limits on official business data.

const id = z.string().trim().min(1).max(36);
export const planningTermSchema = z.object({ termId: id }).strict();
export const committeeMemberSchema = z
  .object({
    lecturerId: id,
    role: z.enum(["CHAIR", "SECRETARY", "MEMBER"]),
  })
  .strict();
export const committeePlanSchema = z
  .object({
    key: id,
    name: z.string().trim().min(1).max(200),
    members: z.array(committeeMemberSchema).max(5),
    proposalIds: z.array(id).max(1000),
    // Explicit simulation assumption, never a server-authoritative term parameter.
    maxStudents: z.number().int().positive().max(1000).optional(),
  })
  .strict();
export const reviewerPlanSchema = z
  .object({ proposalId: id, reviewerIds: z.array(id).max(1000) })
  .strict();
export const scheduleSlotSchema = z
  .object({
    key: id,
    committeeKey: id,
    proposalId: id,
    roomId: id,
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .strict();
export const committeePreviewSchema = z
  .object({
    expectedContext: z.string().regex(/^[0-9a-f]{64}$/),
    committees: z.array(committeePlanSchema).max(200),
  })
  .strict();
export const reviewerPreviewSchema = committeePreviewSchema
  .extend({ reviewers: z.array(reviewerPlanSchema).max(1000) })
  .strict();
export const schedulePreviewSchema = reviewerPreviewSchema
  .extend({
    slots: z.array(scheduleSlotSchema).max(1000),
    // Attendance of reviewers at a defense is not defined by the current policy.
    // Require an explicit preview assumption, never silently assume it.
    includeReviewersAsAttendees: z.boolean(),
  })
  .strict();
export type CommitteePlan = z.infer<typeof committeePlanSchema>;
export type ReviewerPlan = z.infer<typeof reviewerPlanSchema>;
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export type CommitteePreviewInput = z.infer<typeof committeePreviewSchema>;
export type ReviewerPreviewInput = z.infer<typeof reviewerPreviewSchema>;
export type SchedulePreviewInput = z.infer<typeof schedulePreviewSchema>;
export type PlanningIssue = { code: string; message: string; target?: string };
export type PlanningStudent = {
  termStudentId: string;
  studentId: string;
  code: string | null;
  name: string | null;
  proposalId: string | null;
  title: string | null;
  admitted: boolean | null;
  advisor: {
    id: string;
    name: string;
    assignmentId: string;
    revision: number;
  } | null;
  evidence: "PRELIMINARY" | "STALE" | "UNKNOWN" | "UNCHANGED_METADATA";
};
export type PlanningLecturer = {
  id: string;
  name: string;
  departmentId: string;
};
export type PlanningRoom = { id: string; code: string; capacity: number };
export type PlanningContext = {
  code: "DEFENSE_PLANNING_CONTEXT";
  asOf: string;
  expectedContext: string;
  term: {
    id: string;
    name: string;
    status: string;
    locked: boolean;
    startsAt: string;
    endsAt: string;
  };
  uc18: { state: "OPEN" | "FINALIZED" | "UNKNOWN"; reason?: string };
  source: {
    kind: "UC18_FINALIZED" | "ROSTER_PREVIEW";
    finalizationId: string | null;
    version: number | null;
    rosterCount: number;
    admittedCount: number | null;
  };
  students: PlanningStudent[];
  lecturers: PlanningLecturer[];
  rooms: PlanningRoom[];
  capabilities: {
    canPreview: boolean;
    canCreateOfficial: false;
    canFinalize: false;
    canPublish: false;
  };
  blockers: PlanningIssue[];
};
export type PlanningPreview = {
  code: "DEFENSE_PLANNING_PREVIEW";
  stage: "COMMITTEES" | "REVIEWERS" | "SCHEDULE";
  mode: "PREVIEW_ONLY";
  persisted: false;
  expectedContext: string;
  validForPreview: boolean;
  officialReady: false;
  source: PlanningContext["source"];
  issues: PlanningIssue[];
  warnings: PlanningIssue[];
  blockers: PlanningIssue[];
  workload: { lecturerId: string; count: number }[];
  slots: ScheduleSlot[];
};
export type LegacyCommittee = {
  id: string;
  name: string;
  lifecycle: "UNVERIFIED";
  members: { lecturerId: string; name: string; role: string }[];
};
export type LegacyReviewer = {
  id: string;
  proposalId: string;
  reviewerId: string;
  assignedAt: string;
  lifecycle: "UNVERIFIED";
};
export type LegacySchedule = {
  id: string;
  committeeId: string;
  roomId: string;
  startsAt: string;
  durationMin: number;
  lifecycle: "UNVERIFIED";
  proposalIds: string[];
  hasUnscopedReferences: boolean;
};
