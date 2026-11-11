"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { planScopedAccess } = require("./integration-rbac-plan.cjs");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { inventory } = require("./rbac-controller-inventory.cjs");
function fixture() {
  return {
    accounts: [{ userId: "account-0001", status: "ACTIVE",
      roles: [{ name: "FACULTY", permissions: ["defense-result:read"] }],
      termGrants: [{ termId: "term-0000001", allDepartments: false, departmentIds: ["department-0001"] }] }],
    requests: [{ userId: "account-0001", termId: "term-0000001", role: "FACULTY",
      departmentIds: ["department-0001"], permissions: ["defense-result:read"] }],
  };
}
test("existing exact scope is ready for review without authorizing any write", () => {
  const input = fixture(), before = structuredClone(input), plan = planScopedAccess(input);
  assert.equal(plan.readyForAccessReview, true);
  assert.equal(plan.productionChangesAuthorized, false);
  assert.deepEqual(plan.mutations, []);
  assert.deepEqual(input, before);
});
for (const action of ["confirm", "finalize", "publish", "export", "download"]) {
  test(`missing ${action} produces no global role grant`, () => {
    const input = fixture();
    const permission = `${["export", "download"].includes(action) ? "defense-report" : "defense-result"}:${action}`;
    input.requests[0].permissions.push(permission);
    const plan = planScopedAccess(input);
    assert.equal(plan.readyForAccessReview, false);
    assert.deepEqual(plan.entries[0].missingPermissions, [permission]);
    assert.deepEqual(plan.mutations, []);
    assert.ok(plan.entries[0].blockers.includes("SCOPED_ACTION_GRANT_NOT_SUPPORTED"));
  });
}
test("ADMIN permission cannot be merged into FACULTY", () => {
  const input = fixture();
  input.accounts[0].roles.push({ name: "ADMIN", permissions: ["defense-result:finalize"] });
  input.requests[0].permissions.push("defense-result:finalize");
  assert.equal(planScopedAccess(input).readyForAccessReview, false);
});
for (const change of ["other-term", "other-department", "all-departments", "extra-department", "locked-account"]) {
  test(`rejects ${change} scope`, () => {
    const input = fixture();
    const grant = input.accounts[0].termGrants[0];
    if (change === "other-term") grant.termId = "other-term-001";
    if (change === "other-department") grant.departmentIds = ["department-other"];
    if (change === "all-departments") grant.allDepartments = true;
    if (change === "extra-department") grant.departmentIds.push("department-other");
    if (change === "locked-account") input.accounts[0].status = "LOCKED";
    assert.equal(planScopedAccess(input).readyForAccessReview, false);
  });
}
for (const kind of ["ADVISOR", "REVIEWER", "COMMITTEE", "STUDENT_OWNER"]) {
  test(`requires authoritative ${kind} assignment scope`, () => {
    const input = fixture(), role = kind === "STUDENT_OWNER" ? "STUDENT" : "LECTURER";
    input.accounts[0].roles[0].name = role;
    input.requests[0].role = role;
    input.requests[0].assignmentKind = kind;
    assert.equal(planScopedAccess(input).readyForAccessReview, false);
    input.accounts[0].assignmentScopes = [{ termId: "term-0000001", kind, departmentIds: ["department-0001"] }];
    assert.equal(planScopedAccess(input).readyForAccessReview, true);
    input.accounts[0].assignmentScopes[0].termId = "other-term-001";
    assert.equal(planScopedAccess(input).readyForAccessReview, false);
  });
}
test("duplicate account or request is rejected, never silently overwritten", () => {
  const input = fixture();
  input.accounts.push(structuredClone(input.accounts[0]));
  assert.throws(() => planScopedAccess(input), /ACCOUNT_ID_INVALID_OR_DUPLICATE/);
  input.accounts.pop();
  input.requests.push(structuredClone(input.requests[0]));
  assert.throws(() => planScopedAccess(input), /DUPLICATE_REQUEST/);
});
test("empty requests cannot be reported READY", () => {
  const input = fixture(); input.requests = [];
  assert.equal(planScopedAccess(input).readyForAccessReview, false);
});
test("mapping covers exactly the 27 applied RBAC definitions and all controller gates", () => {
  const root = resolve(__dirname, "..");
  const mapping = JSON.parse(readFileSync(resolve(root, "prisma/deployment/integration-rbac/PERMISSION-MAPPING.json"), "utf8"));
  const sql = readFileSync(resolve(root, "prisma/migrations/20261109150000_uc24_uc25_rbac_permissions/migration.sql"), "utf8");
  const expected = new Set([...sql.matchAll(/\('(defense-result|defense-report|dossier)','([a-z-]+)'\)/g)].map((m) => `${m[1]}:${m[2]}`));
  const actual = new Set(mapping.entries.map((e) => e.permission));
  assert.equal(mapping.entries.length, 27);
  assert.equal(actual.size, 27);
  assert.deepEqual([...actual].sort(), [...expected].sort());
  for (const file of ["src/defense/final-results/final-result.controller.ts", "src/report/defense-reporting/report.controller.ts"]) {
    const source = readFileSync(resolve(root, file), "utf8");
    for (const m of source.matchAll(/@RequirePermission\("([a-z-]+)", "([a-z-]+)"\)/g)) {
      assert.ok(actual.has(`${m[1]}:${m[2]}`), `${m[1]}:${m[2]} missing`);
    }
  }
});

test("B1-B10 inventory matches controller source exactly, including staging classification", () => {
  const rows = inventory();
  const stored = JSON.parse(readFileSync(resolve(__dirname, "../prisma/deployment/integration-rbac/CONTROLLER-PERMISSIONS.json"), "utf8"));
  assert.deepEqual(rows, stored.entries);
  for (const uc of Array.from({ length: 9 }, (_, i) => `UC${i + 17}`)) assert.ok(rows.some((r) => r.phase === uc), uc);
  assert.ok(rows.some((r) => r.phase === "B1-B8_SHARED"));
  assert.ok(rows.filter((r) => r.controller.includes("acceptance/")).every((r) => r.phase === "STAGING_ONLY"));
  const mapping = JSON.parse(readFileSync(resolve(__dirname, "../prisma/deployment/integration-rbac/PERMISSION-MAPPING.json"), "utf8"));
  const endpointPermissions = new Set(rows.filter((r) => ["UC24", "UC25"].includes(r.phase)).map((r) => r.permission));
  for (const permission of endpointPermissions) assert.ok(mapping.entries.some((e) => e.permission === permission), permission);
});
