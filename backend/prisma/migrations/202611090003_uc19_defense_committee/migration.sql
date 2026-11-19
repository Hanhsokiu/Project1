-- REVIEW ONLY; after approved UC17 then UC18. Not in automatic deploy chain.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- V2 baseline identity preflight: catalog/role checks, never schema repair.
DO $uc_baseline$ DECLARE missing TEXT; BEGIN
  SELECT string_agg(e.t||'.'||e.c, ', ' ORDER BY e.t,e.c) INTO missing
  FROM (VALUES ('ROLE','id'),
    ('ROLE','name'),
    ('PERMISSION','resource'),
    ('PERMISSION','action'),
    ('ROLE_PERMISSION','role_id'),
    ('ROLE_PERMISSION','permission_id'),
    ('USER_ACCOUNT','id'),
    ('PROPOSAL','id'),
    ('PROPOSAL','term_id'),
    ('PROPOSAL','student_id'),
    ('TERM_PARAMETER','term_id'),
    ('TERM_PARAMETER','key'),
    ('TERM_PARAMETER','value'),
    ('DEFENSE_COMMITTEE','id'),
    ('DEFENSE_COMMITTEE','term_id'),
    ('DEFENSE_COMMITTEE','name')) e(t,c)
  LEFT JOIN information_schema.columns a ON a.table_schema='public'
    AND a.table_name=e.t AND a.column_name=e.c
  WHERE a.column_name IS NULL;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Required baseline columns missing: %',missing; END IF;
  IF EXISTS(SELECT 1 FROM (VALUES ('STUDENT'),('LECTURER'),('FACULTY')) x(name)
    LEFT JOIN public."ROLE" r ON r.name=x.name GROUP BY x.name HAVING count(r.id)<>1)
  THEN RAISE EXCEPTION 'Academic role identity mismatch; provisioning is not automatic'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=to_regclass('public."PERMISSION"')
    AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=2
    AND i.indkey[0]=(SELECT attnum FROM pg_attribute WHERE attrelid=i.indrelid AND attname='resource' AND NOT attisdropped)
    AND i.indkey[1]=(SELECT attnum FROM pg_attribute WHERE attrelid=i.indrelid AND attname='action' AND NOT attisdropped))
  OR NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=to_regclass('public."ROLE_PERMISSION"')
    AND i.indisprimary AND i.indisvalid AND i.indisready AND i.indnkeyatts=2
    AND i.indkey[0]=(SELECT attnum FROM pg_attribute WHERE attrelid=i.indrelid AND attname='role_id' AND NOT attisdropped)
    AND i.indkey[1]=(SELECT attnum FROM pg_attribute WHERE attrelid=i.indrelid AND attname='permission_id' AND NOT attisdropped))
  THEN RAISE EXCEPTION 'RBAC key identity mismatch; stop rather than repair'; END IF;
