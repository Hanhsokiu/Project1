import type { Uc18Finalization } from "../../common/contracts/uc18-finalization.port";

export type ContextIssue = { code: string; message: string };
export type AssignmentSnapshot = { assignmentId: string; revision: number };
export type PdfSnapshot = {
  finalReportId: string;
  revision: number;
  checksum: string;
  originalName: string;
  sizeBytes: number;
  submittedAt: string;
};
export type DecisionSnapshot = {
  schemaVersion: 1;
  assignment: AssignmentSnapshot;
  pdf: PdfSnapshot | null;
};
export type OfficialAdvisorContext =
  | {
      state: "OFFICIAL";
      assignmentId: string;
      revision: number;
      planId: string;
      advisorId: string;
      userId: string;
      name: string;
    }
  | { state: "NOT_READY"; issues: ContextIssue[] };
export type PdfContext = {
  state: "NOT_SUBMITTED" | "LEGACY" | "INVALID" | "UNVERIFIED" | "READY";
  finalReportId: string | null;
  revision: number;
  submittedAt: string | null;
  snapshot: PdfSnapshot | null;
  issues: ContextIssue[];
};
export type DecisionContext = {
  state: "ABSENT" | "PENDING" | "LEGACY" | "INVALID" | "RECORDED";
  id: string | null;
  status: string | null;
  revision: number;
  advisorId: string | null;
  note: string | null;
  confirmedAt: string | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  snapshot: DecisionSnapshot | null;
  issues: ContextIssue[];
};
export type WindowContext = {
  state:
    | "NOT_CONFIGURED"
    | "INVALID"
    | "TERM_LOCKED"
    | "LOCKED"
    | "NOT_OPEN"
    | "CLOSED"
    | "OPEN";
  configured: boolean;
  opensAt: string | null;
  closesAt: string | null;
  locked: boolean | null;
  revision: number;
  issues: ContextIssue[];
};
export type TaskContext = {
  id: string;
  title: string;
  state: string | null;
  dataState: "READY" | "LEGACY" | "INCONSISTENT";
  completion: "COMPLETE" | "INCOMPLETE" | "CANCELLED" | "UNKNOWN";
  deadline: string | null;
  overdue: boolean | null;
  progressNotes: Array<{
    id: string;
    note: string;
    actorId: string;
    createdAt: string;
  }>;
  submission: { id: string; version: number; submittedAt: string } | null;
  review: {
    id: string;
    decision: string;
    comment: string | null;
    recordedAt: string;
  } | null;
};
export type ProgressContext = {
  dataState: "MISSING" | "PARTIAL" | "AVAILABLE";
  plan: {
    id: string;
    state: string | null;
    legacy: boolean;
    assignmentChanged: boolean | null;
  } | null;
  tasks: TaskContext[];
  summary: {
    total: number;
    completed: number;
    incomplete: number;
    cancelled: number;
    unknown: number;
    overdue: number;
  };
  evaluations: Array<{
    id: string;
    phaseName: string;
    score: number | null;
    comment: string | null;
    evaluatedAt: string | null;
    dataState: "AVAILABLE" | "LEGACY";
  }>;
  warnings: ContextIssue[];
};
export type ExpectedDecisionContext = {
  revision: number;
  assignment: AssignmentSnapshot;
  pdf: { finalReportId: string; revision: number; checksum: string } | null;
};
export type DefenseConfirmationContext = {
  code: "DEFENSE_CONFIRMATION";
  proposal: { id: string; status: string; studentId: string };
  student: { id: string; code: string; name: string; active: boolean };
  term: {
    id: string;
    status: string;
    locked: boolean;
    startsAt: string;
    endsAt: string;
  };
  asOf: string;
  advisor: OfficialAdvisorContext;
  window: WindowContext;
  decision: DecisionContext;
  pdf: PdfContext;
  progress: ProgressContext;
  uc18: Uc18Finalization;
  pdfChangedSinceDecision: boolean | null;
  advisorChangedSinceDecision: boolean | null;
  confirmationApplicableToCurrentContext: boolean | null;
  legacy: {
    decision: boolean;
    pdf: boolean;
    plan: boolean;
    tasks: number;
    evaluations: number;
  };
  readiness: {
    confirm: { allowed: boolean; blockers: ContextIssue[] };
    reject: { allowed: boolean; blockers: ContextIssue[] };
  };
};
