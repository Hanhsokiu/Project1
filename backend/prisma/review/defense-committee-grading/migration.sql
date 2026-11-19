-- REVIEW ONLY; never auto-apply. B1-B8 -> UC17/18/19 -> UC20/22 and UC21 -> UC23.
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
    ('SCORE_ENTRY','id'),
    ('SCORE_ENTRY','proposal_id'),
    ('SCORE_ENTRY','scorer_id'),
    ('SCORE_ENTRY','role'),
    ('SCORE_ENTRY','total_score'),
    ('SCORE_ENTRY','is_locked'),
    ('SCORE_ENTRY','revision'),
    ('SCORE_ENTRY','context'),
    ('SCORE_ENTRY','report_version_id')) e(t,c)
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
 IF EXISTS(SELECT 1 FROM (VALUES ('SCORE_ENTRY','rg_score_guard','rg_score_guard'),
    ('SCORE_DETAIL','rg_detail_guard','rg_detail_guard'),
    ('DEFENSE_SESSION','sc_booking_mutex_guard','sc_booking_mutex_guard')) e(tbl,trg,fn)
   WHERE NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
     JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE t.tgrelid=to_regclass('public.'||quote_ident(e.tbl)) AND t.tgname=e.trg
       AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname=e.fn
       AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off']
       AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public')))
 THEN RAISE EXCEPTION 'Upstream v2 guard identity/configuration mismatch; stop'; END IF;
END $uc_guard_identity$;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."SCORE_ENTRY"'::regclass AND tgname='rg_score_guard' AND tgenabled IN ('O','A'))
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."DEFENSE_COMMITTEE"'::regclass AND tgname='cc_transition_guard' AND tgenabled IN ('O','A'))
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."DEFENSE_SESSION"'::regclass AND tgname='sc_transition_guard' AND tgenabled IN ('O','A'))
 OR (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND (table_name,column_name) IN (('SCORE_ENTRY','total_score'),('SCORE_DETAIL','score')) AND numeric_precision=4 AND numeric_scale=1)<>2
 THEN RAISE EXCEPTION 'UC23 dependency/precision mismatch; stop and review'; END IF;
END $$;
-- Preserve both earlier branches verbatim. No legacy data is rewritten.
ALTER TABLE public."SCORE_ENTRY" DROP CONSTRAINT final_advisor_score_valid;
ALTER TABLE public."SCORE_ENTRY" ADD CONSTRAINT final_advisor_score_valid CHECK(
 revision>=0 AND (report_version_id IS NULL OR
  (role='ADVISOR' AND context IS NOT NULL AND total_score IS NOT NULL AND total_score BETWEEN 0 AND 10 AND length(btrim(coalesce(comment,'')))>0)
  OR (role='REVIEWER' AND context IS NOT NULL AND context->>'kind'='UC22' AND (total_score IS NULL OR total_score BETWEEN 0 AND 10))
  OR (role='COMMITTEE_MEMBER' AND context IS NOT NULL AND context->>'kind'='UC23' AND (total_score IS NULL OR total_score BETWEEN 0 AND 10))) IS TRUE);
ALTER TABLE public."SCORE_ENTRY" ADD CONSTRAINT cg_record_valid CHECK(
 NOT(role IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') AND COALESCE(context->>'kind','')='UC23') OR COALESCE(
  role='COMMITTEE_MEMBER' AND revision>0 AND report_version_id IS NOT NULL AND context->>'termId' IS NOT NULL
  AND context->>'termStudentId' IS NOT NULL AND context->>'committeeId' IS NOT NULL AND context->>'lecturerId'=scorer_id
  AND context->>'memberRole' IN ('CHAIR','SECRETARY','MEMBER') AND context->>'bindingHash' ~ '^[a-f0-9]{64}$'
  AND jsonb_typeof(context->'policy')='object' AND context#>>'{policy,status}'='APPROVED'
  AND context#>>'{policy,version}'=context->>'policyVersion' AND context#>>'{policy,rubric,version}'=context->>'rubricVersion'
  AND context#>>'{command,reportVersionId}'=report_version_id AND context#>>'{schedule,sessionId}' IS NOT NULL
  AND context#>>'{command,reportChecksum}' ~ '^[a-f0-9]{64}$' AND context->>'updatedBy' IS NOT NULL,false));
CREATE FUNCTION public.cg_score_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE c public."DEFENSE_COMMITTEE"; a public."DEFENSE_COMMITTEE_ASSIGNMENT"; d public."DEFENSE_SESSION";
BEGIN
 -- Preserve maintenance of existing genuine legacy rows without adopting them.
 IF OLD.revision=0 AND OLD.report_version_id IS NULL AND OLD.context IS NULL AND TG_OP IN ('UPDATE','DELETE') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.revision=0 AND NEW.report_version_id IS NULL AND NEW.context IS NULL AND NEW.comment IS NULL
    AND NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.proposal_id IS NOT DISTINCT FROM OLD.proposal_id
    AND NEW.scorer_id IS NOT DISTINCT FROM OLD.scorer_id AND NEW.role IS NOT DISTINCT FROM OLD.role
  THEN RETURN NEW; END IF;
  IF OLD.role IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') THEN RAISE EXCEPTION 'Cannot adopt a legacy committee grade'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.role IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') THEN RAISE EXCEPTION 'Retain committee scores/history, including legacy'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.role IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') THEN
  IF OLD.context->>'kind' IS DISTINCT FROM 'UC23' OR OLD.is_locked OR NEW.id<>OLD.id OR NEW.proposal_id<>OLD.proposal_id OR NEW.scorer_id<>OLD.scorer_id OR NEW.role<>OLD.role
   OR NEW.context->>'bindingHash' IS DISTINCT FROM OLD.context->>'bindingHash'
  THEN RAISE EXCEPTION 'Committee grade owner/final/legacy/binding immutable'; END IF;
  IF NOT(NEW.revision=OLD.revision+1 OR (NEW.revision=OLD.revision AND NEW.is_locked AND NOT OLD.is_locked
   AND (to_jsonb(NEW)-'is_locked'-'updated_at')=(to_jsonb(OLD)-'is_locked'-'updated_at')))
  THEN RAISE EXCEPTION 'Committee grade CAS revision invalid'; END IF;
 END IF;
 IF NEW.role NOT IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') THEN RETURN NEW; END IF;
 IF NEW.role<>'COMMITTEE_MEMBER' OR NEW.context->>'kind' IS DISTINCT FROM 'UC23' THEN RAISE EXCEPTION 'No new legacy committee scores'; END IF;
 IF TG_OP='UPDATE' AND OLD.role NOT IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') THEN RAISE EXCEPTION 'Cannot convert ADVISOR/REVIEWER score'; END IF;
 IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'Committee score starts at revision 1'; END IF;
 IF EXISTS(SELECT 1 FROM public."SCORE_ENTRY" e WHERE e.proposal_id=NEW.proposal_id AND e.scorer_id=NEW.scorer_id AND e.role IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') AND e.id<>NEW.id)
 THEN RAISE EXCEPTION 'Existing committee sheet requires reconciliation, not role duplication'; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.context->>'termId' FOR UPDATE;
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=NEW.context->>'committeeId' FOR UPDATE;
 IF NOT FOUND OR c.term_id IS DISTINCT FROM NEW.context->>'termId' OR c.state IS DISTINCT FROM 'FINALIZED'
  OR c.revision::text IS DISTINCT FROM NEW.context#>>'{command,committeeRevision}'
  OR c.context->>'contentHash' IS DISTINCT FROM NEW.context#>>'{command,committeeEvidenceHash}'
 THEN RAISE EXCEPTION 'Committee grade requires finalized committee binding'; END IF;
 SELECT * INTO a FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=c.id AND proposal_id=NEW.proposal_id AND term_student_id=NEW.context->>'termStudentId' AND state='ACTIVE' FOR UPDATE;
 IF NOT FOUND OR a.revision::text IS DISTINCT FROM NEW.context#>>'{command,assignmentRevision}' THEN RAISE EXCEPTION 'Student not currently assigned to committee'; END IF;
 PERFORM public.cc_check_student(c.id,NEW.proposal_id,a.term_student_id,a.context);
 IF NOT EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" m JOIN public."LECTURER" l ON l.id=m.lecturer_id JOIN public."USER_ACCOUNT" u ON u.id=l.user_id
  JOIN public."USER_ROLE" ur ON ur.user_id=u.id JOIN public."ROLE" r ON r.id=ur.role_id
  WHERE m.committee_id=c.id AND m.lecturer_id=NEW.scorer_id AND m.role=NEW.context->>'memberRole' AND l.is_active
   AND u.status='ACTIVE' AND u.id=NEW.context->>'updatedBy' AND r.name='LECTURER')
 THEN RAISE EXCEPTION 'Committee actor must be the actual active member'; END IF;
 SELECT * INTO d FROM public."DEFENSE_SESSION" WHERE id=NEW.context#>>'{schedule,sessionId}' FOR UPDATE;
 IF NOT FOUND OR d.committee_id<>c.id OR d.state IS DISTINCT FROM 'FINALIZED'
  OR d.revision::text IS DISTINCT FROM NEW.context#>>'{schedule,revision}'
  OR d.context->>'evidenceHash' IS DISTINCT FROM NEW.context#>>'{schedule,evidenceHash}'
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.context->'slots') x WHERE x->>'termStudentId'=a.term_student_id AND x->>'proposalId'=NEW.proposal_id)
 THEN RAISE EXCEPTION 'Committee grade schedule binding not current'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION" v JOIN public."FINAL_REPORT" f ON f.id=v.report_id JOIN public."FILE_ASSET" b ON b.id=v.file_asset_id
  WHERE v.id=NEW.report_version_id AND f.proposal_id=NEW.proposal_id AND b.kind='REPORT' AND b.state='READY' AND b."mimeType"='application/pdf'
   AND b.checksum=NEW.context#>>'{command,reportChecksum}' AND v.sequence=(SELECT max(v2.sequence) FROM public."FINAL_REPORT_VERSION" v2 WHERE v2.report_id=f.id))
 THEN RAISE EXCEPTION 'Committee grade PDF binding not current'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg_score_guard BEFORE INSERT OR UPDATE OR DELETE ON public."SCORE_ENTRY" FOR EACH ROW EXECUTE FUNCTION public.cg_score_guard();
