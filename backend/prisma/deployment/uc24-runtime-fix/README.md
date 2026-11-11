# UC24 forward function repair — DEPLOYED VERIFIED on Supabase

Production rollout completed **11/11/2026 01:17 ICT** (10/11/2026 18:17 UTC): migration **`202611110001_uc24_fr_guard_forward_fix`**, **26 → 27 APPLIED / 0 FAILED**. Prisma executed only migration 27. The function, original 26 history rows/checksums, every application/RBAC/provenance table fingerprint, constraints/indexes/triggers/RLS/table ACL, and the unchanged `fr_commit_check` were checked after deployment. Permission definitions remain **124**, role grants **166**, UC17–UC25 policies **0**. No write flags, business states, accounts, grades, grants or TEST policy were changed. No Render deploy or staging operation was performed.

Actual evidence: `forward-production-result.json`, `forward-production-before.json`, `forward-production-after.json`, `forward-rehearsal.json`, `forward-readonly-smoke.json`. `preflight.sql` and `postflight.sql` ran on production as READ ONLY. The full backup came from **production**, not staging, and was restored on new PG17 containers/volumes with actual roles, managed/provenance schema data, public catalog and data fingerprints verified. Source/restore locale match. Backup ID: `datn-restore-1794333863088-6d526890`, encrypted outside Git under `E:\DATN-Database-Backups`; artifact hashes are sealed there. No Storage/PDF file bytes, platform configuration, role passwords or external keys are included: this is a logical database recovery backup, not a whole-platform backup.

The clone reproduced SQLSTATE **42702** in the old function using `plpgsql_check`; after actual Prisma migration 27 the complete trigger function has zero compiler errors. Actual trigger tests preserve baseline legacy maintenance and reject adoption/immutable result changes. Exact SQL preflight/postflight, function rollback/reapply and unchanged data/RBAC/schema were verified locally. Production rollback was **not** executed and requires a separate incident decision; `rollback.sql` restores the defect.

Supavisor retained advisory lock **72707369** at PID **2061694**, backend_start **2026-11-10 18:17:16.849945 UTC**, idle/no transaction at postflight. No session was terminated or unlocking bypass used. Do not run more migration work until its current ownership/state is checked.

Schema comparison found no missing tables/columns; its 241 proposed DDL statements concern native types/defaults/nullability, handcrafted FKs and indexes. `production-schema-diff.NOT-EXECUTABLE.sql` is diagnostic output and was **not applied**. This rollout changes only `public.fr_guard()` and the new Prisma history row. The original 26 migration bytes are unchanged.

The GitHub `main` commit was checked READ ONLY as `05131282a686eacfe4ff23a24f26a5ac02feb3b9`. The fix is strictly a local-variable/row-alias rename, with the signature, invoker security, owner, ACL and legacy branch unchanged. This supports compatibility with existing baseline readers/writers. Actual Render running revision, HTTP responses, logs, environment flags and persistent storage remain **NOT VERIFIED**: no configured Render hostname, approved business token or dashboard access is available. Do not infer that Render main contains the feature branch's UC17–UC25 controllers.

For a future main release, include the new migration unchanged with the reviewed backend code. Supabase already records migration 27, so Prisma will skip it; do not rerun the SQL manually, resolve history or change an old checksum. See `PRODUCTION-READINESS.md` for the remaining production configuration.

## Historical staging repair

Real connected PG17 acceptance found SQLSTATE 42702 on the first UC24 confirmation: PL/pgSQL variable `c` collided with the alias of `jsonb_array_elements` in `fr_guard`. SQL parses the expression even for the CONFIRMING transition. The original 26 applied migration bytes remain unchanged.

`migration.sql` replaces **only** `public.fr_guard()` using a distinct variable `confirmation_item` and an explicitly qualified row alias `confirmed.value`. All validation, SECURITY INVOKER, fixed search_path, row_security, immutable history, ownership, source, confirmation and separation checks remain in place. No new permission or data grant.

SHA-256: `a7e0384e8c821925e8c0b034db38ad793440fe3a907fa7dd23b4598e121ac3e7`.

Applied only through `backend/scripts/acceptance/repair-result-trigger.cjs`, which refuses nonloopback targets and requires the exact Docker ownership label and run/database manifest. Evidence: `.cache/b9-b10-acceptance/<runId>/trigger-repair.json` and the subsequent real UC24 confirmations/finalize/publish in `e2e-result.json`.

At the original staging repair, Supabase still had 26 APPLIED. The new forward migration above now records the repair as migration 27 on Supabase. Existing acceptance staging was not connected to or changed during this production rollout; its function repair/history reconciliation remains a separate local maintenance task.

`rollback.sql` restores the original function; it also restores the defect. Never run automatically or use after official result writes without separate incident approval. Current staging results and source provenance should be retained. Database restore into a separate owned staging database is the tested rollback mechanism for this acceptance run.
