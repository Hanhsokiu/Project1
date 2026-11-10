-- DRAFT, NOT APPROVED, NOT APPLIED. Generated offline by prepare-uc24-25-rbac.cjs.
-- Definitions only: NO role grants. Keep outside prisma/migrations until separately approved.
BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
DO $postflight$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM datn_rbac_uc24_25.run WHERE id='v1' AND manifest_sha256='87885ce1ffc720c5342d4367f4f1437f54292f1f4d1ce1c3e66a367dbc40a335')
    THEN RAISE EXCEPTION 'Missing/mismatched RBAC provenance'; END IF;
  IF (WITH expected(resource,action) AS (VALUES
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
) SELECT count(*) FROM expected e JOIN public."PERMISSION" p USING(resource,action))<>27
    THEN RAISE EXCEPTION 'Missing permission definitions'; END IF;
  IF (WITH expected(resource,action) AS (VALUES
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
JOIN expected e ON e.resource=p.resource AND e.action=p.action) IS DISTINCT FROM (SELECT grants_before FROM datn_rbac_uc24_25.run WHERE id='v1')
    THEN RAISE EXCEPTION 'Role grants changed: inspect concurrent/unauthorized changes'; END IF;
  IF EXISTS(SELECT 1 FROM datn_rbac_uc24_25.created_permission c LEFT JOIN public."PERMISSION" p ON p.id=c.permission_id
    WHERE to_jsonb(p) IS DISTINCT FROM c.row_snapshot)
    THEN RAISE EXCEPTION 'Created permission changed or missing'; END IF;
END; $postflight$;
SELECT 'PASS_DEFINITIONS_ONLY_NO_ROLE_GRANTS' AS result,
  (SELECT count(*) FROM datn_rbac_uc24_25.created_permission) AS created_definitions;
COMMIT;
