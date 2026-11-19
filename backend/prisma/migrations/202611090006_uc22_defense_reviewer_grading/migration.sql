-- REVIEW ONLY; outside deploy chain. B1-B8 -> UC17 -> UC18 -> UC19 -> UC20 -> UC22.
-- UC21 schema is conditional at runtime, not a mandatory SQL dependency/FK.
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
 IF EXISTS(SELECT 1 FROM (VALUES ('REVIEWER_ASSIGNMENT','rw_transition_guard','rw_transition_guard'),
    ('REVIEWER_ASSIGNMENT','rw_group_guard','rw_group_guard')) e(tbl,trg,fn)
   WHERE NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
     JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE t.tgrelid=to_regclass('public.'||quote_ident(e.tbl)) AND t.tgname=e.trg
       AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname=e.fn
       AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off']
       AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public')))
 THEN RAISE EXCEPTION 'Upstream v2 guard identity/configuration mismatch; stop'; END IF;
END $uc_guard_identity$;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public."SCORE_ENTRY"'::regclass AND conname='final_advisor_score_valid' AND convalidated)
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."REVIEWER_ASSIGNMENT"'::regclass AND tgname='rw_transition_guard' AND tgenabled IN ('O','A'))
 OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='SCORE_ENTRY' AND column_name='total_score' AND numeric_precision=4 AND numeric_scale=1)
 OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='SCORE_DETAIL' AND column_name='score' AND numeric_precision=4 AND numeric_scale=1)
 THEN RAISE EXCEPTION 'UC22 dependency/decimal metadata mismatch; stop'; END IF;
 IF (SELECT count(*) FROM public."ROLE" WHERE name IN ('LECTURER','FACULTY'))<>2 THEN RAISE EXCEPTION 'Academic roles missing'; END IF;
END $$;
-- Preserve the UC17 name and advisor invariant. Only the new REVIEWER branch is added.
ALTER TABLE public."SCORE_ENTRY" DROP CONSTRAINT final_advisor_score_valid;
ALTER TABLE public."SCORE_ENTRY" ADD CONSTRAINT final_advisor_score_valid CHECK(
 revision>=0 AND (report_version_id IS NULL OR
  (role='ADVISOR' AND context IS NOT NULL AND total_score IS NOT NULL AND total_score BETWEEN 0 AND 10 AND length(btrim(coalesce(comment,'')))>0)
  OR (role='REVIEWER' AND context IS NOT NULL AND context->>'kind'='UC22' AND (total_score IS NULL OR total_score BETWEEN 0 AND 10))) IS TRUE);
ALTER TABLE public."SCORE_ENTRY" ADD CONSTRAINT rg_record_valid CHECK(
 NOT (role='REVIEWER' AND COALESCE(context->>'kind','')='UC22') OR COALESCE(
  revision>0 AND report_version_id IS NOT NULL AND context->>'termId' IS NOT NULL AND context->>'termStudentId' IS NOT NULL
  AND context->>'reviewerId'=scorer_id AND context->>'bindingHash' ~ '^[a-f0-9]{64}$'
  AND context#>>'{command,reportVersionId}'=report_version_id
  AND context#>>'{command,reportChecksum}' ~ '^[a-f0-9]{64}$'
  AND context->>'updatedBy' IS NOT NULL, false));
