import { z } from 'zod';
export * from './contracts/review-groups';
export * from './contracts/proposal-reviews';
export * from './contracts/proposal-versions';

export type { Id, Instant, Revision, CurrentUserResponse, OfficialAdvisorContext, TopicAgreement, SubmittedProposalContext, GuidancePeriodContext } from './contracts/academic-context';

// Roles
export const ROLES = {
  ADMIN: 'ADMIN',
  FACULTY: 'FACULTY',
  LECTURER: 'LECTURER',
  STUDENT: 'STUDENT',
  COMMITTEE: 'COMMITTEE',
} as const;

export type RoleType = typeof ROLES[keyof typeof ROLES];

// Term Status
export const TERM_STATUS = {
  DRAFT: 'DRAFT',
  OPEN_REGISTRATION: 'OPEN_REGISTRATION',
  CLOSED_REGISTRATION: 'CLOSED_REGISTRATION',
  IN_PROGRESS: 'IN_PROGRESS',
  DEFENDING: 'DEFENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type TermStatusType = typeof TERM_STATUS[keyof typeof TERM_STATUS];

// Login Schema (dùng chung cho frontend react-hook-form + backend validation)
export const LoginSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập tối thiểu 3 ký tự'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// Registration Preferences Schema
export const RegistrationPrefSchema = z.object({
  termId: z.string().uuid(),
  lecturerIds: z.array(z.string().uuid()).min(1, 'Chọn ít nhất 1 giảng viên hướng dẫn'),
  note: z.string().optional(),
});

export type RegistrationPrefInput = z.infer<typeof RegistrationPrefSchema>;
export * from './contracts/proposal-dossiers';
export * from './contracts/guidance-tasks';
export * from './contracts/task-submissions';
export * from './contracts/guidance-reviews';
