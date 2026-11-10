-- READ ONLY postflight; used with the approved target and process-only credentials.
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $gate$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 THEN RAISE EXCEPTION 'Target identity mismatch'; END IF;
 IF (SELECT count(*) FROM public."_prisma_migrations")<>27 OR EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) THEN RAISE EXCEPTION 'Migration history mismatch'; END IF;
 IF (SELECT count(*) FROM public."PERMISSION")<>124 OR (SELECT count(*) FROM public."ROLE_PERMISSION")<>166 OR (SELECT count(*) FROM datn_rbac_uc24_25.created_permission)<>27 THEN RAISE EXCEPTION 'RBAC counts changed'; END IF;
 IF EXISTS(SELECT 1 FROM public."TERM_PARAMETER" WHERE key ~ '^UC(17|18|19|20|21|22|23|24|25)_POLICY$') THEN RAISE EXCEPTION 'Unexpected policy change'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.fr_guard()'::regprocedure AND md5(replace(prosrc,E'\r\n',E'\n'))='96f44bc20b78af4a7971d798574ba5b1' AND NOT prosecdef AND provolatile='v' AND proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public')) THEN RAISE EXCEPTION 'Function definition/security mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."FINAL_RESULT"'::regclass AND tgname='fr_transition_guard' AND tgfoid='public.fr_guard()'::regprocedure AND tgenabled IN('O','A')) THEN RAISE EXCEPTION 'Trigger binding mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE migration_name='202611110001_uc24_fr_guard_forward_fix' AND checksum='a7e0384e8c821925e8c0b034db38ad793440fe3a907fa7dd23b4598e121ac3e7') THEN RAISE EXCEPTION 'Forward checksum mismatch'; END IF;
END $gate$;
COMMIT;
