-- Separate incident approval required. One transaction; set datn.rbac_rollback_run and datn.rbac_rollback_authorized=true.
SET LOCAL lock_timeout='5s';
LOCK TABLE public."ROLE_PERMISSION",datn_integration_rbac.release,datn_integration_rbac.created_grant IN SHARE ROW EXCLUSIVE MODE;
DO $$ DECLARE r datn_integration_rbac.release; actual jsonb; expected jsonb; BEGIN
 IF current_setting('datn.rbac_rollback_authorized',true) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'RBAC_ROLLBACK_APPROVAL_REQUIRED'; END IF;
 SELECT * INTO r FROM datn_integration_rbac.release WHERE run_id=current_setting('datn.rbac_rollback_run',true) FOR UPDATE;
 IF NOT FOUND OR r.rolled_back_at IS NOT NULL THEN RAISE EXCEPTION 'RBAC_ROLLBACK_RELEASE_NOT_ACTIVE'; END IF;
 SELECT coalesce(jsonb_agg(v ORDER BY v->>'role_id',v->>'permission_id'),'[]') INTO expected FROM (
  SELECT value v FROM jsonb_array_elements(r.grants_before)
  UNION SELECT jsonb_build_object('role_id',role_id,'permission_id',permission_id)
   FROM datn_integration_rbac.created_grant WHERE run_id=r.run_id
 ) q;
 SELECT coalesce(jsonb_agg(to_jsonb(rp) ORDER BY role_id,permission_id),'[]') INTO actual FROM public."ROLE_PERMISSION" rp;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'RBAC_ROLLBACK_GRANT_DRIFT_REVIEW_REQUIRED'; END IF;
 DELETE FROM public."ROLE_PERMISSION" rp USING datn_integration_rbac.created_grant c
  WHERE c.run_id=r.run_id AND c.role_id=rp.role_id AND c.permission_id=rp.permission_id;
 SELECT coalesce(jsonb_agg(to_jsonb(rp) ORDER BY role_id,permission_id),'[]') INTO actual FROM public."ROLE_PERMISSION" rp;
 IF actual IS DISTINCT FROM r.grants_before THEN RAISE EXCEPTION 'RBAC_ROLLBACK_RESTORE_MISMATCH'; END IF;
 UPDATE datn_integration_rbac.release SET rolled_back_at=clock_timestamp() WHERE run_id=r.run_id;
END $$;
