-- DRAFT, NOT APPROVED, NOT APPLIED. Generated offline by prepare-uc24-25-rbac.cjs.
-- Definitions only: NO role grants. Keep outside prisma/migrations until separately approved.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Serialize with RBAC editors; fail instead of blocking ordinary shared-db work indefinitely.
LOCK TABLE public."PERMISSION",public."ROLE_PERMISSION" IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA IF NOT EXISTS datn_rbac_uc24_25;
REVOKE ALL ON SCHEMA datn_rbac_uc24_25 FROM PUBLIC;
CREATE TABLE IF NOT EXISTS datn_rbac_uc24_25.run (
  id text PRIMARY KEY, manifest_sha256 text NOT NULL, grants_before jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS datn_rbac_uc24_25.created_permission (
  permission_id text PRIMARY KEY, row_snapshot jsonb NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA datn_rbac_uc24_25 FROM PUBLIC;
DO $manifest$
BEGIN
  IF EXISTS(SELECT 1 FROM datn_rbac_uc24_25.run WHERE id<>'v1' OR manifest_sha256<>'87885ce1ffc720c5342d4367f4f1437f54292f1f4d1ce1c3e66a367dbc40a335')
    THEN RAISE EXCEPTION 'RBAC manifest changed: stop for review'; END IF;
END; $manifest$;
INSERT INTO datn_rbac_uc24_25.run(id,manifest_sha256,grants_before)
SELECT 'v1','87885ce1ffc720c5342d4367f4f1437f54292f1f4d1ce1c3e66a367dbc40a335',(WITH expected(resource,action) AS (VALUES
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
SELECT coalesce(jsonb_agg(jsonb_build_array(rp.role_id,rp.permission_id) ORDER BY rp.role_id,rp.permission_id),'[]'::jsonb)
FROM public."ROLE_PERMISSION" rp JOIN public."PERMISSION" p ON p.id=rp.permission_id
JOIN expected e ON e.resource=p.resource AND e.action=p.action) ON CONFLICT(id) DO NOTHING;
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
), inserted AS (
  INSERT INTO public."PERMISSION"(id,resource,action,description)
  SELECT gen_random_uuid()::text,e.resource,e.action,'UC24/UC25 permission definition; role assignment requires separate approval'
  FROM expected e ON CONFLICT(resource,action) DO NOTHING RETURNING *
)
INSERT INTO datn_rbac_uc24_25.created_permission(permission_id,row_snapshot)
SELECT i.id,to_jsonb(i) FROM inserted i;
-- Do not insert/update/delete ROLE_PERMISSION. Definitions do not authorize any account.
COMMIT;
