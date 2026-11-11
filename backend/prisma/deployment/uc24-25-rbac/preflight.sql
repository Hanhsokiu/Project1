-- DRAFT, NOT APPROVED, NOT APPLIED. Generated offline by prepare-uc24-25-rbac.cjs.
-- Definitions only: NO role grants. Keep outside prisma/migrations until separately approved.
BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
DO $preflight$
BEGIN
  IF current_database()<>'postgres' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF current_setting('server_version_num')::integer<170000 THEN RAISE EXCEPTION 'PG17+ required'; END IF;
  IF NOT (SELECT bool_and(has_table_privilege(current_user,'public."PERMISSION"',p)) FROM unnest(ARRAY['SELECT','INSERT','DELETE']) p)
    OR NOT has_table_privilege(current_user,'public."ROLE_PERMISSION"','SELECT')
    OR NOT has_database_privilege(current_user,current_database(),'CREATE')
    THEN RAISE EXCEPTION 'Missing RBAC operator privileges'; END IF;
  IF (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>25
    OR EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL)
    THEN RAISE EXCEPTION 'Expected 25 applied and no unfinished migrations'; END IF;
  IF EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=72707369 AND objsubid=1 AND pid<>pg_backend_pid())
    THEN RAISE EXCEPTION 'Prisma advisory lock held/waited: ask DBA, do not terminate'; END IF;
  IF (SELECT count(*) FROM public."ROLE" WHERE name IN ('FACULTY','LECTURER','STUDENT'))<>3
    THEN RAISE EXCEPTION 'Expected unique business roles'; END IF;
END; $preflight$;
WITH expected(resource,action) AS (VALUES
    ('defense-result','read'),
    ('defense-result','confirm'),
    ('defense-result','finalize'),
    ('defense-result','publish'),
    ('defense-report','read'),
    ('defense-report','templates-read'),
    ('defense-report','statistics'),
    ('defense-report','preview'),
    ('defense-report','export'),
    ('defense-report','history-read'),
    ('defense-report','download'),
    ('defense-result','read-own'),
    ('defense-result','components-read'),
    ('defense-result','history-read'),
    ('defense-result','final-read'),
    ('defense-report','grade-statistics'),
    ('defense-report','score-statistics'),
    ('defense-report','draft-preview'),
    ('defense-report','draft-export'),
    ('defense-report','list-export'),
    ('defense-report','components-export'),
    ('defense-report','final-export'),
    ('defense-report','comments-export'),
    ('defense-report','minutes-export'),
    ('defense-report','dossier-export'),
    ('defense-report','pii-export'),
    ('dossier','export')
)
SELECT e.resource,e.action,p.id IS NOT NULL AS already_defined,
  (SELECT count(*) FROM public."ROLE_PERMISSION" rp WHERE rp.permission_id=p.id) AS existing_grants
FROM expected e LEFT JOIN public."PERMISSION" p USING(resource,action) ORDER BY 1,2;
COMMIT;
