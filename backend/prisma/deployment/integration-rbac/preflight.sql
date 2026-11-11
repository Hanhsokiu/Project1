-- Run in ONE transaction/session with migration.sql and postflight.sql.
-- SET LOCAL datn.rbac_approval = '<reviewed JSON from protected external file>';
-- This package grants GLOBAL role actions only after explicit global-impact approval.
-- It never pretends that ROLE_PERMISSION is scoped by term or user.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=72707369 AND granted) THEN
  RAISE EXCEPTION 'RBAC_PRISMA_LOCK_ACTIVE';
 END IF;
 IF NOT pg_try_advisory_xact_lock(71502425) THEN RAISE EXCEPTION 'RBAC_RELEASE_CONCURRENT'; END IF;
END $$;
LOCK TABLE public."ROLE", public."PERMISSION", public."ROLE_PERMISSION", public."USER_ROLE", public."USER_ACCOUNT",
 public."ACADEMIC_TERM_GRANT", public."GRANT_DEPARTMENT" IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE rbac_approval ON COMMIT DROP AS SELECT current_setting('datn.rbac_approval',true)::jsonb AS doc;
CREATE TEMP TABLE rbac_before ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY role_id,permission_id),'[]'::jsonb) AS grants FROM public."ROLE_PERMISSION" g;
CREATE OR REPLACE FUNCTION pg_temp.rbac_scope_fingerprint() RETURNS text LANGUAGE sql AS $$
 SELECT md5(jsonb_build_object(
  'users',(SELECT coalesce(jsonb_agg(jsonb_build_array(id,status) ORDER BY id),'[]') FROM public."USER_ACCOUNT"),
  'roles',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY user_id,role_id),'[]') FROM public."USER_ROLE" r),
  'terms',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY id),'[]') FROM public."ACADEMIC_TERM_GRANT" g),
  'departments',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY id),'[]') FROM public."GRANT_DEPARTMENT" d)
 )::text)
$$;
DO $$ DECLARE d jsonb; req jsonb; role_key text; actual_users jsonb; BEGIN
 SELECT doc INTO d FROM rbac_approval;
 IF d IS NULL OR d->>'status' IS DISTINCT FROM 'APPROVED' OR d->>'impact' IS DISTINCT FROM 'GLOBAL_ROLE_ALL_CURRENT_AND_FUTURE_USERS'
  OR d->'approvedGlobalRoleImpact' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'RBAC_GLOBAL_IMPACT_APPROVAL_REQUIRED'; END IF;
 IF d->>'database' IS DISTINCT FROM current_database() THEN RAISE EXCEPTION 'RBAC_TARGET_MISMATCH'; END IF;
 IF coalesce(d->>'runId','') !~ '^[A-Za-z0-9_-]{8,100}$' OR coalesce(length(d->>'decisionReference'),0)<8 OR coalesce(length(d->>'backupEvidence'),0)<8
  OR (d->>'approvedAt')::timestamptz > clock_timestamp() OR (d->>'expiresAt')::timestamptz <= clock_timestamp()
  OR d->>'approvedAt' IS NULL OR d->>'expiresAt' IS NULL THEN RAISE EXCEPTION 'RBAC_APPROVAL_METADATA_INVALID'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public."USER_ACCOUNT" u JOIN public."USER_ROLE" ur ON ur.user_id=u.id JOIN public."ROLE" r ON r.id=ur.role_id
  WHERE u.id=d->>'approvedBy' AND u.status='ACTIVE' AND r.name='ADMIN') THEN RAISE EXCEPTION 'RBAC_REAL_ACTIVE_ADMIN_APPROVER_REQUIRED'; END IF;
 IF (d->>'expectedGrantCount')::int IS DISTINCT FROM (SELECT count(*)::int FROM public."ROLE_PERMISSION")
  OR d->>'expectedScopeFingerprint' IS DISTINCT FROM pg_temp.rbac_scope_fingerprint() THEN RAISE EXCEPTION 'RBAC_SCOPE_OR_COUNT_CHANGED'; END IF;
 IF jsonb_typeof(d->'requests') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'requests')=0 THEN RAISE EXCEPTION 'RBAC_REQUESTS_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(d->'requests') e GROUP BY e->>'role',e->>'resource',e->>'action' HAVING count(*)>1) THEN RAISE EXCEPTION 'RBAC_DUPLICATE_REQUEST'; END IF;
 FOR req IN SELECT value FROM jsonb_array_elements(d->'requests') LOOP
  IF req->>'role' NOT IN ('FACULTY','LECTURER','STUDENT') OR req->>'role' IS NULL OR req->>'resource' NOT IN ('defense-result','defense-report','dossier')
   OR req->>'resource' IS NULL THEN RAISE EXCEPTION 'RBAC_UNSUPPORTED_ROLE_OR_RESOURCE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM (VALUES
   ('defense-result','read'),('defense-result','confirm'),('defense-result','finalize'),('defense-result','publish'),
   ('defense-result','read-own'),('defense-result','components-read'),('defense-result','history-read'),('defense-result','final-read'),
   ('defense-report','read'),('defense-report','templates-read'),('defense-report','statistics'),('defense-report','preview'),
   ('defense-report','export'),('defense-report','history-read'),('defense-report','download'),('defense-report','grade-statistics'),
   ('defense-report','score-statistics'),('defense-report','draft-preview'),('defense-report','draft-export'),('defense-report','list-export'),
   ('defense-report','components-export'),('defense-report','final-export'),('defense-report','comments-export'),('defense-report','minutes-export'),
   ('defense-report','dossier-export'),('defense-report','pii-export'),('dossier','export')
  ) allowed(resource,action) WHERE allowed.resource=req->>'resource' AND allowed.action=req->>'action') THEN RAISE EXCEPTION 'RBAC_NOT_IN_REVIEWED_27'; END IF;
  IF NOT (
   (req->>'resource'='defense-result' AND (
    (req->>'action' IN ('read','components-read')) OR
    (req->>'action'='confirm' AND req->>'role'='LECTURER') OR
    (req->>'action' IN ('finalize','publish') AND req->>'role'='FACULTY') OR
    (req->>'action' IN ('read-own','final-read') AND req->>'role'='STUDENT') OR
    (req->>'action'='history-read' AND req->>'role' IN ('FACULTY','LECTURER'))
   )) OR
   (req->>'resource'='defense-report' AND (
    req->>'role'='FACULTY' OR (req->>'role'='LECTURER' AND req->>'action' IN ('read','templates-read','statistics'))
   )) OR (req->>'resource'='dossier' AND req->>'role'='FACULTY' AND req->>'action'='export')
  ) THEN RAISE EXCEPTION 'RBAC_ROLE_ACTION_NOT_IN_REVIEWED_MAPPING'; END IF;
  SELECT id INTO role_key FROM public."ROLE" WHERE name=req->>'role';
  IF role_key IS NULL OR NOT EXISTS (SELECT 1 FROM public."PERMISSION" WHERE resource=req->>'resource' AND action=req->>'action') THEN RAISE EXCEPTION 'RBAC_UNDEFINED_PERMISSION'; END IF;
  SELECT coalesce(jsonb_agg(user_id ORDER BY user_id),'[]') INTO actual_users FROM public."USER_ROLE" WHERE role_id=role_key;
  IF jsonb_typeof(req->'affectedUserIds') IS DISTINCT FROM 'array' OR req->'affectedUserIds' IS DISTINCT FROM actual_users THEN RAISE EXCEPTION 'RBAC_AFFECTED_USERS_CHANGED'; END IF;
 END LOOP;
END $$;
