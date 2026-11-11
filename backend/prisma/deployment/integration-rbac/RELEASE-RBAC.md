# RBAC release package and scope review

This package is source preparation. It has not been applied to Supabase. It does not change Prisma history, permissions, policies, flags, accounts or workflow assignments automatically.

## Actual authorization layers

`CONTROLLER-PERMISSIONS.json` inventories every literal `RequirePermission` endpoint in source (B1–B10, auth/system and explicitly labelled staging-only endpoints). Rebuild with `node backend/scripts/rbac-controller-inventory.cjs`; the offline test rejects inventory drift. This is an endpoint-gate inventory, not a seed of roles. `PERMISSION-MAPPING.json` adds business roles, content restrictions and policy decisions for all 27 UC24/25 definitions, including service-only content capabilities with no independent route.

| Workflow | Minimum business authority and scope | Additional conditions |
|---|---|---|
| B1 plan/roster | FACULTY with term action; existing administration follows its existing RBAC | Term plan validation, revision/reason/audit for amendments; no automatic state transitions |
| B2 registration | Active STUDENT owns membership in selected term | Registration window, valid preferences and roster; other student ID never grants ownership |
| B3 allocation | FACULTY workflow actor with assignment actions | Quota, correct term, explicit publish/finalize; publication does not imply finalization |
| B4 review groups | FACULTY manage + academic term/department grant | LECTURER can only read its actual membership; current department and membership history matter |
| B5–B7 proposals/review/dossier | STUDENT owner; LECTURER current advisor/review assignee; FACULTY scoped administration | Each submit/edit/review/finalize action and phase validated independently; no forged signature |
| B8 guidance/weekly | STUDENT owner; LECTURER current finalized advisor; FACULTY academic scope | Current period/task, revision, submission/evidence and reopen policy; read does not imply review |
| UC17 | STUDENT owner uploads versions; LECTURER assigned finalized advisor evaluates | Individual PDF/download/review/score/decision permissions, policy and deadlines; rejected decision needs reason |
| UC18 | FACULTY scoped review/decide/finalize | STUDENT sees own status; advisor only assigned dossier view; complete current evidence and explicit finalize |
| UC19 | FACULTY manage correct term/department | Valid committee roles/membership and conflicts; no committee grant implied by LECTURER role |
| UC20 | FACULTY reviewer assignment action | All committee advisors excluded; current student eligibility and finalized assignments |
| UC21 | FACULTY schedule actions | Valid room/session/capacity; current assignments; SV/GV visibility requires published schedule + policy |
| UC22 | LECTURER current reviewer, own evaluation only | Separate score/comment/download capabilities, version and current source hash; FACULTY progress/read cannot grade |
| UC23 | LECTURER actual committee member and own ballot | Correct student/committee/term; rubric and scoring window; not another member's ballot |
| UC24 | LECTURER actual committee member confirms; FACULTY scoped finalize/publish; STUDENT own released result | Same-role action, policy confirmation role/separation, current complete sources; no premature score disclosure |
| UC25 | FACULTY academic scope; LECTURER member only when policy permits | Template, per-content permissions, publication, export/download separate; PII/comments/component scores require explicit rights |

The table describes service enforcement, not a role grant command. Legacy B1–B3 authority also permits the existing ADMIN paths where implemented; this package does not remove those paths or claim retroactive per-department scoping of every legacy catalog operation. Review global catalog/import/admin permissions separately before giving them to production accounts.

## Per-account action scope: current limitation

`ROLE_PERMISSION` applies to every current and future account assigned that role. `USER_ROLE` has no term. `ACADEMIC_TERM_GRANT` restricts FACULTY term/department visibility, but cannot add/remove an action per user. Combining ADMIN/custom-role permissions with FACULTY/LECTURER is intentionally rejected by B9/B10 services. STUDENT/LECTURER authority additionally depends on live ownership/assignment, never an operator-provided claim.

There is currently **no management service/API for assigning or revoking an arbitrary existing term's academic grant**. The real `TermRepository.grantCreatorAcademicAccess` runs inside the create-term service and grants the FACULTY creator `allDepartments=true`; it preserves an existing restricted grant. Do not invent a `POST /term-grants` endpoint, directly insert workflow assignments, or call term creation to manufacture a restricted grant for an existing term. Restricted scope provisioning for an existing term remains a separate reviewed service change. An approval config must record `userId`, `termId`, exact department IDs, expected current grant revision, reason and approver; execution stays BLOCKED until that service exists and is tested. The planner can review existing restricted grants today.

