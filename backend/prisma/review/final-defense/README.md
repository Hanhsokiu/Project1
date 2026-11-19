# UC17 migration review package

Status: **REVIEW ONLY; not applied to shared Supabase**. One existing datasource, one new table. See [deployment plan](../../../../docs/implementation/09-uc17-deployment-plan.md) for approval, backup, rollout and stop conditions.

- `migration.sql`: deployment candidate. Matches the checked baseline names/types and Prisma structural delta; adds security/ownership checks, symmetric final/weekly asset protection, RLS and 10 permissions. Does not rewrite legacy rows or create accounts/proposals.
- `schema.diff.sql`: generated **offline**, Prisma 5.22 datamodel diff from base `0093f81` to the reviewed schema. No database was connected by this diff. Diagnostic evidence only: it omits custom checks/triggers/permissions/RLS and must not be deployed instead of the candidate.
- `rollback.empty-only.sql`: refusal-first rollback for a rehearsed empty migration. Refuses if UC17 data/staging/audit/idempotency exists; retains permissions/grants rather than deleting potentially pre-existing entries. For an already successful Prisma migration, use an approved compensating migration/history procedure; never silently execute this and delete history.

Workspace-byte SHA256 fingerprints at review time (recompute after approved newline/promotion changes; never edit an already-applied migration):

| File                    | SHA256                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| migration.sql           | 75CD92D5F97ACF26F3FE6A3EADBBCADFC54F9C81432BEEF4735E8BD8A51E092F |
| schema.diff.sql         | EAF5042BD3B93D9F3D3E214F90551592B6B92D1F2EC3935183736128DDCE1353 |
| rollback.empty-only.sql | 7B343F4E5C4BA897FAFF59F9C77E5CA8BD91830EAEA1315065C92CB4A82AEB1F |

Earlier evidence: read-only catalog/projection/checksum snapshots in the UC17 integration report. Latest review (09/11/2026) uses the user's supplied SELECT metadata below; no database connection/query was made in this review. Source tests and fingerprints do not re-verify live state.

**NOT VERIFIED:** executing this migration/rollback on an approved representative database; database concurrency/locks/FKs/triggers/RLS after application; restoring legacy data/files; hosted storage durability and browser E2E. No local or parallel business database was created. Do not call this package production-approved or enable writes from static review alone.

Before promotion, the authorized operator must confirm the live target still matches the snapshot, check the current main migration chain, rehearse on the group-designated environment, secure DB/files/ACL/history backups and receive policy/storage/permission approval. Promote the exact reviewed file into the existing active migration chain only then. No apply command or automatic deploy hook was added here.

## Metadata supplied by the user

- 17/17 B1–B8 migrations applied, none incomplete/rolled back; UC17–UC24 absent from Prisma history. FINAL_REPORT_VERSION absent. Baseline FINAL_REPORT/DEFENSE_CONFIRMATION/SCORE_ENTRY/FILE_ASSET have 5/7/8/11 columns; total_score NUMERIC(4,1).
- Confirmed unique keys: FINAL_REPORT(proposal_id), DEFENSE_CONFIRMATION(proposal_id), SCORE_ENTRY(proposal_id,scorer_id,role), FILE_ASSET(storageKey), PERMISSION(resource,action), ROLE_PERMISSION PK(role_id,permission_id). STUDENT/LECTURER/FACULTY each have exactly one role row.
- FileAssetKind REPORT/SOURCE/EVIDENCE/DOSSIER_PDF/RECEIPT_SCAN and FileAssetState READY/QUARANTINED already exist; no enum alteration is needed.
- All 10 existing REPORT assets belong to at least one weekly flow (9 READY PDFs, 1 QUARANTINED; 9 SUBMISSION_ASSET references, 10 GUIDANCE_SUBMISSION_UPLOAD references). **Zero available READY PDFs for final-report adoption.** No existing asset is adopted, relinked, rewritten or used as a test fixture.
- For the 10 inspected tables only: anon/authenticated/service_role have no direct SELECT/INSERT/UPDATE/DELETE; service_role has BYPASSRLS but that does not replace table privileges. postgres has read/write privileges and BYPASSRLS. Legacy inspected tables have RLS disabled. The full list/security of other tables, role inheritance, functions/views/REST and Render runtime DB role are NOT VERIFIED. Do not infer platform-wide safety.

## Integrity hardening in this review

The previous final_pdf_immutable only protected FINAL_REPORT_VERSION. Baseline step8b_file_asset_guard protects committed weekly metadata and deliberately allows state/updatedAt; it does not protect a final-only asset.