END $uc_baseline$;
-- V2 requires the reviewed invoker/full-visibility upstream guard identity.
DO $uc_guard_identity$ BEGIN
 IF EXISTS(SELECT 1 FROM (VALUES ('DEFENSE_ELIGIBILITY','eligibility_transition_guard','eligibility_transition_guard')) e(tbl,trg,fn)
   WHERE NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
     JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE t.tgrelid=to_regclass('public.'||quote_ident(e.tbl)) AND t.tgname=e.trg
       AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname=e.fn
       AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off']
       AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public')))
 THEN RAISE EXCEPTION 'Upstream v2 guard identity/configuration mismatch; stop'; END IF;
END $uc_guard_identity$;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."DEFENSE_ELIGIBILITY"'::regclass AND tgname='eligibility_transition_guard' AND tgenabled IN ('O','A'))
 THEN RAISE EXCEPTION 'UC18 reviewed migration required'; END IF;
END $$;
ALTER TABLE public."DEFENSE_COMMITTEE"
 ADD COLUMN code VARCHAR(50), ADD COLUMN department_id VARCHAR(36),
 ADD COLUMN revision INTEGER NOT NULL DEFAULT 0, ADD COLUMN state VARCHAR(20), ADD COLUMN context JSONB,
 ADD COLUMN created_by VARCHAR(36), ADD COLUMN updated_by VARCHAR(36), ADD COLUMN updated_at TIMESTAMPTZ(6),
 ADD COLUMN finalized_by VARCHAR(36), ADD COLUMN finalized_at TIMESTAMPTZ(6),
 ADD CONSTRAINT cc_provenance_valid CHECK (revision>=0 AND (
  (revision=0 AND state IS NULL AND code IS NULL AND department_id IS NULL AND context IS NULL AND created_by IS NULL AND updated_by IS NULL AND updated_at IS NULL AND finalized_by IS NULL AND finalized_at IS NULL)
  OR (revision>0 AND state IS NOT NULL AND state IN ('DRAFT','FINALIZED') AND code IS NOT NULL AND length(btrim(code))>0 AND department_id IS NOT NULL AND context IS NOT NULL AND created_by IS NOT NULL AND updated_by IS NOT NULL AND updated_at IS NOT NULL
   AND ((state='DRAFT' AND finalized_by IS NULL AND finalized_at IS NULL) OR (state='FINALIZED' AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL AND COALESCE(context->>'contentHash' ~ '^[a-f0-9]{64}$',false))))
 ) IS TRUE);
CREATE UNIQUE INDEX "DEFENSE_COMMITTEE_term_id_code_key" ON public."DEFENSE_COMMITTEE"(term_id,code);
-- Existing COMMITTEE_STUDENT has a mandatory session composite PK. Do not rewrite it or invent UC21 rooms/times.
CREATE TABLE public."DEFENSE_COMMITTEE_ASSIGNMENT" (
 id VARCHAR(36) PRIMARY KEY,
 committee_id TEXT NOT NULL REFERENCES public."DEFENSE_COMMITTEE"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 term_id VARCHAR(36) NOT NULL REFERENCES public."THESIS_TERM"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 term_student_id VARCHAR(36) NOT NULL REFERENCES public."TERM_STUDENT"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 proposal_id VARCHAR(36) NOT NULL REFERENCES public."PROPOSAL"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 state VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', revision INTEGER NOT NULL DEFAULT 1, context JSONB NOT NULL,
 assigned_by VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 assigned_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_by VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 updated_at TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT cca_provenance_valid CHECK(revision>0 AND state IN ('ACTIVE','REMOVED') AND COALESCE(context->>'advisorId'<>'',false) AND COALESCE(context->>'advisorHash' ~ '^[a-f0-9]{64}$',false) AND COALESCE(context->>'policyHash' ~ '^[a-f0-9]{64}$',false))
);
CREATE UNIQUE INDEX "DEFENSE_COMMITTEE_ASSIGNMENT_term_student_id_key" ON public."DEFENSE_COMMITTEE_ASSIGNMENT"(term_student_id);
CREATE UNIQUE INDEX "DEFENSE_COMMITTEE_ASSIGNMENT_proposal_id_key" ON public."DEFENSE_COMMITTEE_ASSIGNMENT"(proposal_id);
CREATE INDEX "DEFENSE_COMMITTEE_ASSIGNMENT_term_id_committee_id_state_idx" ON public."DEFENSE_COMMITTEE_ASSIGNMENT"(term_id,committee_id,state);
CREATE FUNCTION public.cc_check_student(cid TEXT,pid TEXT,tsid TEXT,binding JSONB) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE tid TEXT; advisor TEXT; assignment_id TEXT; assignment_revision INTEGER; n INTEGER;
BEGIN
 SELECT term_id INTO tid FROM public."DEFENSE_COMMITTEE" WHERE id=cid AND revision>0;
 IF tid IS NULL THEN RAISE EXCEPTION 'UC19 requires a verified committee'; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=tid FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public."TERM_STUDENT" s JOIN public."PROPOSAL" p ON p.student_id=s.student_id AND p.term_id=s.term_id
   JOIN public."TOPIC_WORKFLOW" w ON w."topicId"=p.topic_id AND w."termStudentId"=s.id AND w."termId"=s.term_id
   WHERE s.id=tsid AND s.term_id=tid AND p.id=pid)
 THEN RAISE EXCEPTION 'UC19 student/proposal/term mismatch'; END IF;
 SELECT count(*),min(a.advisor_id),min(a.id) INTO n,advisor,assignment_id
 FROM public."PROPOSAL" p JOIN public."REGISTRATION" r ON r.student_id=p.student_id AND r.term_id=p.term_id
 JOIN public."TERM_WORKFLOW" tw ON tw."termId"=p.term_id
 JOIN public."ASSIGNMENT_PLAN" ap ON ap.id=tw."officialAssignmentPlanId" AND ap.status='FINALIZED'
 JOIN public."ASSIGNMENT_PLAN_WORKFLOW" pw ON pw."planId"=ap.id AND pw."finalizedAt"<=now() AND pw."finalizedByUserId" IS NOT NULL
 JOIN public."ADVISOR_ASSIGNMENT" a ON a.assignment_plan_id=ap.id AND a.registration_id=r.id
 WHERE p.id=pid;
 IF n<>1 OR advisor IS NULL THEN RAISE EXCEPTION 'UC19 official advisor unavailable'; END IF;
 SELECT COALESCE(max("assignmentRevision"),0) INTO assignment_revision FROM public."ASSIGNMENT_CHANGE" WHERE "assignmentId"=assignment_id;
 IF EXISTS(SELECT 1 FROM public."ASSIGNMENT_CHANGE" WHERE "assignmentId"=assignment_id AND "assignmentRevision"=assignment_revision AND ("effectiveAt">now() OR "newAdvisorId"<>advisor))
 THEN RAISE EXCEPTION 'UC19 handover not effective'; END IF;
 IF EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" WHERE committee_id=cid AND lecturer_id=advisor)
 THEN RAISE EXCEPTION 'UC19 advisor conflicts with a committee member'; END IF;
 IF advisor IS DISTINCT FROM binding->>'advisorId' OR NOT EXISTS(
   SELECT 1 FROM public."DEFENSE_ELIGIBILITY" e WHERE e.proposal_id=pid AND e.revision>0 AND e.status='ELIGIBLE' AND e.finalized_at IS NOT NULL AND e.finalized_by IS NOT NULL
   AND e.context->>'termId'=tid AND e.context->>'termStudentId'=tsid
   AND e.revision::text=binding#>>'{eligibility,revision}'
   AND e.context->>'evidenceHash'=binding#>>'{eligibility,evidenceHash}'
   AND e.context->>'policyHash'=binding#>>'{eligibility,policyHash}'
   AND e.context#>>'{evidence,binding,assignmentId}'=assignment_id
   AND e.context#>>'{evidence,binding,assignmentRevision}'=assignment_revision::text)
 THEN RAISE EXCEPTION 'UC19 requires current finalized UC18 binding'; END IF;
 IF EXISTS(SELECT 1 FROM public."COMMITTEE_STUDENT" WHERE proposal_id=pid)
 THEN RAISE EXCEPTION 'Legacy session assignment requires reconciliation'; END IF;
END $$;
CREATE FUNCTION public.cc_transition_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.revision>0 THEN RAISE EXCEPTION 'UC19 committee deletion is not supported'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.revision>0 AND (OLD.state='FINALIZED' OR NEW.revision<>OLD.revision+1 OR NEW.term_id<>OLD.term_id OR NEW.created_by IS DISTINCT FROM OLD.created_by)
  THEN RAISE EXCEPTION 'UC19 committee locked or revision conflict'; END IF;
  IF OLD.revision=0 AND NEW.revision>0 THEN RAISE EXCEPTION 'Legacy committee requires explicit reconciliation'; END IF;
 ELSIF NEW.revision<>1 THEN RAISE EXCEPTION 'UC19 committee starts at revision one';
 END IF;
 IF NEW.revision>0 THEN
  PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.term_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public."DEPARTMENT" WHERE id=NEW.department_id)
   OR NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.created_by)
   OR NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.updated_by)
   OR (NEW.finalized_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.finalized_by))
  THEN RAISE EXCEPTION 'UC19 actor/department missing'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cc_transition_guard BEFORE INSERT OR UPDATE OR DELETE ON public."DEFENSE_COMMITTEE" FOR EACH ROW EXECUTE FUNCTION public.cc_transition_guard();
