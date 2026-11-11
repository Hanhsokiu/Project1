"use strict";
// Actual SQL tests; explicit newly-created PG17 container only, never DATABASE_URL/.env.
const { spawnSync } = require("node:child_process");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const container = process.env.RBAC_SQL_TEST_CONTAINER;
if (!container || !/^[a-zA-Z0-9_-]+$/.test(container) || /manual|completed|production/i.test(container)) {
  throw new Error("RBAC_SQL_TEST_CONTAINER_EXPLICIT_NEW_CONTAINER_REQUIRED");
}
function docker(args, input, failureAllowed = false) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", windowsHide: true });
  if (!failureAllowed && r.status !== 0) throw new Error((r.stderr || r.error?.message || "DOCKER_FAILED").slice(0, 2000));
  return r;
}
const info = JSON.parse(docker(["inspect", container]).stdout)[0];
if (!/^postgres:17(?:[.-]|$)/.test(info.Config.Image) || info.Config.Labels?.["datn.rbac-test"] !== "true") {
  throw new Error("RBAC_SQL_TEST_NEEDS_PG17_AND_datn.rbac-test=true_LABEL");
}
const database = `rbac_sql_${process.pid}_${Date.now()}`;
docker(["exec", container, "createdb", "-U", "postgres", database]);
const psql = (sql, fails = false) => docker(["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-At"], sql, fails);
const folder = resolve(__dirname, "../prisma/deployment/integration-rbac");
const sql = (file) => readFileSync(resolve(folder, file + ".sql"), "utf8");
psql(`
 CREATE TABLE "USER_ACCOUNT"(id text PRIMARY KEY,status text NOT NULL);
 CREATE TABLE "ROLE"(id text PRIMARY KEY,name text UNIQUE NOT NULL);
 CREATE TABLE "PERMISSION"(id text PRIMARY KEY,resource text NOT NULL,action text NOT NULL,UNIQUE(resource,action));
 CREATE TABLE "USER_ROLE"(user_id text REFERENCES "USER_ACCOUNT",role_id text REFERENCES "ROLE",PRIMARY KEY(user_id,role_id));
 CREATE TABLE "ROLE_PERMISSION"(role_id text REFERENCES "ROLE",permission_id text REFERENCES "PERMISSION",PRIMARY KEY(role_id,permission_id));
 CREATE TABLE "ACADEMIC_TERM_GRANT"(id text PRIMARY KEY,"userId" text,"termId" text,"allDepartments" boolean);
 CREATE TABLE "GRANT_DEPARTMENT"(id text PRIMARY KEY,"grantId" text,"departmentId" text);
 INSERT INTO "USER_ACCOUNT" VALUES('admin-synthetic','ACTIVE'),('faculty-synthetic','ACTIVE');
 INSERT INTO "ROLE" VALUES('role-admin','ADMIN'),('role-faculty','FACULTY');
 INSERT INTO "USER_ROLE" VALUES('admin-synthetic','role-admin'),('faculty-synthetic','role-faculty');
 INSERT INTO "PERMISSION" VALUES('permission-read','defense-result','read'),('permission-finalize','defense-result','finalize'),('permission-export','defense-report','export');
 INSERT INTO "ROLE_PERMISSION" VALUES('role-faculty','permission-read');
 INSERT INTO "ACADEMIC_TERM_GRANT" VALUES('grant-test','faculty-synthetic','term-synthetic',false);
 INSERT INTO "GRANT_DEPARTMENT" VALUES('department-grant-test','grant-test','department-synthetic');
`);
// Read the exact fingerprint implementation from preflight without executing its gates.
const fingerprintFunction = sql("preflight").match(/CREATE OR REPLACE FUNCTION pg_temp\.rbac_scope_fingerprint\(\)[\s\S]+?\n\$\$;/)[0];
const fingerprint = psql(fingerprintFunction + "\nSELECT pg_temp.rbac_scope_fingerprint();").stdout.trim().split("\n").at(-1);
const base = { status: "APPROVED", runId: "sql-synthetic-release", database,
  approvedBy: "admin-synthetic", approvedAt: "2020-01-01T00:00:00Z", expiresAt: "2090-01-01T00:00:00Z",
  decisionReference: "SYNTHETIC_SQL_TEST_ONLY", backupEvidence: "SYNTHETIC_EMPTY_DATABASE", impact: "GLOBAL_ROLE_ALL_CURRENT_AND_FUTURE_USERS",
  approvedGlobalRoleImpact: true, expectedGrantCount: 1, expectedScopeFingerprint: fingerprint,
  requests: [{ role: "FACULTY", resource: "defense-result", action: "read", affectedUserIds: ["faculty-synthetic"] },
    { role: "FACULTY", resource: "defense-result", action: "finalize", affectedUserIds: ["faculty-synthetic"] }] };