CREATE FUNCTION public.cg_detail_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE p public."SCORE_ENTRY"; previous public."SCORE_ENTRY";
BEGIN
 IF TG_OP='UPDATE' AND NEW.score_entry_id<>OLD.score_entry_id THEN
  SELECT * INTO previous FROM public."SCORE_ENTRY" WHERE id=OLD.score_entry_id FOR UPDATE;
  IF previous.role IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') THEN RAISE EXCEPTION 'Cannot transfer committee detail'; END IF;
 END IF;
 SELECT * INTO p FROM public."SCORE_ENTRY" WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.score_entry_id ELSE NEW.score_entry_id END FOR UPDATE;
 IF NOT FOUND THEN
  IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Committee detail parent is not verifiable' USING ERRCODE='23514';
 END IF;
 IF p.role IN ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') THEN
  IF p.revision=0 AND p.report_version_id IS NULL AND p.context IS NULL THEN
   IF TG_OP='DELETE' THEN RETURN OLD; END IF;
   RETURN NEW;
  END IF;
  IF p.is_locked OR p.context->>'kind' IS DISTINCT FROM 'UC23' THEN RAISE EXCEPTION 'Committee details immutable for legacy/finalized'; END IF;
  IF TG_OP='UPDATE' AND NEW.score_entry_id<>OLD.score_entry_id THEN RAISE EXCEPTION 'Cannot move other details into committee sheet'; END IF;
  IF TG_OP<>'DELETE' AND (NEW.score<0 OR NEW.score>10 OR NOT EXISTS(SELECT 1 FROM public."RUBRIC_CRITERIA" r WHERE r.id=NEW.rubric_criteria_id AND r.term_id=p.context->>'termId' AND NEW.score<=r.max_score))
  THEN RAISE EXCEPTION 'Committee criterion mismatch'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER cg_detail_guard BEFORE INSERT OR UPDATE OR DELETE ON public."SCORE_DETAIL" FOR EACH ROW EXECUTE FUNCTION public.cg_detail_guard();
