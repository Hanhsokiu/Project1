import { z } from "zod";
export * from "./quota";
export * from "./contracts/review-groups";
export * from "./contracts/proposal-reviews";
export * from "./contracts/proposal-versions";

export type {
  Id,
  Instant,
  Revision,
  CurrentUserResponse,
  OfficialAdvisorContext,
  TopicAgreement,
  SubmittedProposalContext,
  GuidancePeriodContext,
} from "./contracts/academic-context";
import { RegistrationWriteSchema } from "./step2";
export * from "./step1";
export * from "./step2";

// Roles
export const ROLES = {
  ADMIN: "ADMIN",
  FACULTY: "FACULTY",
  LECTURER: "LECTURER",
  STUDENT: "STUDENT",
  COMMITTEE: "COMMITTEE",
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

// Term Status
export const TERM_STATUS = {
  DRAFT: "DRAFT",
  OPEN_REGISTRATION: "OPEN_REGISTRATION",
  CLOSED_REGISTRATION: "CLOSED_REGISTRATION",
  IN_PROGRESS: "IN_PROGRESS",
  DEFENDING: "DEFENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type TermStatusType = (typeof TERM_STATUS)[keyof typeof TERM_STATUS];

// Login Schema (dùng chung cho frontend react-hook-form + backend validation)
export const LoginSchema = z.object({
  username: z.string().min(3, "Tên đăng nhập tối thiểu 3 ký tự"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/** @deprecated Use RegistrationWriteSchema; termId belongs in the URL. */
export const RegistrationPrefSchema = RegistrationWriteSchema;

export type RegistrationPrefInput = z.infer<typeof RegistrationPrefSchema>;
export * from "./contracts/proposal-dossiers";
export * from "./contracts/guidance-tasks";
export * from "./contracts/task-submissions";
export * from "./contracts/guidance-reviews";
export * from "./contracts/weekly-progress";
export * from "./contracts/final-defense";
export * from "./contracts/defense-eligibility";
export * from "./contracts/defense-committee";
export * from "./contracts/defense-reviewers";
export * from "./contracts/defense-scheduling";
export * from "./contracts/defense-schedule-preview";
export * from "./contracts/defense-reviewer-grading";
export * from "./contracts/rubric-arithmetic";
export * from "./contracts/defense-committee-grading";
export * from "./contracts/defense-final-results";
export * from "./contracts/final-result-calculation";
export * from "./contracts/defense-reporting";