CREATE FUNCTION public.cc_member_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE cid TEXT; lid TEXT; c RECORD; a RECORD;
BEGIN
 IF TG_OP='DELETE' THEN cid:=OLD.committee_id; lid:=OLD.lecturer_id; ELSE cid:=NEW.committee_id; lid:=NEW.lecturer_id; END IF;
 IF TG_OP='UPDATE' AND NEW.committee_id<>OLD.committee_id THEN RAISE EXCEPTION 'Remove/add membership explicitly'; END IF;
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=cid;
 IF NOT FOUND THEN
  -- A normal legacy parent DELETE cascades after the parent row disappears.
  -- New committees cannot be deleted by cc_transition_guard; RLS filtering
  -- errors before this branch because row_security=off, never becomes NOT FOUND.
  IF TG_OP='DELETE' AND pg_trigger_depth()>1 AND NOT EXISTS(
    SELECT 1 FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=cid)
  THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'UC19 parent committee is not verifiable' USING ERRCODE='23514';
 END IF;
 IF c.revision>0 THEN
  PERFORM id FROM public."THESIS_TERM" WHERE id=c.term_id FOR UPDATE;
  IF c.state IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'UC19 committee is locked'; END IF;
  IF TG_OP<>'DELETE' THEN
   IF NEW.role IS NULL OR NEW.role NOT IN ('CHAIR','SECRETARY','MEMBER') OR NOT EXISTS(
    SELECT 1 FROM public."LECTURER" l JOIN public."TERM_LECTURER" r ON r.lecturer_id=l.id AND r.term_id=c.term_id
    JOIN public."USER_ACCOUNT" u ON u.id=l.user_id AND u.status='ACTIVE' WHERE l.id=lid AND l.is_active)
   THEN RAISE EXCEPTION 'UC19 member must be active in the term roster'; END IF;
   -- The new member is checked against EVERY currently assigned student's advisor.
   IF EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" ca
    JOIN public."PROPOSAL" p ON p.id=ca.proposal_id
    JOIN public."REGISTRATION" r ON r.term_id=p.term_id AND r.student_id=p.student_id
    JOIN public."TERM_WORKFLOW" w ON w."termId"=r.term_id
    JOIN public."ADVISOR_ASSIGNMENT" aa ON aa.assignment_plan_id=w."officialAssignmentPlanId" AND aa.registration_id=r.id
    WHERE ca.committee_id=cid AND ca.state='ACTIVE' AND aa.advisor_id=lid)
   THEN RAISE EXCEPTION 'UC19 new member advises a student already assigned here'; END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER cc_member_guard BEFORE INSERT OR UPDATE OR DELETE ON public."COMMITTEE_MEMBER" FOR EACH ROW EXECUTE FUNCTION public.cc_member_guard();