CREATE FUNCTION public.cg_commit_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE s public."SCORE_ENTRY";
BEGIN
 SELECT * INTO s FROM public."SCORE_ENTRY" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.role='COMMITTEE_MEMBER' AND NEW.context->>'kind'='UC23' THEN
   RAISE EXCEPTION 'Committee deferred score is not verifiable' USING ERRCODE='23514';
  END IF;
  RETURN NULL; -- unrelated baseline row deleted in the same transaction
 END IF;
 IF s.role='COMMITTEE_MEMBER' AND s.context->>'kind'='UC23' THEN
  IF s.is_locked IS DISTINCT FROM (s.context->>'finalizedAt' IS NOT NULL)
   OR (s.is_locked AND (s.total_score IS NULL OR s.context->>'finalizedBy' IS DISTINCT FROM s.context->>'updatedBy' OR (s.context->>'finalizedAt')::timestamptz>clock_timestamp()))
   OR NOT EXISTS(SELECT 1 FROM public."AUDIT_LOG" e WHERE e.resource='defense-committee-grade' AND e.resource_id=s.id AND e.user_id=s.context->>'updatedBy'
     AND e.new_value->>'revision'=s.revision::text AND e.action=CASE WHEN s.is_locked THEN 'COMMITTEE_GRADE_FINALIZED' ELSE 'COMMITTEE_GRADE_SAVED' END)
  THEN RAISE EXCEPTION 'Committee committed state/audit invalid'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cg_commit_guard AFTER INSERT OR UPDATE ON public."SCORE_ENTRY" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.cg_commit_guard();
INSERT INTO public."PERMISSION"(id,resource,action,description)
 SELECT gen_random_uuid()::text,'defense-committee-grade',a,'UC23: '||a FROM unnest(ARRAY['read','read-own','download-own','save-own','finalize-own','progress-read','score-read','comment-read','history-read']) a ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r JOIN public."PERMISSION" p ON p.resource='defense-committee-grade'
 WHERE (r.name='LECTURER' AND p.action IN ('read','read-own','download-own','save-own','finalize-own')) OR (r.name='FACULTY' AND p.action IN ('read','progress-read')) ON CONFLICT DO NOTHING;
-- No table/column/rubric/account/grade/policy rows are created; no legacy backfill.
COMMIT;
