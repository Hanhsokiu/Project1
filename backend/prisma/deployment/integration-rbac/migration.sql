-- Explicitly approved GLOBAL actions; do not execute independently of preflight.
CREATE SCHEMA IF NOT EXISTS datn_integration_rbac;
REVOKE ALL ON SCHEMA datn_integration_rbac FROM PUBLIC;
CREATE TABLE IF NOT EXISTS datn_integration_rbac.release (
 run_id text PRIMARY KEY, approval jsonb NOT NULL, grants_before jsonb NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp(), rolled_back_at timestamptz
);
CREATE TABLE IF NOT EXISTS datn_integration_rbac.created_grant (
 run_id text NOT NULL REFERENCES datn_integration_rbac.release(run_id), role_id text NOT NULL,
 permission_id text NOT NULL, PRIMARY KEY(run_id,role_id,permission_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA datn_integration_rbac FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM datn_integration_rbac.release WHERE run_id=(SELECT doc->>'runId' FROM rbac_approval)) THEN
  RAISE EXCEPTION 'RBAC_RELEASE_ALREADY_RECORDED';
 END IF;
END $$;
INSERT INTO datn_integration_rbac.release(run_id,approval,grants_before)
 SELECT doc->>'runId',doc,grants FROM rbac_approval CROSS JOIN rbac_before;
WITH requested AS (
 SELECT r.id role_id,p.id permission_id FROM rbac_approval a CROSS JOIN LATERAL jsonb_array_elements(a.doc->'requests') req
 JOIN public."ROLE" r ON r.name=req->>'role'
 JOIN public."PERMISSION" p ON p.resource=req->>'resource' AND p.action=req->>'action'
), added AS (
 INSERT INTO public."ROLE_PERMISSION" SELECT role_id,permission_id FROM requested ON CONFLICT DO NOTHING RETURNING role_id,permission_id
)
INSERT INTO datn_integration_rbac.created_grant SELECT (SELECT doc->>'runId' FROM rbac_approval),role_id,permission_id FROM added;
