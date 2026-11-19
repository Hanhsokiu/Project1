-- Separate incident approval is required before ANY production rollback.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public."ROLE",public."PERMISSION",public."ROLE_PERMISSION" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regnamespace('datn_rbac_faculty_read') IS NULL THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM datn_rbac_faculty_read.run WHERE id='v1') THEN RAISE EXCEPTION 'Missing provenance'; END IF;
 IF (WITH baseline AS (SELECT b.role_id,b.permission_id FROM datn_rbac_faculty_read.run r CROSS JOIN LATERAL jsonb_to_recordset(r.grants_before) AS b(role_id text,permission_id text)),
 desired AS (SELECT * FROM baseline UNION SELECT role_id,permission_id FROM datn_rbac_faculty_read.created_grant),
 delta AS ((SELECT role_id,permission_id FROM public."ROLE_PERMISSION" EXCEPT SELECT * FROM desired) UNION ALL (SELECT * FROM desired EXCEPT SELECT role_id,permission_id FROM public."ROLE_PERMISSION")) SELECT count(*) FROM delta)<>0 THEN RAISE EXCEPTION 'Concurrent grant edits: stop rollback'; END IF;
 IF EXISTS(SELECT 1 FROM datn_rbac_faculty_read.created_grant c LEFT JOIN public."ROLE" r ON r.id=c.role_id LEFT JOIN public."PERMISSION" p ON p.id=c.permission_id WHERE r.name IS DISTINCT FROM 'FACULTY' OR p.resource IS DISTINCT FROM c.resource OR p.action IS DISTINCT FROM c.action) THEN RAISE EXCEPTION 'Role/permission identity changed'; END IF;
 DELETE FROM public."ROLE_PERMISSION" rp USING datn_rbac_faculty_read.created_grant c WHERE rp.role_id=c.role_id AND rp.permission_id=c.permission_id;
 DROP TABLE datn_rbac_faculty_read.created_grant; DROP TABLE datn_rbac_faculty_read.run; DROP SCHEMA datn_rbac_faculty_read;
END; $$;
COMMIT;
