import { z } from "zod";
import {
  committeePlanSchema,
  reviewerPlanSchema,
  scheduleSlotSchema,
} from "./defense-planning";

export const workflowId = z.string().trim().min(1).max(36);
export const workflowRevision = z.number().int().min(0).max(2147483646);
export const workflowHash = z.string().regex(/^[0-9a-f]{64}$/);
export const defenseStageSchema = z.enum([
  "COMMITTEES",
  "REVIEWERS",
  "SCHEDULE",
]);
export type DefenseStage = z.infer<typeof defenseStageSchema>;
const windowSchema = z
  .object({
    opensAt: z.string().datetime({ offset: true }),
    closesAt: z.string().datetime({ offset: true }),
    isLocked: z.boolean(),
  })
  .strict()
  .refine(
    (w) => Date.parse(w.opensAt) < Date.parse(w.closesAt),
    "opensAt must precede closesAt",
  );
export const defenseWorkflowPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    windows: z
      .object({
        UC18: windowSchema,
        COMMITTEES: windowSchema,
        REVIEWERS: windowSchema,
        SCHEDULE: windowSchema,
      })
      .strict(),
    committeeSize: z.number().int().min(3).max(5),
    committeeCapacity: z.number().int().positive().safe(),
    reviewerWarningLoad: z.number().int().positive().optional(),
  })
  .strict();
export type DefenseWorkflowPolicy = z.infer<typeof defenseWorkflowPolicySchema>;
export const workflowCommandSchema = z
  .object({
    expectedRevision: workflowRevision,
    expectedContext: workflowHash,
    requestId: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
  })
  .strict();
export const workflowPolicyCommandSchema = workflowCommandSchema
  .extend({ policy: defenseWorkflowPolicySchema })
  .strict();
export const academicEvidenceCommandSchema = workflowCommandSchema
  .extend({
    termStudentId: workflowId,
    verdict: z.enum(["SATISFIED", "NOT_SATISFIED", "SPECIAL"]),
    sourceReference: z.string().trim().min(1).max(2000),
    note: z.string().trim().max(4000),
  })
  .strict();
export const workflowReopenSchema = workflowCommandSchema
  .extend({ reason: z.string().trim().min(1).max(4000) })
  .strict();
export const committeeDraftSchema = z
  .object({ committees: z.array(committeePlanSchema).max(200) })
  .strict();
export const reviewerDraftSchema = z
  .object({ reviewers: z.array(reviewerPlanSchema).max(1000) })
  .strict();
export const scheduleDraftSchema = z
  .object({ slots: z.array(scheduleSlotSchema).max(1000) })
  .strict();
export const stageSaveSchema = workflowCommandSchema
  .extend({
    draft: z.union([
      committeeDraftSchema,
      reviewerDraftSchema,
      scheduleDraftSchema,
    ]),
  })
  .strict();
export const scheduleAmendSchema = stageSaveSchema
  .extend({ reason: z.string().trim().min(1).max(4000) })
  .strict();
export type WorkflowCommand = z.infer<typeof workflowCommandSchema>;
export type AcademicEvidenceInput = z.infer<
  typeof academicEvidenceCommandSchema
>;
export type WorkflowPolicyInput = z.infer<typeof workflowPolicyCommandSchema>;
export type StageSaveInput = z.infer<typeof stageSaveSchema>;
export type StageDraft =
  | z.infer<typeof committeeDraftSchema>
  | z.infer<typeof reviewerDraftSchema>
  | z.infer<typeof scheduleDraftSchema>;

export type WorkflowStudent = {
  termStudentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  proposalId: string | null;
  title: string | null;
  departmentId: string | null;
  advisorId: string | null;
  advisorUserId: string | null;
  admitted: boolean;
  reasons: string[];
  academicRevision: number;
  academic: {
    id: string;
    revision: number;
    verdict: string;
    sourceReference: string;
    note: string;
    verifiedAt: string;
    verifiedByUserId: string;
  } | null;
};
export type WorkflowStageView = {
  stage: DefenseStage;
  state: "ABSENT" | "DRAFT" | "FINALIZED" | "PUBLISHED";
  revision: number;
  draft: StageDraft | null;
  artifactId: string | null;
  version: number | null;
  sourceCurrent: boolean;
  capabilities: {
    save: boolean;
    finalize: boolean;
    publish: boolean;
    amend: boolean;
  };
};
export type DefenseWorkflowContext = {
  termId: string;
  termName: string;
  serverNow: string;
  expectedContext: string;
  list: {
    state: "ABSENT" | "DRAFT" | "OPEN" | "FINALIZED";
    revision: number;
    finalizationId: string | null;
    version: number | null;
  };
  policy: DefenseWorkflowPolicy | null;
  policyRevision: number;
  students: WorkflowStudent[];
  stages: WorkflowStageView[];
  blockers: string[];
  warnings: string[];
  workload: { lecturerId: string; count: number }[];
  suggestions: { proposalId: string; reviewerIds: string[] }[];
  capabilities: {
    configure: boolean;
    verifyAcademic: boolean;
    finalize: boolean;
    reopen: boolean;
  };
};
export type PublishedDefenseSlot = {
  key: string;
  proposalId: string;
  studentName: string;
  title: string;
  committeeName: string;
  roomCode: string;
  startsAt: string;
  endsAt: string;
};
export type PublishedDefenseSchedule = {
  termId: string;
  version: number | null;
  state: "NOT_PUBLISHED" | "PUBLISHED";
  items: PublishedDefenseSlot[];
};
export type DefenseWorkflowHistory = {
  items: {
    id: string;
    stage: DefenseStage | "UC18";
    state: string;
    version: number;
    revision: number;
    sealedAt: string;
    actorId: string;
    integrity: "VERIFIED" | "UNKNOWN";
  }[];
};
