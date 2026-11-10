-- REVIEW ONLY. B1–B8 -> approved UC17 -> UC18 -> UC19 -> UC20. Never auto-apply.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."DEFENSE_COMMITTEE_ASSIGNMENT"'::regclass AND tgname='cca_transition_guard' AND tgenabled IN ('O','A'))
 THEN RAISE EXCEPTION 'Approved UC19 schema required'; END IF;
END $$;
ALTER TABLE public."REVIEWER_ASSIGNMENT"
 ADD COLUMN term_id VARCHAR(36), ADD COLUMN term_student_id VARCHAR(36), ADD COLUMN committee_id VARCHAR(36),
 ADD COLUMN revision INTEGER NOT NULL DEFAULT 0, ADD COLUMN state VARCHAR(20), ADD COLUMN selected BOOLEAN,
 ADD COLUMN context JSONB, ADD COLUMN created_by VARCHAR(36), ADD COLUMN updated_by VARCHAR(36), ADD COLUMN updated_at TIMESTAMPTZ(6),
 ADD COLUMN finalized_by VARCHAR(36), ADD COLUMN finalized_at TIMESTAMPTZ(6),
 ADD CONSTRAINT rw_provenance_valid CHECK (revision>=0 AND (
  (revision=0 AND term_id IS NULL AND term_student_id IS NULL AND committee_id IS NULL AND state IS NULL AND selected IS NULL AND context IS NULL
   AND created_by IS NULL AND updated_by IS NULL AND updated_at IS NULL AND finalized_by IS NULL AND finalized_at IS NULL)
  OR (revision>0 AND term_id IS NOT NULL AND term_student_id IS NOT NULL AND committee_id IS NOT NULL AND state IN ('DRAFT','FINALIZED')
   AND selected IS NOT NULL AND context IS NOT NULL AND created_by IS NOT NULL AND updated_by IS NOT NULL AND updated_at IS NOT NULL
   AND COALESCE(context->>'evidenceHash' ~ '^[a-f0-9]{64}$',false) AND COALESCE(context->>'policyHash' ~ '^[a-f0-9]{64}$',false)
   AND ((state='DRAFT' AND finalized_by IS NULL AND finalized_at IS NULL) OR (state='FINALIZED' AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL)))
 ));
-- Keep existing PK, proposal FK, reviewer FK and unique(proposal_id, reviewer_id).
-- Nullable references on legacy rows are checked by transition guard for all new rows.
CREATE INDEX "REVIEWER_ASSIGNMENT_term_id_term_student_id_idx" ON public."REVIEWER_ASSIGNMENT"(term_id,term_student_id);
CREATE FUNCTION public.rw_check_binding(r public."REVIEWER_ASSIGNMENT") RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE advisor TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."TERM_STUDENT" s JOIN public."PROPOSAL" p ON p.student_id=s.student_id AND p.term_id=s.term_id
   JOIN public."TOPIC_WORKFLOW" w ON w."topicId"=p.topic_id AND w."termStudentId"=s.id AND w."termId"=s.term_id
   WHERE s.id=r.term_student_id AND s.term_id=r.term_id AND p.id=r.proposal_id)
 THEN RAISE EXCEPTION 'UC20 proposal/term/student mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE" c JOIN public."DEFENSE_COMMITTEE_ASSIGNMENT" a ON a.committee_id=c.id
   WHERE c.id=r.committee_id AND c.term_id=r.term_id AND c.state='FINALIZED' AND c.finalized_at<=now() AND c.finalized_by IS NOT NULL
   AND c.revision::text=r.context#>>'{committee,revision}' AND c.context->>'contentHash'=r.context#>>'{committee,evidenceHash}'
   AND a.term_student_id=r.term_student_id AND a.proposal_id=r.proposal_id AND a.state='ACTIVE'
   AND a.revision::text=r.context->>'committeeAssignmentRevision' AND a.context->>'advisorHash'=r.context->>'advisorHash')
 THEN RAISE EXCEPTION 'UC20 requires current finalized UC19 binding'; END IF;
 -- Reuses UC19 official-plan/latest-handover and ALL-member advisor conflict checks.
 PERFORM public.cc_check_student(r.committee_id,r.proposal_id,r.term_student_id,r.context);
 advisor:=r.context->>'advisorId';
 IF r.selected AND r.reviewer_id=advisor THEN RAISE EXCEPTION 'UC20 reviewer cannot be current official advisor'; END IF;
 IF r.selected AND NOT EXISTS(SELECT 1 FROM public."LECTURER" l JOIN public."TERM_LECTURER" t ON t.lecturer_id=l.id
   WHERE l.id=r.reviewer_id AND l.is_active AND t.term_id=r.term_id)
 THEN RAISE EXCEPTION 'UC20 reviewer not active in term roster'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=r.created_by)
  OR NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=r.updated_by)
  OR (r.finalized_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=r.finalized_by))
 THEN RAISE EXCEPTION 'UC20 actor missing'; END IF;