CREATE FUNCTION public.rg_score_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE a public."REVIEWER_ASSIGNMENT"; actor TEXT;
BEGIN
 -- Existing legacy rows retain baseline maintenance, never become UC22.
 IF OLD.revision=0 AND OLD.report_version_id IS NULL AND OLD.context IS NULL AND TG_OP IN ('UPDATE','DELETE') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.revision=0 AND NEW.report_version_id IS NULL AND NEW.context IS NULL AND NEW.comment IS NULL
    AND NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.proposal_id IS NOT DISTINCT FROM OLD.proposal_id
    AND NEW.scorer_id IS NOT DISTINCT FROM OLD.scorer_id AND NEW.role IS NOT DISTINCT FROM OLD.role
  THEN RETURN NEW; END IF;
  IF OLD.role='REVIEWER' THEN RAISE EXCEPTION 'Cannot adopt a legacy reviewer grade'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.role='REVIEWER' THEN RAISE EXCEPTION 'Retain reviewer grade/history, including legacy'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.role='REVIEWER' THEN
  IF OLD.context->>'kind' IS DISTINCT FROM 'UC22' OR OLD.is_locked OR NEW.id<>OLD.id OR NEW.proposal_id<>OLD.proposal_id OR NEW.scorer_id<>OLD.scorer_id OR NEW.role<>OLD.role
  THEN RAISE EXCEPTION 'Legacy/finalized reviewer grade or owner is immutable'; END IF;
  IF NOT (NEW.revision=OLD.revision+1 OR (NEW.revision=OLD.revision AND NEW.is_locked AND NOT OLD.is_locked
   AND (to_jsonb(NEW)-'is_locked'-'updated_at')=(to_jsonb(OLD)-'is_locked'-'updated_at')))
  THEN RAISE EXCEPTION 'Reviewer grade CAS/lock revision invalid'; END IF;
 END IF;
 IF NEW.role<>'REVIEWER' THEN RETURN NEW; END IF;
 IF NEW.context->>'kind' IS DISTINCT FROM 'UC22' THEN RAISE EXCEPTION 'No new legacy reviewer grades'; END IF;
 IF TG_OP='UPDATE' AND OLD.role<>'REVIEWER' THEN RAISE EXCEPTION 'Cannot turn another score role into REVIEWER'; END IF;
 IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'Reviewer grade starts at revision 1'; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.context->>'termId' FOR UPDATE;
 SELECT * INTO a FROM public."REVIEWER_ASSIGNMENT" WHERE id=NEW.context#>>'{command,assignmentId}' FOR UPDATE;
 IF NOT FOUND OR a.proposal_id<>NEW.proposal_id OR a.reviewer_id<>NEW.scorer_id OR a.term_id IS DISTINCT FROM NEW.context->>'termId'
  OR a.term_student_id IS DISTINCT FROM NEW.context->>'termStudentId' OR a.state IS DISTINCT FROM 'FINALIZED' OR a.selected IS DISTINCT FROM true
  OR a.revision::text IS DISTINCT FROM NEW.context#>>'{command,assignmentRevision}'
  OR a.context->>'evidenceHash' IS DISTINCT FROM NEW.context#>>'{command,assignmentEvidenceHash}'
 THEN RAISE EXCEPTION 'Reviewer grade requires finalized matching assignment'; END IF;
 PERFORM public.rw_check_binding(a);
 actor:=NEW.context->>'updatedBy';
 IF NOT EXISTS(SELECT 1 FROM public."LECTURER" l JOIN public."USER_ACCOUNT" u ON u.id=l.user_id JOIN public."USER_ROLE" ur ON ur.user_id=u.id JOIN public."ROLE" r ON r.id=ur.role_id
  WHERE l.id=NEW.scorer_id AND l.is_active AND u.id=actor AND u.status='ACTIVE' AND r.name='LECTURER')
 THEN RAISE EXCEPTION 'Reviewer grade actor must be active actual lecturer'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION" v JOIN public."FINAL_REPORT" f ON f.id=v.report_id JOIN public."FILE_ASSET" b ON b.id=v.file_asset_id
  WHERE v.id=NEW.report_version_id AND f.proposal_id=NEW.proposal_id AND b.state='READY' AND b.kind='REPORT' AND b."mimeType"='application/pdf'
  AND b.checksum=NEW.context#>>'{command,reportChecksum}' AND v.sequence=(SELECT max(v2.sequence) FROM public."FINAL_REPORT_VERSION" v2 WHERE v2.report_id=f.id))
 THEN RAISE EXCEPTION 'Reviewer PDF version/checksum not current'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rg_score_guard BEFORE INSERT OR UPDATE OR DELETE ON public."SCORE_ENTRY" FOR EACH ROW EXECUTE FUNCTION public.rg_score_guard();