CREATE FUNCTION public.cca_transition_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE c RECORD;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'UC19 assignment removal must retain revision/history'; END IF;
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=NEW.committee_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'UC19 assignment parent is not verifiable' USING ERRCODE='23514'; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.term_id FOR UPDATE;
 IF c.revision IS NULL OR c.revision=0 OR c.state IS DISTINCT FROM 'DRAFT' OR c.term_id IS DISTINCT FROM NEW.term_id THEN RAISE EXCEPTION 'UC19 target committee unavailable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.revision<>OLD.revision+1 OR NEW.term_id<>OLD.term_id OR NEW.term_student_id<>OLD.term_student_id OR NEW.proposal_id<>OLD.proposal_id
   OR (OLD.state='ACTIVE' AND EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE" WHERE id=OLD.committee_id AND state='FINALIZED'))
  THEN RAISE EXCEPTION 'UC19 assignment locked/owner/revision mismatch'; END IF;
 ELSIF NEW.revision<>1 THEN RAISE EXCEPTION 'UC19 assignment starts at revision one'; END IF;
 IF NEW.state='ACTIVE' THEN PERFORM public.cc_check_student(NEW.committee_id,NEW.proposal_id,NEW.term_student_id,NEW.context); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cca_transition_guard BEFORE INSERT OR UPDATE OR DELETE ON public."DEFENSE_COMMITTEE_ASSIGNMENT" FOR EACH ROW EXECUTE FUNCTION public.cca_transition_guard();
CREATE FUNCTION public.cc_final_structure_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE c RECORD; a RECORD; n INTEGER; policy JSONB;
BEGIN
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.revision=0 THEN RETURN NULL; END IF; -- only legacy may be deleted in the same transaction
  RAISE EXCEPTION 'UC19 deferred committee is not verifiable' USING ERRCODE='23514';
 END IF;
 IF c.revision>0 AND c.state='FINALIZED' THEN
  SELECT count(*) INTO n FROM public."COMMITTEE_MEMBER" WHERE committee_id=c.id;
  IF n<3 OR n>5 THEN RAISE EXCEPTION 'UC19 finalized committee requires 3 to 5 members'; END IF;
  IF EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" m LEFT JOIN public."LECTURER" l ON l.id=m.lecturer_id
    LEFT JOIN public."USER_ACCOUNT" u ON u.id=l.user_id
    WHERE m.committee_id=c.id AND (l.id IS NULL OR NOT l.is_active OR u.status IS DISTINCT FROM 'ACTIVE'
      OR NOT EXISTS(SELECT 1 FROM public."TERM_LECTURER" r WHERE r.lecturer_id=l.id AND r.term_id=c.term_id)))
  THEN RAISE EXCEPTION 'UC19 finalized members must remain active in the term roster'; END IF;
  SELECT value::jsonb INTO policy FROM public."TERM_PARAMETER" WHERE term_id=c.term_id AND key='UC19_POLICY';
  -- JSON null is not an approved value. Validate shape before any casts;
  -- counts remain policy values, not assumptions about academic roles.
  IF (policy->>'status'='APPROVED'
    AND jsonb_typeof(policy->'approvedAt')='string'
    AND jsonb_typeof(policy->'chairCount')='number' AND policy->>'chairCount' ~ '^[0-9]+$'
    AND jsonb_typeof(policy->'secretaryCount')='number' AND policy->>'secretaryCount' ~ '^[0-9]+$'
    AND jsonb_typeof(policy->'allowEmptyFinalization')='boolean') IS NOT TRUE
  THEN RAISE EXCEPTION 'UC19 approved role policy shape required'; END IF;
  IF ((policy->>'approvedAt')::timestamptz<=now()
   AND (SELECT count(*) FROM public."COMMITTEE_MEMBER" WHERE committee_id=c.id AND role='CHAIR')=(policy->>'chairCount')::integer
   AND (SELECT count(*) FROM public."COMMITTEE_MEMBER" WHERE committee_id=c.id AND role='SECRETARY')=(policy->>'secretaryCount')::integer) IS NOT TRUE
  THEN RAISE EXCEPTION 'UC19 approved role policy required'; END IF;
  IF NOT (policy->>'allowEmptyFinalization')::boolean AND NOT EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=c.id AND state='ACTIVE')
  THEN RAISE EXCEPTION 'UC19 policy requires students before finalization'; END IF;
  FOR a IN SELECT * FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=c.id AND state='ACTIVE' LOOP
   PERFORM public.cc_check_student(c.id,a.proposal_id,a.term_student_id,a.context);
  END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cc_final_structure_guard AFTER INSERT OR UPDATE ON public."DEFENSE_COMMITTEE" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.cc_final_structure_guard();
ALTER TABLE public."DEFENSE_COMMITTEE_ASSIGNMENT" ENABLE ROW LEVEL SECURITY;
-- Only the NEW table receives security DDL. Preserve legacy committee/member
-- ACL/RLS; any change requires a separately approved runtime-role matrix.
REVOKE ALL ON public."DEFENSE_COMMITTEE_ASSIGNMENT" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public."DEFENSE_COMMITTEE_ASSIGNMENT" FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public."DEFENSE_COMMITTEE_ASSIGNMENT" FROM authenticated; END IF;
END $$;
INSERT INTO public."PERMISSION"(id,resource,action,description)
 SELECT gen_random_uuid()::text,'defense-committee',action,'UC19: '||action FROM (VALUES ('read'),('create'),('update'),('assign'),('finalize')) AS p(action)
 ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p WHERE r.name='FACULTY' AND p.resource='defense-committee'
 AND p.action IN ('read','create','update','assign','finalize') ON CONFLICT DO NOTHING;
COMMIT;
