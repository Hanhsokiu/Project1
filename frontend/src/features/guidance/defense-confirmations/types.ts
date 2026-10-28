// Transport types mirror the existing UC17 backend DTOs. No Prisma dependency.
export type Issue = { code: string; message: string };
export type PdfIdentity = {
  finalReportId: string;
  revision: number;
  checksum: string;
};
export type PdfSnapshot = PdfIdentity & {
  originalName: string;
  sizeBytes: number;
  submittedAt: string;
};
export type ExpectedContext = {
  revision: number;
  assignment: { assignmentId: string; revision: number };
  pdf: PdfIdentity | null;
};
export type DecisionState =
  "ABSENT" | "PENDING" | "LEGACY" | "INVALID" | "RECORDED";
export type Decision = {
  state: DecisionState;
  status: string | null;
  note: string | null;
  revision: number | null;
  decidedAt: string | null;
  confirmedAt: string | null;
  issues: Issue[];
};
export type DecisionResponse = {
  code: "DEFENSE_CONFIRMATION";
  proposalId: string;
  viewer: "ADVISOR" | "STUDENT" | "FACULTY";
  configured: boolean;
  decision: Decision & {
    decidedBy: { userId?: string; displayName: string | null } | null;
    advisor: { lecturerId?: string; fullName: string } | null;
  };
};
export type HistoryItem = {
  id: string;
  revision: number;
  status: string;
  note: string | null;
  changeReason: string | null;
  decidedAt: string | null;
  actor: { userId?: string; displayName: string | null } | null;
  advisor: { lecturerId?: string; fullName: string } | null;
  snapshotSchemaVersion: number | null;
  pdfRevision: number | null;
};
export type HistoryResponse = {
  code: "DEFENSE_CONFIRMATION_HISTORY";
  proposalId: string;
  viewer: "ADVISOR" | "FACULTY";
  currentRevision: number | null;
  historyState:
    | "AVAILABLE"
    | "EMPTY"
    | "NO_DECISION"
    | "LEGACY_WITHOUT_HISTORY"
    | "UNKNOWN";
  items: HistoryItem[];
  hasMore: boolean;
  nextAfterRevision: number | null;
};
export type ConfirmationContext = {
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
  advisor:
    | {
        state: "OFFICIAL";
        assignmentId: string;
        revision: number;
        planId: string;
        advisorId: string;
        userId: string;
        name: string;
      }
    | { state: "NOT_READY"; issues: Issue[] };
  window: {
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
    issues: Issue[];
  };
  decision: Decision & { revision: number };
  pdf: {
    state: "NOT_SUBMITTED" | "LEGACY" | "INVALID" | "UNVERIFIED" | "READY";
    finalReportId: string | null;
    revision: number;
    submittedAt: string | null;
    snapshot: PdfSnapshot | null;
    issues: Issue[];
  };
  progress: {
    dataState: "MISSING" | "PARTIAL" | "AVAILABLE";
    summary: {
      total: number;
      completed: number;
      incomplete: number;
      cancelled: number;
      unknown: number;
      overdue: number;
    };
    warnings: Issue[];
  };
  uc18:
    | { state: "OPEN"; termId: string; revision: number }
    | {
        state: "FINALIZED";
        termId: string;
        revision: number;
        finalizedAt: string;
      }
    | { state: "UNKNOWN"; termId: string; reason: string };
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
  expectedRevision: number | null;
  expectedContext: ExpectedContext | null;
  permissions: { canDecide: boolean };
  changeReasonRequiredForChanges: boolean;
  readiness: {
    confirm: { allowed: boolean; blockers: Issue[] };
    reject: { allowed: boolean; blockers: Issue[] };
  };
};
export type DecisionInput = {
  status: "CONFIRMED" | "REJECTED";
  note?: string | null;
  expectedRevision: number;
  expectedContext: ExpectedContext;
  changeReason?: string;
};
export type DecisionResult = {
  code: "DEFENSE_CONFIRMATION";
  proposalId: string;
  changed: boolean;
  decision: Decision;
  warnings: Issue[];
};
export type ReviewTerm = { id: string; name: string; status: string };
export type ReviewRow = {
  termStudentId: string;
  studentCode: string;
  studentName: string;
  proposalId: string | null;
  title: string | null;
  status: string;
  advisor: { state: string; name: string | null };
  pdf: { state: string; revision: number };
  decision: Pick<
    Decision,
    "state" | "status" | "revision" | "note" | "decidedAt"
  >;
  pdfChangedSinceDecision: boolean | null;
  advisorChangedSinceDecision: boolean | null;
  progress?: ConfirmationContext["progress"] | null;
};
export type InboxResponse = {
  view: "ADVISOR" | "STUDENT" | "FACULTY";
  termId: string;
  items: ReviewRow[];
  page: number;
  limit: number;
  total: number;
};
