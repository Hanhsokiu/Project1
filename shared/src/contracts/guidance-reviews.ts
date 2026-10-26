import { z } from "zod";
import type { GroupPage } from "./review-groups";
import type { TaskSubmissionView } from "./task-submissions";
const revision = z.number().int().nonnegative(),
  text = z.string().trim().min(1).max(20000),
  id = z.string().trim().min(1).max(100);
export const ProgressDecisionSchema = z.enum([
  "PASS",
  "FAIL",
  "REVISION_REQUIRED",
]);
const reviewFields = {
  expectedTaskRevision: revision,
  expectedSubmissionRevision: revision,
  decision: ProgressDecisionSchema,
  comment: z.string().trim().max(20000).optional(),
};
const comment = (v: { decision: string; comment?: string }) =>
  v.decision === "PASS" || !!v.comment?.trim();
export const ProgressReviewCreateSchema = z
  .object(reviewFields)
  .strict()
  .refine(comment, {
    message: "Không đạt/Cần sửa bắt buộc nhận xét.",
    path: ["comment"],
  });
export const ProgressReviewAmendSchema = z
  .object({
    ...reviewFields,
    expectedReviewRevision: revision,
    reason: z.string().trim().min(1).max(2000),
  })
  .strict()
  .refine(comment, {
    message: "Không đạt/Cần sửa bắt buộc nhận xét.",
    path: ["comment"],
  });
export const GuidanceMonitorQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    advisorId: id.optional(),
    studentId: id.optional(),
    periodId: id.optional(),
    status: z
      .enum([
        "TODO",
        "IN_PROGRESS",
        "SUBMITTED",
        "REVISION_REQUESTED",
        "COMPLETED",
        "CANCELLED",
      ])
      .optional(),
    decision: ProgressDecisionSchema.optional(),
    pending: z.enum(["true", "false"]).optional(),
    search: z.string().trim().max(255).optional(),
  })
  .strict();
const meetingFields = {
  occurredAt: z.string().datetime({ offset: true }),
  mode: z.enum(["IN_PERSON", "ONLINE"]),
  location: z.string().trim().max(1000).nullable().optional(),
  discussion: text,
  conclusion: text,
};
export const GuidanceMeetingCreateSchema = z
  .object({ expectedPlanRevision: revision, ...meetingFields })
  .strict();
export const GuidanceMeetingAmendSchema = z
  .object(meetingFields)
  .partial()
  .extend({
    expectedRevision: revision,
    reason: z.string().trim().min(1).max(2000),
  })
  .strict()
  .refine(
    (v) =>
      Object.keys(meetingFields).some(
        (k) => v[k as keyof typeof v] !== undefined,
      ),
    "Cần ít nhất một nội dung thay đổi.",
  );
export type ProgressReviewCreate = z.infer<typeof ProgressReviewCreateSchema>;
export type ProgressReviewAmend = z.infer<typeof ProgressReviewAmendSchema>;
export type GuidanceMonitorQuery = z.infer<typeof GuidanceMonitorQuerySchema>;
export type GuidanceMeetingCreate = z.infer<typeof GuidanceMeetingCreateSchema>;
export type GuidanceMeetingAmend = z.infer<typeof GuidanceMeetingAmendSchema>;
export type ProgressReviewView = {
  id: string;
  submissionId: string;
  decision: z.infer<typeof ProgressDecisionSchema>;
  comment: string | null;
  state: "RECORDED" | "SUPERSEDED";
  reviewerUserId: string;
  reviewerName: string;
  assignmentRevision: number;
  recordedAt: string;
  revision: number;
  supersedesReviewId: string | null;
  amendmentReason: string | null;
};
export type ProgressReviewContext = {
  submission: TaskSubmissionView;
  taskId: string;
  taskTitle: string;
  proposalId: string;
  termId: string;
  studentName: string;
  studentCode: string;
  periodLabel: string | null;
  taskStatus: string | null;
  taskRevision: number;
  currentSubmissionId: string | null;
  effectiveReview: ProgressReviewView | null;
  history: ProgressReviewView[];
  allowedActions: Array<"review" | "amend">;
  readiness: string[];
};
export type GuidanceMonitorRow = {
  legacyUnknown: boolean;
  taskId: string;
  planId: string;
  proposalId: string;
  termId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  advisorId: string | null;
  advisorName: string | null;
  title: string;
  periodId: string | null;
  periodLabel: string | null;
  status: string | null;
  dueDate: string;
  isOverdue: boolean;
  hasSubmission: boolean;
  submissionId: string | null;
  versionNumber: number | null;
  decision: z.infer<typeof ProgressDecisionSchema> | null;
  pendingReview: boolean;
};
export type GuidanceMonitorPage = GroupPage<GuidanceMonitorRow>;
export type GuidanceDashboard = {
  asOf: string;
  termId: string;
  metrics: {
    totalTasks: number;
    completed: number;
    notSubmitted: number;
    overdue: number;
    needsResubmission: number;
    failed: number;
    revisionRequired: number;
    pendingReview: number;
    cancelled: number;
    legacyUnknown: number;
  };
  weekly: {
    coverageState: "READY" | "NOT_CONFIGURED";
    required: number;
    submitted: number;
    missing: number;
    notDue: number;
    overdue: number;
    missingPlan: number;
    missingTask: number;
    warnings: string[];
  };
  tasks: GuidanceMonitorPage;
  advisors: Array<{ id: string; name: string }>;
  students: Array<{ id: string; name: string; code: string }>;
};
export type GuidanceMeetingView = {
  id: string;
  planId: string;
  occurredAt: string;
  mode: "IN_PERSON" | "ONLINE" | null;
  location: string | null;
  discussion: string | null;
  conclusion: string | null;
  authorUserId: string | null;
  revision: number;
  canAmend: boolean;
  history: Array<{
    id: string;
    actorId: string;
    createdAt: string;
    reason: string;
    snapshot: unknown;
  }>;
};
export type GuidanceMeetingPage = GroupPage<GuidanceMeetingView> & {
  planId: string;
  planRevision: number;
  proposalId: string;
  studentName: string;
  canCreate: boolean;
  readiness: string[];
};
export type GuidanceNotificationView = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  status: "UNREAD" | "READ";
  createdAt: string;
  readAt: string | null;
};
