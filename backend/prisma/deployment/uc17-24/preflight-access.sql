-- Prepared, NOT EXECUTED. Run with the migration login, not a Dashboard identity.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT current_database()=:'expected_database' AND current_user=:'expected_role'
 AND current_setting('server_version_num')::integer/10000=:'expected_pg_major'::integer AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_target_identity_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT has_schema_privilege(current_user,'public','USAGE')
 AND has_schema_privilege(current_user,'public','CREATE')
 AND has_language_privilege(current_user,'plpgsql','USAGE')
 AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN (
   'FINAL_REPORT','DEFENSE_CONFIRMATION','SCORE_ENTRY','FILE_ASSET','SUBMISSION_ASSET',
   'GUIDANCE_SUBMISSION_UPLOAD','DEFENSE_ELIGIBILITY','DEFENSE_COMMITTEE','COMMITTEE_MEMBER',
   'REVIEWER_ASSIGNMENT','DEFENSE_SESSION','SCORE_DETAIL','FINAL_RESULT'))=13
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN (
   'FINAL_REPORT','DEFENSE_CONFIRMATION','SCORE_ENTRY','FILE_ASSET','SUBMISSION_ASSET',
   'GUIDANCE_SUBMISSION_UPLOAD','DEFENSE_ELIGIBILITY','DEFENSE_COMMITTEE','COMMITTEE_MEMBER',
   'REVIEWER_ASSIGNMENT','DEFENSE_SESSION','SCORE_DETAIL','FINAL_RESULT')
   AND NOT pg_has_role(current_user,c.relowner,'USAGE'))
 AND has_table_privilege(current_user,'public."ROLE"','SELECT')
 AND has_table_privilege(current_user,'public."PERMISSION"','SELECT')
 AND has_table_privilege(current_user,'public."PERMISSION"','INSERT')
 AND has_table_privilege(current_user,'public."ROLE_PERMISSION"','SELECT')
 AND has_table_privilege(current_user,'public."ROLE_PERMISSION"','INSERT') AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_DDL_ownership_or_RBAC_privilege_missing_ask_team_DBA_no_automatic_GRANT
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT current_database(), current_user, current_setting('server_version'),
       current_setting('transaction_read_only');
COMMIT;
\echo PASS_migration_login_metadata_only_runtime_RLS_still_requires_rehearsal