1. New final_pdf_asset_immutable BEFORE UPDATE OR DELETE on FILE_ASSET refuses DELETE and any whole-row metadata change once FINAL_REPORT_VERSION references OLD.id. This freezes all 11 current columns, including id, kind/state, storageKey, originalName, sizeBytes, mimeType, checksum, createdByUserId and timestamps, plus future metadata. No current UC17 writer requires changes after binding. Exact SQL no-op is allowed; there is no state/updatedAt exception or post-final quarantine/recovery workflow approved here.
2. Both final_pdf_asset_check and final_pdf_no_weekly_reuse perform `UPDATE FILE_ASSET SET id=id` on the same asset before checking claims, and refuse if no row was updated (including a trigger suppressing a redundant update). This changes the MVCC row version without changing visible metadata/timestamps. The old lock-only protocol could leave an old Repeatable Read snapshot unaware of a committed opposite claim. See [PostgreSQL explicit consistency locks](https://www.postgresql.org/docs/16/applevel-consistency.html) and [transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html). This is a reviewed design, **not a measured concurrency result**.
3. Final claims additionally require positive sizeBytes, lowercase SHA256 metadata, and storageKey equal to `guidance/` plus asset id, alongside the existing regex, owner joins, REPORT/READY/PDF checks and both weekly exclusions. This checks metadata only; SQL cannot verify bytes, filesystem existence or private HTTP routing. Existing service validates bytes before staging and hashes bytes again at download.
4. Integrity readers remain SECURITY INVOKER with explicit VOLATILE and fixed search_path. `SET row_security=off` makes an RLS-hidden integrity read fail instead of treating hidden references as absent; it does **not** bypass RLS or grant privileges. See [PostgreSQL row security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html). No SECURITY DEFINER, backend role creation or legacy ACL/RLS changes were added.
5. schemaReady now requires the new trigger and checks public relation/function, enabled origin/always state, row/before/events, invoker/volatility and row_security setting. Catalog presence is a deployment gate, not proof of function-body correctness; compare deployed definitions to the reviewed SQL during rehearsal.
6. Empty-only rollback removes the new trigger/function before dropping its referenced version table, keeps step8b guards, and acquires the affected table locks NOWAIT during approved maintenance. Any error requires ROLLBACK; no schema/history/data repair is automatic.

Previous fingerprints: migration.sql `93B64606BC47A46C5604B02E572E0743A57561832FA94416E22470A97DD233EA`; rollback `1FBDDCE26A1C361C6D457DCB84C6C62AC0C16A7305C1D3FB2137221E8375E7B9`. schema.diff.sql is unchanged: these are custom guards, not a Prisma column/index delta. No applied baseline migration was edited.

## Lock order, weekly compatibility and rehearsal gate

Claims touch one FILE_ASSET row, then perform non-locking child lookups. The FILE_ASSET guard does not lock FINAL_REPORT_VERSION/weekly children or acquire term/proposal locks, avoiding a new reverse-order child lock. Existing Nest term/owner locks and CAS remain intact. Multi-asset external SQL writers must sort asset IDs and handle deadlock/serialization/unique errors with a full transaction rollback; arbitrary writer deadlock freedom is not proven. No table-wide lock is added to normal upload paths.

Pre-link QUARANTINED → READY remains allowed; append-only version creation and audit/key commit stay atomic. Storage failure retains quarantined staging, not a final version. A failed SQL finalization must roll back READY/no-op/claim/audit/key together; bytes already written may remain staged for reconciliation. No automatic deletion or false provenance is added.

**Potential B1–B8 impact requiring approval:** weekly claims now perform an additional row UPDATE and integrity read of FINAL_REPORT_VERSION. Runtime role needs approved SELECT visibility and UPDATE(id) rights on FILE_ASSET; without full RLS visibility/privileges the new invoker guards intentionally refuse writes. This can block weekly uploads or FILE_ASSET maintenance under a restricted runtime role even with no final data. Do not compensate with blanket GRANT/BYPASSRLS/REVOKE or disable guards. Verify actual Render/worker/SQL roles, views/functions/REST, table/column ACL and role-specific RLS on the designated rehearsal environment before promotion. Existing weekly rows/bytes are not changed by applying this candidate itself, and baseline committed-weekly restrictions remain.

Required two-session rehearsal matrix and exact static/synthetic test classification: [live-schema review](../../../../docs/implementation/09-uc17-live-schema-review.md). Tests do not execute PL/pgSQL, verify MVCC, prove RLS or prove storage durability. DDL/trigger owner or superuser can disable/replace protections or use replication/DDL/TRUNCATE paths; those administrative privileges require a separate operational ACL review.
