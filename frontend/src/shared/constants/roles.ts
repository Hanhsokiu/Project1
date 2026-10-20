/** Role identifiers matching backend RBAC definitions. */
export const ROLES = {
  ADMIN: 'ADMIN',
  FACULTY: 'FACULTY',
  LECTURER: 'LECTURER',
  STUDENT: 'STUDENT',
  COMMITTEE: 'COMMITTEE',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
