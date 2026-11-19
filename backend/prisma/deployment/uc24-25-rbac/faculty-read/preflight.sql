-- FACULTY metadata read access only; no score/comment/export grant. Production requires approved source tests.
BEGIN READ ONLY;
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000 THEN RAISE EXCEPTION 'Wrong target'; END IF;
 IF (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>26 OR EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL) THEN RAISE EXCEPTION 'Expected 26 applied and zero unfinished'; END IF;
 IF EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=72707369 AND objsubid=1 AND pid<>pg_backend_pid()) THEN RAISE EXCEPTION 'Prisma advisory lock: stop, do not terminate'; END IF;
 IF (SELECT count(*) FROM public."ROLE" WHERE name='FACULTY')<>1 THEN RAISE EXCEPTION 'FACULTY not unique'; END IF;
 IF (WITH expected(resource,action) AS (VALUES ('defense-result','read'),('defense-report','read'),('defense-report','templates-read'),('defense-report','statistics')) SELECT count(*) FROM expected e JOIN public."PERMISSION" p USING(resource,action))<>4 THEN RAISE EXCEPTION 'Missing read definitions'; END IF;
END; $$;
WITH expected(resource,action) AS (VALUES ('defense-result','read'),('defense-report','read'),('defense-report','templates-read'),('defense-report','statistics')) SELECT e.resource,e.action,EXISTS(SELECT 1 FROM public."ROLE_PERMISSION" rp JOIN public."ROLE" r ON r.id=rp.role_id WHERE r.name='FACULTY' AND rp.permission_id=p.id) already_granted FROM expected e JOIN public."PERMISSION" p USING(resource,action) ORDER BY 1,2;
COMMIT;