const results = [];
function attempt(name, patch, expectedError) {
  const input = structuredClone(base); patch(input);
  const text = `BEGIN; SELECT set_config('datn.rbac_approval',${quote(JSON.stringify(input))},true);\n` +
    sql("preflight") + sql("migration") + sql("postflight") + "\nCOMMIT;";
  const r = psql(text, !!expectedError);
  if (expectedError ? r.status === 0 || !r.stderr.includes(expectedError) : r.status !== 0) {
    throw new Error(`${name}: ${r.stderr}`);
  }
  results.push({ name, result: "PASS" });
}
function quote(s) { return "'" + s.replaceAll("'", "''") + "'"; }
attempt("missing global approval rejected atomically", (d) => { d.approvedGlobalRoleImpact = false; }, "RBAC_GLOBAL_IMPACT_APPROVAL_REQUIRED");
attempt("wrong target rejected", (d) => { d.database = "wrong-database"; }, "RBAC_TARGET_MISMATCH");
attempt("fake approver rejected", (d) => { d.approvedBy = "nonexistent"; }, "RBAC_REAL_ACTIVE_ADMIN_APPROVER_REQUIRED");
attempt("non-admin approver rejected", (d) => { d.approvedBy = "faculty-synthetic"; }, "RBAC_REAL_ACTIVE_ADMIN_APPROVER_REQUIRED");
attempt("stale scope rejected", (d) => { d.expectedScopeFingerprint = "stale"; }, "RBAC_SCOPE_OR_COUNT_CHANGED");
attempt("omitted affected account rejected", (d) => { d.requests[0].affectedUserIds = []; }, "RBAC_AFFECTED_USERS_CHANGED");
attempt("duplicate rejected", (d) => { d.requests.push(d.requests[0]); }, "RBAC_DUPLICATE_REQUEST");
attempt("undefined permission rejected", (d) => { d.requests[0].action = "delete"; }, "RBAC_NOT_IN_REVIEWED_27");
attempt("wrong business role action rejected despite global approval", (d) => { d.requests[1].role = "STUDENT"; }, "RBAC_ROLE_ACTION_NOT_IN_REVIEWED_MAPPING");
attempt("expired approval rejected", (d) => { d.expiresAt = "2020-01-02T00:00:00Z"; }, "RBAC_APPROVAL_METADATA_INVALID");
attempt("approved grant preserves existing permission", () => {}, null);
const count = () => Number(psql('SELECT count(*) FROM "ROLE_PERMISSION";').stdout.trim());
if (count() !== 2) throw new Error("GRANT_COUNT_MISMATCH");
const rollback = (authorized = true) => `BEGIN; SELECT set_config('datn.rbac_rollback_run','sql-synthetic-release',true); SELECT set_config('datn.rbac_rollback_authorized','${authorized}',true);\n${sql("rollback")}\nCOMMIT;`;
let r = psql(rollback(false), true);
if (r.status === 0 || !r.stderr.includes("RBAC_ROLLBACK_APPROVAL_REQUIRED")) throw new Error("ROLLBACK_GATE_MISSING");
results.push({ name: "rollback requires separate approval", result: "PASS" });
psql(`INSERT INTO "ROLE_PERMISSION" VALUES('role-faculty','permission-export');`);
r = psql(rollback(), true);
if (r.status === 0 || !r.stderr.includes("RBAC_ROLLBACK_GRANT_DRIFT_REVIEW_REQUIRED") || count() !== 3) throw new Error("DRIFT_ROLLBACK_NOT_BLOCKED");
results.push({ name: "rollback refuses newer unrelated grant", result: "PASS" });
psql(`DELETE FROM "ROLE_PERMISSION" WHERE permission_id='permission-export';`);
psql(rollback());
if (count() !== 1 || psql(`SELECT permission_id FROM "ROLE_PERMISSION";`).stdout.trim() !== "permission-read") throw new Error("ROLLBACK_REMOVED_PREEXISTING_GRANT");
results.push({ name: "rollback removes only created grant and preserves baseline", result: "PASS" });
const out = resolve(__dirname, "../../.cache/integration-readiness"); mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "rbac-sql-pg17.json"), JSON.stringify({ postgres: "17", isolatedContainer: container, isolatedDatabase: database, productionConnections: 0, results }, null, 2));
console.log(JSON.stringify({ result: "PASS", cases: results.length, database }));
