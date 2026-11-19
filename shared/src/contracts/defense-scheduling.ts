import { z } from "zod";
import type { EffectiveCommittee } from "./defense-committee";
import type { EffectiveReviewerAssignment } from "./defense-reviewers";
const id = z.string().trim().min(1).max(36),
  hash = z.string().regex(/^[a-f0-9]{64}$/),
  rev = z.number().int().nonnegative(),
  reason = z.string().trim().min(1).max(4000);
export const DefenseDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v + "T00:00:00Z")) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
  );
export const DefenseTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const DefensePeriodSchema = z.enum(["MORNING", "AFTERNOON"]);
const window = z
  .object({
    start: DefenseTimeSchema,
    end: DefenseTimeSchema,
    breaks: z
      .array(
        z.object({ start: DefenseTimeSchema, end: DefenseTimeSchema }).strict(),
      )
      .max(20),
  })
  .strict()
  .refine(
    (w) =>
      w.start < w.end &&
      w.breaks.every(
        (b) => b.start < b.end && b.start >= w.start && b.end <= w.end,
      ),
  );
export const SchedulePolicySchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    status: z.literal("APPROVED"),
    approvedBy: id,
    approvedAt: z.string().datetime({ offset: true }),
    reference: reason,
    phaseCode: z.enum(["FINAL", "DEFENSE"]),
    timezone: z.literal("Asia/Ho_Chi_Minh"),
    allowedDates: z.array(DefenseDateSchema).min(1).max(90),
    periods: z.object({ MORNING: window, AFTERNOON: window }).strict(),
    durationMin: z.number().int().positive().max(240),
    bufferMin: z.number().int().min(0).max(240),
    sessionBufferMin: z.number().int().min(0).max(240),
    startStepMin: z.number().int().positive().max(240),
    maxStudentsPerSession: z.number().int().positive().max(200),
    minRoomCapacity: z.number().int().positive(),
    roomAccess: z
      .array(
        z.object({ roomId: id, departmentIds: z.array(id).min(1) }).strict(),
      )
      .min(1)
      .max(100),
    reviewerAttendance: z.enum([
      "REQUIRED",
      "NOT_REQUIRED",
      "PENDING_APPROVAL",
    ]),
    nameRule: z.literal("LAST_TOKEN_MIDDLE_THEN_FAMILY"),
    compoundFamilyNames: z.array(z.string().trim().min(1).max(100)).max(100),
    manualOrderAllowed: z.boolean(),
    studentVisibility: z.boolean(),
    lecturerVisibility: z.boolean(),
    advisorCanView: z.boolean(),
    publishNotBefore: z.string().datetime({ offset: true }),
    crossTermConflicts: z.literal("ALL_TERMS"),
    legacyRule: z.literal("BLOCK_SHARED_RESOURCES_UNTIL_RECONCILED"),
  })
  .strict()
  .refine(
    (p) =>
      p.periods.MORNING.end <= p.periods.AFTERNOON.start &&
      new Set(p.allowedDates).size === p.allowedDates.length &&
      new Set(p.roomAccess.map((r) => r.roomId)).size === p.roomAccess.length,
  );
export type SchedulePolicy = z.infer<typeof SchedulePolicySchema>;
export const ScheduleSourceBindingSchema = z
  .object({
    committeeId: id,
    committeeRevision: z.number().int().positive(),
    committeeEvidenceHash: hash,
    sourceHash: hash,
  })
  .strict();
export type ScheduleSourceBinding = z.infer<typeof ScheduleSourceBindingSchema>;
export const ScheduleSaveSchema = z
  .object({
    termId: id,
    rosterHash: hash,
    expectedRevision: rev,
    reason,
    ...ScheduleSourceBindingSchema.shape,
    roomId: id,
    date: DefenseDateSchema,
    period: DefensePeriodSchema,
    startTime: DefenseTimeSchema,
    termStudentIds: z.array(id).min(1).max(200),
    manualOrder: z.array(id).min(1).max(200).optional(),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.termStudentIds).size === b.termStudentIds.length &&
      (!b.manualOrder ||
        (new Set(b.manualOrder).size === b.manualOrder.length &&
          b.manualOrder.length === b.termStudentIds.length &&
          b.manualOrder.every((i) => b.termStudentIds.includes(i)))),
  );
