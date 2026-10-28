import type { DefenseConfirmation } from "@prisma/client";
import type {
  ProposalReviewSession,
  ReviewPrincipal,
  ReviewProposal,
} from "../../topic/proposal-reviews/proposal-review.repository";
import type { ReportRecord } from "../final-reports/final-report.repository";
import type { DefenseConfirmationSession } from "./defense-confirmation.repository";
import type { DecisionSnapshot } from "./defense-confirmation.types";
import { digest } from "../submissions/submission.validator";

export const bytes = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<</Type /Catalog>>\nendobj\nstartxref\n0\n%%EOF\n",
);
export const at = new Date("2026-10-26T05:00:00.000Z");
export const earlier = new Date("2026-10-25T05:00:00.000Z");
export const key = "final-reports/12345678-1234-4123-8123-123456789abc";
export function fixture() {
  const user = {
    id: "advisor-user",
    status: "ACTIVE",
    mustChangePassword: false,
    lecturer: { id: "advisor", isActive: true },
    userRoles: [
      {
        role: {
          name: "LECTURER",
          rolePermissions: [
            { permission: { resource: "guidance", action: "read" } },
          ],
        },
      },
    ],
  } as unknown as ReviewPrincipal;
  const proposal = {
    id: "proposal",
    status: "APPROVED",
    studentId: "student",
    termId: "term",
    student: {
      id: "student",
      userId: "student-user",
      isActive: true,
      studentCode: "SV01",
      fullName: "Sinh viên",
    },
    topic: {
      termId: "term",
      pr2bTopicWorkflowTopicId: {
        termId: "term",
        termStudentId: "member",
        refTermStudentId: {
          id: "member",
          termId: "term",
          studentId: "student",
        },
      },
    },
  } as unknown as ReviewProposal;
  const term = {
    id: "term",
    status: "IN_PROGRESS",
    isLocked: false,
    startDate: new Date("2026-09-01Z"),
    endDate: new Date("2027-01-01Z"),
    pr2bTermWorkflowTermId: { officialAssignmentPlanId: "assignment-plan" },
  } as unknown as NonNullable<
    Awaited<ReturnType<ProposalReviewSession["term"]>>
  >;
  const registration = {
    termId: "term",
    studentId: "student",
    advisorAssignment: {
      id: "assignment",
      advisorId: "advisor",
      advisor: { isActive: true, userId: "advisor-user", fullName: "GVHD" },
      assignmentPlan: {
        id: "assignment-plan",
        termId: "term",
        status: "FINALIZED",
        pr2bAssignmentPlanWorkflowPlanId: {
          finalizedAt: earlier,
          finalizedByUserId: "faculty-user",
        },
      },
      pr2bAssignmentChangeAssignmentId: [],
    },
  } as unknown as NonNullable<
    Awaited<ReturnType<ProposalReviewSession["advisor"]>>
  >;
  const roster = { termId: "term", lecturerId: "advisor" };
  const window = {
    termId: "term",
    opensAt: earlier,
    closesAt: new Date("2026-11-01Z"),
    isLocked: false,
    revision: 1,
    createdAt: earlier,
    updatedAt: earlier,
  };
  const report: ReportRecord = {
    id: "report",
    proposalId: "proposal",
    fileAssetId: "asset",
    filePath: null,
    revision: 1,
    submittedAt: earlier,
    createdAt: earlier,
    fileAsset: {
      id: "asset",
      storageKey: key,
      originalName: "do-an.pdf",
      kind: "REPORT",
      state: "READY",
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      checksum: digest(bytes),
      createdByUserId: "student-user",
      createdAt: earlier,
      updatedAt: earlier,
    },
  };
  const snapshot: DecisionSnapshot = {
    schemaVersion: 1,
    assignment: { assignmentId: "assignment", revision: 0 },
    pdf: {
      finalReportId: "report",
      revision: 1,
      checksum: digest(bytes),
      originalName: "do-an.pdf",
      sizeBytes: bytes.length,
      submittedAt: earlier.toISOString(),
    },
  };
  const decision: DefenseConfirmation = {
    id: "decision",
    proposalId: "proposal",
    advisorId: "advisor",
    status: "CONFIRMED",
    note: "Đồng ý",
    revision: 1,
    decidedAt: at,
    confirmedAt: at,
    createdAt: earlier,
    updatedAt: at,
    decidedByUserId: "advisor-user",
    decisionContext: snapshot,
  };
  const plan = {
    id: "guidance-plan",
    proposalId: "proposal",
    advisorId: "advisor",
    pr2bGuidancePlanWorkflowPlanId: {
      state: "ACTIVE",
      assignmentId: "assignment",
      assignmentRevision: 0,
    },
  } as unknown as NonNullable<
    Awaited<ReturnType<DefenseConfirmationSession["planFor"]>>
  >;
  const tasks = [
    {
      id: "task",
      title: "Báo cáo tuần",
      guidancePlanId: plan.id,
      status: "TODO",
      deadline: earlier,
      _count: { submissions: 0 },
      pr2bTaskWorkflowTaskId: {
        taskId: "task",
        planId: plan.id,
        state: "TODO",
        kind: "WEEKLY_REPORT",
        startsAt: earlier,
        periodId: "period",
        currentSubmissionId: null,
        refCurrentSubmissionId: null,
      },
    },
  ] as unknown as Awaited<
    ReturnType<DefenseConfirmationSession["monitorTasks"]>
  >;
  const evaluations = [
    {
      id: "evaluation",
      phaseName: "Giữa kỳ",
      score: null,
      comment: "Cần bổ sung",
      evaluatedAt: earlier,
      pr2bEvaluationWorkflowEvaluationId: {
        planId: plan.id,
        evaluatorUserId: "advisor-user",
        criteriaSnapshot: { version: 1 },
        criterionScores: [],
      },
    },
  ] as unknown as Awaited<
    ReturnType<DefenseConfirmationSession["evaluations"]>
  >;
  return {
    user,
    proposal,
    term,
    registration,
    roster,
    window,
    report,
    decision,
    snapshot,
    plan,
    tasks,
    evaluations,
  };
}

export function completedTasks() {
  const tasks = fixture().tasks;
  const w = tasks[0].pr2bTaskWorkflowTaskId!;
  tasks[0]._count.submissions = 1;
  w.state = "COMPLETED";
  w.currentSubmissionId = "submission";
  w.refCurrentSubmissionId = {
    id: "submission",
    taskId: "task",
    pr2bSubmissionWorkflowSubmissionId: {
      submissionId: "submission",
      taskId: "task",
      state: "REVIEWED",
      contextSnapshot: { planId: "guidance-plan" },
      submittedAt: earlier,
      versionNumber: 1,
      effectiveReviewId: "review",
      refEffectiveReviewId: {
        id: "review",
        submissionId: "submission",
        state: "RECORDED",
        decision: "PASS",
        recordedAt: earlier,
        comment: "Đạt",
      },
    },
  } as unknown as NonNullable<typeof w.refCurrentSubmissionId>;
  return tasks;
}
