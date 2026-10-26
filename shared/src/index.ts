import { z } from "zod";
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

export type { Id, Instant, Revision, CurrentUserResponse, OfficialAdvisorContext, TopicAgreement, SubmittedProposalContext, GuidancePeriodContext } from "./contracts/academic-context";
