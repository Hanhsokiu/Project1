import type {
  ConfirmationContext,
  DecisionResponse,
  HistoryResponse,
} from "./types";

/** In-memory unit fixtures only. Never inserted into a database or browser storage. */
export function contextFixture(): ConfirmationContext {
  const pdf = {
    finalReportId: "report-a",
    revision: 1,
    checksum: "a".repeat(64),
  };
  return {
    code: "DEFENSE_CONFIRMATION",
    proposal: { id: "proposal-a", status: "APPROVED", studentId: "student-a" },
    student: {
      id: "student-a",
      code: "SV_API",
      name: "Sinh viên từ API",
      active: true,
    },
    term: {
      id: "term-a",
      status: "IN_PROGRESS",
      locked: false,
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2027-01-01T00:00:00Z",
    },
    asOf: "2026-10-27T12:00:00Z",
    advisor: {
      state: "OFFICIAL",
      assignmentId: "assignment-a",
      revision: 3,
      planId: "plan-a",
      advisorId: "advisor-a",
      userId: "user-a",
      name: "GVHD từ API",
    },
    window: {
      state: "OPEN",
      configured: true,
      opensAt: "2026-10-01T00:00:00Z",
      closesAt: "2026-11-01T00:00:00Z",
      locked: false,
      revision: 2,
      issues: [],
    },
    decision: {
      state: "ABSENT",
      status: null,
      note: null,
      revision: 0,
      decidedAt: null,
      confirmedAt: null,
      issues: [],
    },
    pdf: {
      state: "READY",
      finalReportId: pdf.finalReportId,
      revision: 1,
      submittedAt: "2026-10-26T00:00:00Z",
      snapshot: {
        ...pdf,
        originalName: "Đồ án.pdf",
        sizeBytes: 100,
        submittedAt: "2026-10-26T00:00:00Z",
      },
      issues: [],
    },
    progress: {
      dataState: "PARTIAL",
      summary: {
        total: 3,
        completed: 1,
        incomplete: 1,
        unknown: 1,
        cancelled: 0,
        overdue: 1,
      },
      warnings: [
        { code: "TASK_INCOMPLETE", message: "Nhiệm vụ chưa hoàn thành" },
      ],
    },
    uc18: { state: "OPEN", termId: "term-a", revision: 1 },
    pdfChangedSinceDecision: null,
    advisorChangedSinceDecision: null,
    confirmationApplicableToCurrentContext: null,
    legacy: {
      decision: false,
      pdf: false,
      plan: false,
      tasks: 0,
      evaluations: 0,
    },
    expectedRevision: 0,
    expectedContext: {
      revision: 0,
      assignment: { assignmentId: "assignment-a", revision: 3 },
      pdf,
    },
    permissions: { canDecide: true },
    changeReasonRequiredForChanges: false,
    readiness: {
      confirm: { allowed: true, blockers: [] },
      reject: { allowed: true, blockers: [] },
    },
  };
}
export function decisionFixture(): DecisionResponse {
  return {
    code: "DEFENSE_CONFIRMATION",
    proposalId: "proposal-a",
    viewer: "ADVISOR",
    configured: false,
    decision: {
      ...contextFixture().decision,
      revision: null,
      decidedBy: null,
      advisor: null,
    },
  };
}
export function historyFixture(): HistoryResponse {
  return {
    code: "DEFENSE_CONFIRMATION_HISTORY",
    proposalId: "proposal-a",
    viewer: "ADVISOR",
    currentRevision: null,
    historyState: "NO_DECISION",
    items: [],
    hasMore: false,
    nextAfterRevision: null,
  };
}
