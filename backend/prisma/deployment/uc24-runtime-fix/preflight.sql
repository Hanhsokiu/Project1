-- READ ONLY preflight; used with the approved target and process-only credentials.
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $gate$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 THEN RAISE EXCEPTION 'Target identity mismatch'; END IF;
 IF (SELECT count(*) FROM public."_prisma_migrations")<>26 OR EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) THEN RAISE EXCEPTION 'Migration history mismatch'; END IF;
 IF (SELECT count(*) FROM public."PERMISSION")<>124 OR (SELECT count(*) FROM public."ROLE_PERMISSION")<>166 OR (SELECT count(*) FROM datn_rbac_uc24_25.created_permission)<>27 THEN RAISE EXCEPTION 'RBAC counts changed'; END IF;
 IF EXISTS(SELECT 1 FROM public."TERM_PARAMETER" WHERE key ~ '^UC(17|18|19|20|21|22|23|24|25)_POLICY$') THEN RAISE EXCEPTION 'Unexpected policy change'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.fr_guard()'::regprocedure AND md5(replace(prosrc,E'\r\n',E'\n'))='6ea3c09b62a410716e6ac43887201bda' AND NOT prosecdef AND provolatile='v' AND proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public')) THEN RAISE EXCEPTION 'Function definition/security mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."FINAL_RESULT"'::regclass AND tgname='fr_transition_guard' AND tgfoid='public.fr_guard()'::regprocedure AND tgenabled IN('O','A')) THEN RAISE EXCEPTION 'Trigger binding mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND classid=0 AND objid=72707369 AND objsubid=1) THEN RAISE EXCEPTION 'Prisma lock present'; END IF;
 IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend' AND state IS DISTINCT FROM 'idle') THEN RAISE EXCEPTION 'Concurrent database operation'; END IF;
END $gate$;
COMMIT;