If the intended approval is limited to one account/term, **do not run this SQL package**. Keep `approvedGlobalRoleImpact=false`. Use the existing role actions and scopes, or implement/review the forward scoped-action contract described in README. No current package emulates a per-user action grant.

## Official role-wide SQL/config, explicitly gated

Use `approval.example.json` as a DRAFT only; real IDs, decision and backup evidence belong outside Git. The source contains no APPROVED production decision. The approving authority must confirm that the action is intended for **all current and future users of the business role**, not just a pilot account. Current affected user IDs (including inactive accounts which may become active) must be sorted and exact in each request:

```json
{
  "role": "FACULTY",
  "resource": "defense-result",
  "action": "finalize",
  "affectedUserIds": []
}
```

This is shape documentation; an empty array is rejected if users exist. Approval requires status APPROVED, real active ADMIN `approvedBy`, nonfuture `approvedAt`, future expiry, decision reference, verified target database, backup evidence reference, exact role-grant count and exact current scope fingerprint. The JSON does not prove a real decision by itself: an authorized operator must verify the signed/approved external decision and the cited production backup before invoking SQL. Never fill approval fields solely to satisfy validation.

`preflight.sql` rejects active Prisma advisory lock, concurrent RBAC release, missing/expired/fake approval, stale scope/account lists, duplicate requests and permission pairs outside the reviewed 27. It locks RBAC and academic-scope tables for the short transaction. `migration.sql` adds only approved missing role grants and records exact inserted keys plus original grants in a private provenance schema. It does not add permission definitions, user roles, academic scopes, assignment records, policies or business data. `postflight.sql` checks exact before-plus-created grants, unchanged scope fingerprint and private provenance ACLs. Already-present grants are preserved and never recorded as newly inserted. A repeated release ID is rejected rather than silently reusing an old decision.

Run all three files in **one connection and one transaction** using `release.sql`, after supplying `approval_json` from an externally protected reviewed file. The default DRAFT is intentionally unusable. No production executor runs as part of build, migrations or startup. The migration login's SQL privilege does not itself authorize business actions.

Before approval collect a live READ ONLY snapshot of current USER_ROLE IDs, ROLE_PERMISSION count and the fingerprint expression from preflight. It fingerprints account IDs/status, user-role links and all academic term/department grants. Hashes are change detection, not signatures. Also review current advisor/reviewer/committee/student assignments in the approved business scope against the mapping; assignments are checked again by runtime services, not created or frozen by this SQL. New assignments/users after deployment inherit global role actions, which is why global-impact approval is mandatory.

## Rollback

`rollback.sql` requires a separate incident authorization (`datn.rbac_rollback_authorized=true`) and exact `datn.rbac_rollback_run`. Execute in a new transaction only after checking target and active sessions/rollout. It refuses rollback if any grant has changed since application, preserving newer work for explicit review. On an unchanged system it deletes only keys recorded as inserted by this release; pre-existing grants and all workflow rows stay unchanged. Provenance remains with `rolled_back_at`. Removing role actions can affect current sessions; runtime reads current grants, so coordinate the rollback. Never delete an entire role or restore broad snapshots over newer grants.

## Required separate approvals

For the 27 definitions: approve each role/action combination rather than treating the list as a blanket grant. Explicit decisions remain required for UC24 `confirm`, `finalize`, `publish`, `components-read`, `history-read`, `final-read`; and UC25 preview/export/download/history, score/grade statistics, draft preview/export, list/components/final/comments/minutes/dossier/PII export and `dossier:export`. Even read/read-own/template/statistics grants must match account scope and policy visibility. No policy or role mapping is considered approved by a passing test.

The existing four FACULTY reads are not re-applied. The 27 existing migrations and application source permissions remain unchanged by preparation. PG17 SQL tests use synthetic tables in a new labelled container/database; HTTP tests exercise real JWT/session/permission guard/controller/service with isolated persistence. Neither constitutes a production role assignment or a production smoke write.