-- Parent is locked after replacing draft details. Validate its committed state,
-- not the intermediate unlocked row, and require the atomic workflow audit.
CREATE FUNCTION public.rg_commit_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE s public."SCORE_ENTRY";
BEGIN
 SELECT * INTO s FROM public."SCORE_ENTRY" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.role='REVIEWER' AND NEW.context->>'kind'='UC22' THEN
   RAISE EXCEPTION 'Reviewer deferred score is not verifiable' USING ERRCODE='23514';
  END IF;
  RETURN NULL; -- unrelated baseline row deleted in the same transaction
 END IF;
 IF s.role='REVIEWER' AND s.context->>'kind'='UC22' THEN
  IF s.is_locked IS DISTINCT FROM (s.context->>'finalizedAt' IS NOT NULL)
   OR (s.is_locked AND (s.total_score IS NULL OR s.context->>'finalizedBy' IS DISTINCT FROM s.context->>'updatedBy'
    OR (s.context->>'finalizedAt')::timestamptz>clock_timestamp()))
   OR NOT EXISTS(SELECT 1 FROM public."AUDIT_LOG" e WHERE e.resource='defense-reviewer-grade' AND e.resource_id=s.id
      AND e.user_id=s.context->>'updatedBy' AND e.new_value->>'revision'=s.revision::text
      AND e.action=CASE WHEN s.is_locked THEN 'REVIEWER_GRADE_FINALIZED' ELSE 'REVIEWER_GRADE_SAVED' END)
  THEN RAISE EXCEPTION 'Reviewer grade committed state/audit invalid'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER rg_commit_guard AFTER INSERT OR UPDATE ON public."SCORE_ENTRY" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.rg_commit_guard();
CREATE FUNCTION public.rg_detail_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE p public."SCORE_ENTRY"; previous public."SCORE_ENTRY";
BEGIN
 IF TG_OP='UPDATE' AND NEW.score_entry_id<>OLD.score_entry_id THEN
  SELECT * INTO previous FROM public."SCORE_ENTRY" WHERE id=OLD.score_entry_id FOR UPDATE;
  IF previous.role='REVIEWER' THEN RAISE EXCEPTION 'Cannot transfer reviewer details'; END IF;
 END IF;
 SELECT * INTO p FROM public."SCORE_ENTRY" WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.score_entry_id ELSE NEW.score_entry_id END FOR UPDATE;
 IF NOT FOUND THEN
  IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF; -- parent legacy FK cascade only
  RAISE EXCEPTION 'Reviewer detail parent is not verifiable' USING ERRCODE='23514';
 END IF;
 IF p.role='REVIEWER' THEN
  IF p.revision=0 AND p.report_version_id IS NULL AND p.context IS NULL THEN
   IF TG_OP='DELETE' THEN RETURN OLD; END IF;
   RETURN NEW; -- baseline constraints/FKs still apply; no conversion to official grade
  END IF;
  IF p.is_locked OR p.context->>'kind' IS DISTINCT FROM 'UC22' THEN RAISE EXCEPTION 'Reviewer details finalized/legacy'; END IF;
  IF TG_OP='UPDATE' AND NEW.score_entry_id<>OLD.score_entry_id THEN RAISE EXCEPTION 'Cannot transfer details to reviewer grade'; END IF;
  IF TG_OP<>'DELETE' AND (NEW.score<0 OR NEW.score>10 OR NOT EXISTS(SELECT 1 FROM public."RUBRIC_CRITERIA" r WHERE r.id=NEW.rubric_criteria_id AND r.term_id=p.context->>'termId' AND NEW.score<=r.max_score)) THEN RAISE EXCEPTION 'Reviewer criterion mismatch'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER rg_detail_guard BEFORE INSERT OR UPDATE OR DELETE ON public."SCORE_DETAIL" FOR EACH ROW EXECUTE FUNCTION public.rg_detail_guard();
-- No new table/column, rubric rows, academic policy, account or grade is inserted.
INSERT INTO public."PERMISSION"(id,resource,action,description)
SELECT gen_random_uuid()::text,'defense-reviewer-grade',a,'UC22: '||a FROM unnest(ARRAY['read','download','save','finalize','score-read','comment-read','history-read']) a ON CONFLICT(resource,action) DO NOTHING;
-- Default mapping: faculty progress only. Content rights require separate approval.
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
SELECT r.id,p.id FROM public."ROLE" r JOIN public."PERMISSION" p ON p.resource='defense-reviewer-grade'
WHERE (r.name='LECTURER' AND p.action IN ('read','download','save','finalize')) OR (r.name='FACULTY' AND p.action='read') ON CONFLICT DO NOTHING;
COMMIT;
