"use strict";

// Offline only. This planner never opens a database connection or executes SQL.
// ROLE_PERMISSION is global, so a missing action must not be provisioned by
// silently adding it to an existing FACULTY/LECTURER/STUDENT role.
const { readFileSync } = require("node:fs");

const BUSINESS_ROLES = new Set(["FACULTY", "LECTURER", "STUDENT"]);
const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(id);
const validPermission = (p) => typeof p === "string" && /^[a-z][a-z-]*:[a-z][a-z-]*$/.test(p);

function planScopedAccess(input) {
  if (!input || !Array.isArray(input.accounts) || !Array.isArray(input.requests)) {
    throw new Error("RBAC_PLAN_INVALID_INPUT");
  }
  const accounts = new Map();
  for (const account of input.accounts) {
    if (!validId(account.userId) || accounts.has(account.userId)) {
      throw new Error("RBAC_PLAN_ACCOUNT_ID_INVALID_OR_DUPLICATE");
    }
    accounts.set(account.userId, account);
  }
  const duplicates = new Set();
  const entries = input.requests.map((request) => {
    const blockers = [];
    if (!validId(request.userId) || !validId(request.termId) ||
        !BUSINESS_ROLES.has(request.role) ||
        !Array.isArray(request.departmentIds) || !request.departmentIds.length ||
        request.departmentIds.some((id) => !validId(id)) ||
        new Set(request.departmentIds).size !== request.departmentIds.length ||
        !Array.isArray(request.permissions) || !request.permissions.length ||
        request.permissions.some((p) => !validPermission(p)) ||
        new Set(request.permissions).size !== request.permissions.length) {
      throw new Error("RBAC_PLAN_REQUEST_INVALID");
    }
    const key = `${request.userId}|${request.termId}|${request.role}`;
    if (duplicates.has(key)) throw new Error("RBAC_PLAN_DUPLICATE_REQUEST");
    duplicates.add(key);
    const account = accounts.get(request.userId);
    const role = account?.roles?.find((r) => r.name === request.role);
    if (!account || account.status !== "ACTIVE") blockers.push("ACTIVE_ACCOUNT_REQUIRED");
    if (!role) blockers.push("BUSINESS_ROLE_REQUIRED");
    const missingPermissions = request.permissions.filter((p) => !role?.permissions?.includes(p));
    if (missingPermissions.length) blockers.push("SCOPED_ACTION_GRANT_NOT_SUPPORTED");
    if (request.role === "FACULTY") {
      // An existing all-department grant is broader than the proposed pilot and
      // must be reviewed explicitly; do not treat it as isolated integration.
      const scope = account?.termGrants?.find((g) => g.termId === request.termId);
      if (!scope || scope.allDepartments || !Array.isArray(scope.departmentIds) ||
          request.departmentIds.some((id) => !scope.departmentIds.includes(id)) ||
          scope.departmentIds.some((id) => !request.departmentIds.includes(id))) {
        blockers.push("EXACT_FACULTY_TERM_DEPARTMENT_SCOPE_REQUIRED");
      }
    }
    if (request.role !== "FACULTY") {
      // A plan does not create a student/advisor/reviewer/committee assignment.
      // These are authoritative workflow records, checked again on every API.
      const scope = account?.assignmentScopes?.find((g) =>
        g.termId === request.termId && g.kind === request.assignmentKind &&
        Array.isArray(g.departmentIds) &&
        request.departmentIds.every((id) => g.departmentIds.includes(id)),
      );
      const kinds = request.role === "STUDENT" ? ["STUDENT_OWNER"] : ["ADVISOR", "REVIEWER", "COMMITTEE"];
      if (!kinds.includes(request.assignmentKind) || !scope) blockers.push("WORKFLOW_ASSIGNMENT_SCOPE_REQUIRED");
    }
    return { userId: request.userId, termId: request.termId, role: request.role,
      departmentIds: [...request.departmentIds], permissions: [...request.permissions],
      missingPermissions, blockers, ready: blockers.length === 0 };
  });
  return {
    version: 1,
    mode: "OFFLINE_READ_ONLY_PLAN",
    readyForAccessReview: entries.length > 0 && entries.every((e) => e.ready),
    productionChangesAuthorized: false,
    mutations: [],
    serviceScopeRevalidationRequired: true,
    entries,
  };
}

module.exports = { planScopedAccess };
if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error("RBAC_PLAN_INPUT_FILE_REQUIRED");
    const plan = planScopedAccess(JSON.parse(readFileSync(process.argv[2], "utf8")));
    // IDs and aggregate permission names only, no password/token/email fields.
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    if (!plan.readyForAccessReview) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(String(error.message) + "\n");
    process.exitCode = 1;
  }
}
