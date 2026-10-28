export type Role = "ADMIN" | "FACULTY" | "LECTURER" | "STUDENT" | "COMMITTEE";
export interface Account {
  profileComplete?: boolean;
  permissions?: string[];
  student?: Student & { cohort?: string; trainingSystemId?: string };
  lecturer?: Lecturer;
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  roles: Role[];
  password: string;
  locked: boolean;
  mustChangePassword: boolean;
  studentId?: string;
  lecturerId?: string;
}
export interface CatalogItem {
  id: string;
  kind: "department" | "program" | "direction" | "semester";
  code: string;
  name: string;
  active: boolean;
}
export interface Student {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  className: string;
  program: string;
  departmentId: string;
  gpa: number | null;
  eligible: boolean;
}
export interface Lecturer {
  isActive?: boolean;
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  directionIds: string[];
  quota: number;
}
export type TermStatus =
  | "DRAFT"
  | "OPEN_REGISTRATION"
  | "CLOSED_REGISTRATION"
  | "IN_PROGRESS"
  | "DEFENDING"
  | "COMPLETED"
  | "CANCELLED";
export interface Phase {
  id: string;
  name: string;
  start: string;
  end: string;
  locked: boolean;
}
export interface Term {
  id: string;
  code: string;
  name: string;
  semester: string;
  program: string;
  status: TermStatus;
  start: string;
  end: string;
  registrationStart: string;
  registrationEnd: string;
  locked: boolean;
  studentIds: string[];
  lecturers: { lecturerId: string; quota: number }[];
  phases: Phase[];
  parameters: Record<string, number>;
  assignmentPublished: boolean;
  resultsPublished: boolean;
}
export interface Registration {
  id: string;
  termId: string;
  studentId: string;
  directionId: string;
  preferences: string[];
  note: string;
  status: import("@doan/shared/step2").RegistrationStatus;
  submittedAt?: string | null;
  legacyStatus?: string | null;
  updatedAt: string;
}
export interface Assignment {
  id: string;
  termId: string;
  studentId: string;
  lecturerId: string;
  preference: number;
  manual: boolean;
  reason: string;
  published: boolean;
}
export interface ProposalVersion {
  versionId?: string;
  version: number;
  at: string;
  title: string;
  objectives: string;
  scope: string;
  technology: string;
  expected: string;
  plan: { week: string; content: string }[];
  status: string;
  comment: string;
}
export interface Topic {
  workflowReady?: boolean;
  studentAgreed?: boolean;
  id: string;
  termId: string;
  studentId: string;
  lecturerId: string;
  directionId: string;
  title: string;
  advisorAgreed: boolean;
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "REVISION"
    | "APPROVED"
    | "REJECTED"
    | "LOCKED"
    | "UNDER_REVIEW";
  objectives: string;
  scope: string;
  technology: string;
  expected: string;
  plan: { week: string; content: string }[];
  versions: ProposalVersion[];
  groupId: string;
  comment: string;
}
export interface ReviewGroup {
  id: string;
  termId: string;
  name: string;
  departmentId: string;
  lecturerIds: string[];
}
export interface StoredFile {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  url?: string;
}
export interface Submission {
  id: string;
  at: string;
  content: string;
  files: StoredFile[];
  status: "SUBMITTED" | "PASS" | "FAIL" | "REVISION";
  feedback: string;
}
export interface Task {
  id: string;
  termId: string;
  studentId: string;
  lecturerId: string;
  week: number;
  title: string;
  description: string;
  deadline: string;
  progress: number;
  submissions: Submission[];
}
export interface GuidancePlan {
  id: string;
  termId: string;
  studentId: string;
  lecturerId: string;
  content: string;
  milestones: string;
  updatedAt: string;
}
export interface Meeting {
  id: string;
  termId: string;
  studentId: string;
  lecturerId: string;
  at: string;
  location: string;
  content: string;
  conclusion: string;
}
export interface FinalReport {
  id: string;
  termId: string;
  studentId: string;
  file: StoredFile;
  submittedAt: string;
  confirmed: boolean;
  comment: string;
  revisions: StoredFile[];
}
export interface Deferment {
  id: string;
  termId: string;
  studentId: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decision: string;
  mode?: "STANDARD" | "AFTER_REVIEW";
  stage?:
    | "CHO_GVPB"
    | "GVPB_DONG_Y"
    | "TU_CHOI"
    | "DA_NOP_DON"
    | "KHOA_DUYET"
    | "DA_TIEP_TUC";
  reviewerLecturerId?: string;
  reviewerScoreId?: string;
  reviewerScore?: number;
  reviewerComment?: string;
  carryOverTermId?: string;
  sourceTopicId?: string;
  submittedAt?: string;
}
export interface Committee {
  id: string;
  termId: string;
  name: string;
  members: { lecturerId: string; role: "CHAIR" | "SECRETARY" | "MEMBER" }[];
  room: string;
}
export interface Defense {
  id: string;
  termId: string;
  studentId: string;
  committeeId: string;
  reviewerId: string;
  date: string;
  start: string;
  end: string;
  room: string;
  order: number;
  minutes: string;
  revision: string;
  reviewerPublished?: boolean;
  schedulePublished?: boolean;
  revisionCompleted?: boolean;
}
export interface Criterion {
  id: string;
  name: string;
  max: number;
}
export interface Score {
  id: string;
  termId: string;
  studentId: string;
  lecturerId: string;
  kind: "ADVISOR" | "REVIEWER" | "COMMITTEE";
  values: Record<string, number>;
  total: number;
  comment: string;
  questions: string[];
  status: "DRAFT" | "SUBMITTED" | "LOCKED";
  updatedAt: string;
}
export interface ExportJob {
  id: string;
  termId: string;
  name: string;
  format: "PDF" | "XLSX";
  status: "PENDING" | "COMPLETED" | "FAILED";
  at: string;
  error: string;
  requestedBy?: string;
  reportKind?: string;
  filters?: Record<string, string | undefined>;
  completedAt?: string;
}
export interface Notification {
  channel?: "IN_APP" | "EMAIL";
  id: string;
  termId: string;
  userId: string;
  title: string;
  content: string;
  status: "SENT" | "FAILED" | "PENDING" | "PROCESSING" | "UNREAD" | "READ";
  attempts?: number;
  lastError?: string | null;
  read: boolean;
}
export interface Audit {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}
export interface ImportRow {
  row: number;
  values: Record<string, string>;
  errors: string[];
}
export interface DemoDb {
  /** API-only scope notices; omitted data must never be replaced with demo rows. */
  academicAccessWarnings?: string[];
  version: number;
  accounts: Account[];
  catalogs: CatalogItem[];
  students: Student[];
  lecturers: Lecturer[];
  terms: Term[];
  registrations: Registration[];
  assignments: Assignment[];
  topics: Topic[];
  reviewGroups: ReviewGroup[];
  plans: GuidancePlan[];
  tasks: Task[];
  meetings: Meeting[];
  finals: FinalReport[];
  deferments: Deferment[];
  committees: Committee[];
  defenses: Defense[];
  scores: Score[];
  rubrics: {
    advisor: Criterion[];
    reviewer: Criterion[];
    committee: Criterion[];
  };
  exports: ExportJob[];
  notifications: Notification[];
  audits: Audit[];
}
export interface PageRequest {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  termId?: string;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