export type ScheduleSave = z.infer<typeof ScheduleSaveSchema>;
export const ScheduleBatchSchema = z
  .object({
    termId: id,
    rosterHash: hash,
    reason,
    sessions: z
      .array(z.object({ id: id.nullable(), body: ScheduleSaveSchema }).strict())
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (b) =>
      b.sessions.every(
        (s) => s.body.termId === b.termId && s.body.rosterHash === b.rosterHash,
      ) &&
      new Set(b.sessions.filter((s) => s.id).map((s) => s.id)).size ===
        b.sessions.filter((s) => s.id).length,
  );
export type ScheduleBatch = z.infer<typeof ScheduleBatchSchema>;
export const ScheduleCommandSchema = z
  .object({
    termId: id,
    rosterHash: hash,
    reason,
    members: z
      .array(
        z.object({ id, expectedRevision: rev, evidenceHash: hash }).strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine((b) => new Set(b.members.map((m) => m.id)).size === b.members.length);
export type ScheduleCommand = z.infer<typeof ScheduleCommandSchema>;
export const ScheduleQuerySchema = z
  .object({
    termId: id,
    date: DefenseDateSchema.optional(),
    period: DefensePeriodSchema.optional(),
    committeeId: id.optional(),
    roomId: id.optional(),
    search: z.string().trim().max(200).default(""),
    state: z
      .enum(["DRAFT", "FINALIZED", "STALE", "LEGACY_UNVERIFIED", "CANCELLED"])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();
export type ScheduleQuery = z.infer<typeof ScheduleQuerySchema>;
export const ScheduleTermQuerySchema = z.object({ termId: id }).strict();
export const ScheduleProposalQuerySchema = z
  .object({ termId: id, committeeIds: z.string().max(4000).optional() })
  .strict();
export type ScheduleSlot = {
  termStudentId: string;
  proposalId: string;
  studentCode: string;
  studentName: string;
  studentId: string;
  advisorId: string;
  order: number;
  startAt: string;
  endAt: string;
  reviewerIds: string[];
};
export type ScheduleRoom = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  departmentIds: string[];
};
export type ScheduleSource = ScheduleSourceBinding & {
  code: string;
  departmentId: string;
  members: string[];
  students: (EffectiveCommittee["students"][number] & {
    studentCode: string;
    studentName: string;
    studentId: string;
  })[];
  reviewers: EffectiveReviewerAssignment[];
  issues: string[];
};
export type EffectiveDefenseSchedule = {
  termId: string;
  committeeId: string;
  committeeRevision: number;
  committeeEvidenceHash: string;
  sessionId: string;
  roomId: string;
  date: string;
  period: "MORNING" | "AFTERNOON";
  timezone: "Asia/Ho_Chi_Minh";
  startAt: string;
  endAt: string;
  slots: ScheduleSlot[];
  revision: number;
  finalizedBy: string;
  finalizedAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
  policyVersion: string;
  policyHash: string;
  evidenceHash: string;
  effectiveStatus: "CURRENT";
};
export type ScheduleView = {
  id: string;
  termId: string;
  committeeId: string;
  committeeCode: string;
  roomId: string;
  roomName: string;
  date: string;
  period: string;
  timezone: string;
  startAt: string;
  endAt: string | null;
  startTime: string;
  revision: number;
  state: "DRAFT" | "FINALIZED" | "STALE" | "LEGACY_UNVERIFIED" | "CANCELLED";
  slots: ScheduleSlot[];
  automaticOrder: string[];
  manualOrder: boolean;
  evidenceHash: string;
  finalizedBy: string | null;
  finalizedAt: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  issues: string[];
  blockers: { update: string[]; finalize: string[]; publish: string[] };
  history: {
    id: string;
    actor: string | null;
    at: string;
    action: string;
    reason: string;
    revision: number;
  }[];
  downstream: EffectiveDefenseSchedule | null;
};
export type ScheduleWorkspace = {
  termId: string;
  mode: "FACULTY" | "PERSONAL";
  rosterHash: string;
  schemaReady: boolean;
  policy: SchedulePolicy | null;
  blockers: string[];
  rooms: ScheduleRoom[];
  sources: ScheduleSource[];
  schedules: ScheduleView[];
  permissions: {
    create: boolean;
    update: boolean;
    finalize: boolean;
    publish: boolean;
  };
};
export type ScheduleProposal = {
  status: "FEASIBLE" | "UNSAT" | "SEARCH_LIMIT" | "BLOCKED";
  rosterHash: string;
  sessions: ScheduleSave[];
  previews: {
    committeeId: string;
    roomId: string;
    date: string;
    period: string;
    slots: ScheduleSlot[];
  }[];
  reasons: string[];
  exploredNodes: number;
};