END $$;
CREATE FUNCTION public.rw_transition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.revision>0 THEN RAISE EXCEPTION 'UC20 retains rows/history; use explicit deselection'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.revision=0 AND NEW.revision>0 THEN RAISE EXCEPTION 'UC20 legacy requires explicit reconciliation'; END IF;
  IF OLD.revision>0 AND (OLD.state='FINALIZED' OR NEW.revision<>OLD.revision+1 OR NEW.id<>OLD.id
   OR NEW.proposal_id<>OLD.proposal_id OR NEW.reviewer_id<>OLD.reviewer_id OR NEW.term_id IS DISTINCT FROM OLD.term_id
   OR NEW.term_student_id IS DISTINCT FROM OLD.term_student_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at)
  THEN RAISE EXCEPTION 'UC20 immutable owner/finalized group/revision'; END IF;
 END IF;
 IF NEW.revision=0 THEN RETURN NEW; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.term_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public."REVIEWER_ASSIGNMENT" WHERE proposal_id=NEW.proposal_id AND id<>NEW.id AND
   (revision=0 OR (state='FINALIZED' AND (TG_OP='INSERT' OR revision<>NEW.revision OR NEW.state<>'FINALIZED'
     OR updated_by IS DISTINCT FROM NEW.updated_by OR updated_at IS DISTINCT FROM NEW.updated_at))))
 THEN RAISE EXCEPTION 'UC20 cannot modify a legacy or finalized group'; END IF;
 IF TG_OP='INSERT' AND NEW.state<>'DRAFT' THEN RAISE EXCEPTION 'UC20 starts as draft'; END IF;
 PERFORM public.rw_check_binding(NEW);
 RETURN NEW;
END $$;
CREATE TRIGGER rw_transition_guard BEFORE INSERT OR UPDATE OR DELETE ON public."REVIEWER_ASSIGNMENT" FOR EACH ROW EXECUTE FUNCTION public.rw_transition_guard();
CREATE FUNCTION public.rw_group_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public."REVIEWER_ASSIGNMENT"; v public."REVIEWER_ASSIGNMENT"; policy JSONB; n INTEGER; wanted INTEGER;
BEGIN
 SELECT * INTO r FROM public."REVIEWER_ASSIGNMENT" WHERE id=NEW.id;
 IF NOT FOUND OR r.revision=0 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public."REVIEWER_ASSIGNMENT" x WHERE x.proposal_id=r.proposal_id AND
   (x.revision<>r.revision OR x.state IS DISTINCT FROM r.state OR x.term_id IS DISTINCT FROM r.term_id
    OR x.term_student_id IS DISTINCT FROM r.term_student_id OR x.committee_id IS DISTINCT FROM r.committee_id
    OR x.context IS DISTINCT FROM r.context OR x.updated_by IS DISTINCT FROM r.updated_by OR x.updated_at IS DISTINCT FROM r.updated_at
    OR x.finalized_by IS DISTINCT FROM r.finalized_by OR x.finalized_at IS DISTINCT FROM r.finalized_at))
 THEN RAISE EXCEPTION 'UC20 group must advance atomically with one source/revision'; END IF;
 SELECT value::jsonb INTO policy FROM public."TERM_PARAMETER" WHERE term_id=r.term_id AND key='UC20_POLICY';
 IF policy IS NULL OR policy->>'status'<>'APPROVED' OR policy->>'version' IS DISTINCT FROM r.context->>'policyVersion'
  OR NOT COALESCE((policy->>'approvedAt')::timestamptz<=now(),false)
 THEN RAISE EXCEPTION 'UC20 approved policy required'; END IF;
 wanted:=(policy->>'reviewersPerStudent')::integer;
 SELECT count(*) INTO n FROM public."REVIEWER_ASSIGNMENT" WHERE proposal_id=r.proposal_id AND selected;
 IF wanted IS NULL OR wanted<1 OR n>wanted OR (r.state='FINALIZED' AND n<>wanted)
 THEN RAISE EXCEPTION 'UC20 reviewer count violates approved policy'; END IF;
 FOR v IN SELECT * FROM public."REVIEWER_ASSIGNMENT" WHERE proposal_id=r.proposal_id LOOP
  PERFORM public.rw_check_binding(v);
  IF v.selected THEN
   IF EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" WHERE committee_id=r.committee_id AND lecturer_id=v.reviewer_id)
     AND COALESCE(policy->>'committeeMembership','PENDING_APPROVAL')<>'ALLOW'
   THEN RAISE EXCEPTION 'UC20 committee/reviewer dual membership not permitted/approved'; END IF;
   IF COALESCE(policy->>'formerAdvisorRule','PENDING_APPROVAL')<>'ALLOW' AND EXISTS(
    SELECT 1 FROM public."PROPOSAL" p JOIN public."REGISTRATION" reg ON reg.student_id=p.student_id AND reg.term_id=p.term_id
    JOIN public."ADVISOR_ASSIGNMENT" aa ON aa.registration_id=reg.id
    JOIN public."ASSIGNMENT_PLAN" ap ON ap.id=aa.assignment_plan_id AND ap.status IN ('FINALIZED','PUBLISHED')
    LEFT JOIN public."ASSIGNMENT_CHANGE" ch ON ch."assignmentId"=aa.id
    WHERE p.id=r.proposal_id AND (aa.advisor_id=v.reviewer_id OR ch."oldAdvisorId"=v.reviewer_id OR ch."newAdvisorId"=v.reviewer_id))
   THEN RAISE EXCEPTION 'UC20 former advisor rule not permitted/approved'; END IF;
  END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER rw_group_guard AFTER INSERT OR UPDATE ON public."REVIEWER_ASSIGNMENT" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.rw_group_guard();
ALTER TABLE public."REVIEWER_ASSIGNMENT" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."REVIEWER_ASSIGNMENT" FROM PUBLIC;
DO $$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON public."REVIEWER_ASSIGNMENT" FROM %I',role_name); END IF;
 END LOOP;
END $$;
INSERT INTO public."PERMISSION"(id,resource,action,description)
 SELECT 'uc20-reviewer-'||a,'defense-reviewer',a,'UC20 faculty-scoped '||a FROM unnest(ARRAY['read','assign','update','finalize']) AS a
 ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p
 WHERE r.name='FACULTY' AND p.resource='defense-reviewer' AND p.action IN ('read','assign','update','finalize')
 ON CONFLICT DO NOTHING;
COMMIT;
