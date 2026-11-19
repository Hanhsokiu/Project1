-- DRAFT, NOT APPROVED, NOT APPLIED. Generated offline by prepare-uc24-25-rbac.cjs.
-- Definitions only: NO role grants. Keep outside prisma/migrations until separately approved.
-- Only before a separately approved role-grant rollout. Never cascade-delete grants.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public."PERMISSION",public."ROLE_PERMISSION" IN SHARE ROW EXCLUSIVE MODE;
DO $rollback$
BEGIN
  -- Repeat rollback is a no-op; an unexpected/incomplete provenance schema is an error.
  IF to_regnamespace('datn_rbac_uc24_25') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM datn_rbac_uc24_25.run WHERE id='v1' AND manifest_sha256='87885ce1ffc720c5342d4367f4f1437f54292f1f4d1ce1c3e66a367dbc40a335')
    THEN RAISE EXCEPTION 'Cannot establish rollback ownership'; END IF;
  IF EXISTS(SELECT 1 FROM datn_rbac_uc24_25.created_permission c JOIN public."ROLE_PERMISSION" rp ON rp.permission_id=c.permission_id)
    THEN RAISE EXCEPTION 'Created permissions now have grants; revoke with separate approval first'; END IF;
  IF EXISTS(SELECT 1 FROM datn_rbac_uc24_25.created_permission c LEFT JOIN public."PERMISSION" p ON p.id=c.permission_id
    WHERE to_jsonb(p) IS DISTINCT FROM c.row_snapshot)
    THEN RAISE EXCEPTION 'Created permissions changed: do not destroy others edits'; END IF;
  DELETE FROM public."PERMISSION" p USING datn_rbac_uc24_25.created_permission c WHERE p.id=c.permission_id;
  DROP TABLE datn_rbac_uc24_25.created_permission;
  DROP TABLE datn_rbac_uc24_25.run;
  DROP SCHEMA datn_rbac_uc24_25; -- no CASCADE: unknown dependencies abort the whole transaction
END; $rollback$;
COMMIT;
