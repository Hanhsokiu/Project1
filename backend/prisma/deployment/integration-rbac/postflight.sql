DO $$ DECLARE baseline jsonb; expected jsonb; actual jsonb; BEGIN
 SELECT grants INTO baseline FROM rbac_before;
 SELECT coalesce(jsonb_agg(v ORDER BY v->>'role_id',v->>'permission_id'),'[]') INTO expected FROM (
  SELECT value v FROM jsonb_array_elements(baseline)
  UNION SELECT jsonb_build_object('role_id',role_id,'permission_id',permission_id)
   FROM datn_integration_rbac.created_grant WHERE run_id=(SELECT doc->>'runId' FROM rbac_approval)
 ) q;
 SELECT coalesce(jsonb_agg(to_jsonb(rp) ORDER BY role_id,permission_id),'[]') INTO actual FROM public."ROLE_PERMISSION" rp;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'RBAC_POSTFLIGHT_GRANT_DRIFT'; END IF;
 IF (SELECT doc->>'expectedScopeFingerprint' FROM rbac_approval) IS DISTINCT FROM pg_temp.rbac_scope_fingerprint() THEN RAISE EXCEPTION 'RBAC_POSTFLIGHT_SCOPE_DRIFT'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace n, LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='datn_integration_rbac' AND a.grantee=0) THEN RAISE EXCEPTION 'RBAC_PROVENANCE_SCHEMA_PUBLIC_ACL'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  WHERE n.nspname='datn_integration_rbac' AND a.grantee=0) THEN RAISE EXCEPTION 'RBAC_PROVENANCE_TABLE_PUBLIC_ACL'; END IF;
END $$;
