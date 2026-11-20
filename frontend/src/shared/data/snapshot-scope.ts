// These are data dependencies, never authorization rules. Route guards and API
// permissions remain responsible for access control.
const all = {
  students: true,
  lecturers: true,
  accounts: true,
  directions: true,
  registrations: true,
  assignments: true,
  topics: true,
  outbox: true,
  audits: true,
  lookups: true,
  termScoped: false,
};
const shell = {
  students: false,
  lecturers: false,
  accounts: false,
  directions: false,
  registrations: false,
  assignments: false,
  topics: false,
  outbox: false,
  audits: false,
  lookups: false,
  termScoped: false,
};
export const snapshotPlans = {
  full: all,
  dashboard: { ...all, termScoped: true },
  "student-directory": { ...shell, lookups: true },
  shell,
  profile: { ...shell, lookups: true, directions: true },
  accounts: {
    ...shell,
    lookups: true,
    students: true,
    lecturers: true,
    accounts: true,
    directions: true,
  },
  roles: { ...shell, accounts: true },
  audit: { ...shell, audits: true },
  reference: {
    ...shell,
    lookups: true,
    students: true,
    lecturers: true,
    directions: true,
  },
  terms: { ...shell, lookups: true },
  "term-detail": {
    ...shell,
    registrations: true,
    assignments: true,
    topics: true,
    termScoped: true,
  },
  roster: {
    ...shell,
    students: true,
    lecturers: true,
    assignments: true,
    directions: true,
    termScoped: true,
  },
  lecturers: {
    ...shell,
    lecturers: true,
    assignments: true,
    directions: true,
    termScoped: true,
  },
  "lecturer-import": { ...shell, lecturers: true, directions: true },
  registration: {
    ...shell,
    students: true,
    lecturers: true,
    registrations: true,
    directions: true,
    termScoped: true,
  },
  assignment: {
    ...shell,
    students: true,
    lecturers: true,
    registrations: true,
    assignments: true,
    outbox: true,
    directions: true,
    termScoped: true,
  },
  "assignment-result": {
    ...shell,
    students: true,
    lecturers: true,
    assignments: true,
    directions: true,
    termScoped: true,
  },
  topic: {
    ...shell,
    students: true,
    lecturers: true,
    assignments: true,
    topics: true,
    directions: true,
    termScoped: true,
  },
  notifications: { ...shell, accounts: true, outbox: true },
};
export type SnapshotScope = keyof typeof snapshotPlans;

export function snapshotScopeForPath(
  pathname: string,
  search = "",
): SnapshotScope {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/") return "dashboard";
  if (path === "/catalog/students") return "student-directory";
  if (path === "/catalog/lecturers") return "lecturers";
  if (path === "/catalog/reference") return "reference";
  if (path === "/catalog/import")
    return new URLSearchParams(search).get("type") === "lecturer"
      ? "lecturer-import"
      : "shell";
  if (path === "/admin/accounts") return "accounts";
  if (path === "/admin/roles") return "roles";
  if (path === "/admin/audit-logs") return "audit";
  if (path === "/profile") return "profile";
  if (path === "/notifications") return "notifications";
  if (path === "/change-password" || path === "/forbidden") return "shell";
  if (path === "/terms" || /^\/terms\/[^/]+\/(phases|parameters)$/.test(path))
    return "terms";
  if (/^\/terms\/[^/]+\/roster$/.test(path)) return "roster";
  if (/^\/terms\/[^/]+$/.test(path)) return "term-detail";
  if (path === "/registration" || path === "/registration/list")
    return "registration";
  if (path === "/registration/assignment" || path === "/registration/manual")
    return "assignment";
  if (path === "/registration/result") return "assignment-result";
  if (["/topic/my", "/topic/draft", "/topic/overview"].includes(path))
    return "topic";
  // These screens own their canonical API queries, including their statistics.
  if (
    path.startsWith("/defense/") ||
    path.startsWith("/guidance/") ||
    /^\/topic\/(review-groups|reviews|review-assignments|proposal|dossier)(\/|$)/.test(
      path,
    )
  )
    return "shell";
  // Preserve dependencies of unclassified/legacy screens until audited.
  return "full";
}
