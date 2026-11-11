-- Exactly four FACULTY read grants, approved conditionally; not a score/content grant.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
LOCK TABLE public."ROLE",public."PERMISSION",public."ROLE_PERMISSION" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public."ROLE" WHERE name='FACULTY')<>1 THEN RAISE EXCEPTION 'FACULTY not unique'; END IF;
 IF (WITH expected(resource,action) AS (VALUES ('defense-result','read'),('defense-report','read'),('defense-report','templates-read'),('defense-report','statistics')) SELECT count(*) FROM expected e JOIN public."PERMISSION" p USING(resource,action))<>4 THEN RAISE EXCEPTION 'Missing read definitions'; END IF;
END; $$;
CREATE SCHEMA IF NOT EXISTS datn_rbac_faculty_read;
REVOKE ALL ON SCHEMA datn_rbac_faculty_read FROM PUBLIC;
CREATE TABLE IF NOT EXISTS datn_rbac_faculty_read.run(id text PRIMARY KEY,grants_before jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS datn_rbac_faculty_read.created_grant(role_id text NOT NULL,permission_id text NOT NULL,resource text NOT NULL,action text NOT NULL,PRIMARY KEY(role_id,permission_id));
REVOKE ALL ON ALL TABLES IN SCHEMA datn_rbac_faculty_read FROM PUBLIC;
INSERT INTO datn_rbac_faculty_read.run SELECT 'v1',coalesce(jsonb_agg(to_jsonb(rp) ORDER BY role_id,permission_id),'[]') FROM public."ROLE_PERMISSION" rp ON CONFLICT(id) DO NOTHING;
WITH expected(resource,action) AS (VALUES ('defense-result','read'),('defense-report','read'),('defense-report','templates-read'),('defense-report','statistics')), inserted AS (
 INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN expected e JOIN public."PERMISSION" p ON p.resource=e.resource AND p.action=e.action WHERE r.name='FACULTY'
 ON CONFLICT(role_id,permission_id) DO NOTHING RETURNING role_id,permission_id
)
INSERT INTO datn_rbac_faculty_read.created_grant SELECT i.role_id,i.permission_id,p.resource,p.action FROM inserted i JOIN public."PERMISSION" p ON p.id=i.permission_id;
COMMIT;
