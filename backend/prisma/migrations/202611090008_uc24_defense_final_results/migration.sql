-- UC24 REVIEW ONLY. Not in prisma/migrations; never apply without approved rehearsal.
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
    ('FINAL_RESULT','id'),
    ('FINAL_RESULT','proposal_id'),
    ('FINAL_RESULT','final_score'),
    ('FINAL_RESULT','is_published'),
    ('FINAL_RESULT','published_at')) e(t,c)
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
 IF EXISTS(SELECT 1 FROM (VALUES ('SCORE_ENTRY','cg_score_guard','cg_score_guard'),
    ('SCORE_DETAIL','cg_detail_guard','cg_detail_guard'),
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
 IF NOT EXISTS (SELECT 1 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='SCORE_ENTRY' AND k.conname='cg_record_valid' AND k.contype='c' AND k.convalidated)
 OR NOT EXISTS (SELECT 1 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='DEFENSE_SESSION' AND k.conname='sc_provenance_valid' AND k.contype='c' AND k.convalidated)
 THEN RAISE EXCEPTION 'UC17-UC23 reviewed dependencies required; inspect package README'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint k JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attname='proposal_id'
   WHERE k.conrelid=to_regclass('public."FINAL_RESULT"') AND k.contype='u' AND k.convalidated AND k.conkey=ARRAY[a.attnum]::smallint[])
 OR NOT EXISTS(SELECT 1 FROM pg_constraint k JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attname='proposal_id'
   WHERE k.conrelid=to_regclass('public."FINAL_RESULT"') AND k.contype='f' AND k.convalidated
     AND k.confrelid=to_regclass('public."PROPOSAL"') AND k.conkey=ARRAY[a.attnum]::smallint[]
     AND k.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.confrelid AND attname='id' AND NOT attisdropped)]::smallint[])
 THEN RAISE EXCEPTION 'FINAL_RESULT baseline proposal unique/FK identity mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT' AND column_name='final_score' AND numeric_precision=4 AND numeric_scale=1) THEN RAISE EXCEPTION 'FINAL_RESULT precision mismatch'; END IF;
END $$;
ALTER TABLE public."FINAL_RESULT"
 ADD COLUMN revision integer NOT NULL DEFAULT 0,
 ADD COLUMN state text NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
 ADD COLUMN context jsonb,
 ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
 ADD COLUMN finalized_by varchar(36),
 ADD COLUMN finalized_at timestamptz,
 ADD COLUMN published_by varchar(36);
-- Existing rows are not adopted, backfilled, changed or deleted.
ALTER TABLE public."FINAL_RESULT" ADD CONSTRAINT fr_record_valid CHECK (
 (revision=0 AND state='LEGACY_UNVERIFIED' AND context IS NULL AND NOT is_locked AND finalized_by IS NULL AND finalized_at IS NULL AND published_by IS NULL)
 OR (revision>0 AND state IN ('CONFIRMING','FINALIZED','PUBLISHED') AND context->>'kind'='UC24'
  AND context->>'proposalId'=proposal_id AND jsonb_typeof(context->'evidence')='object'
  AND jsonb_typeof(context->'confirmations')='array' AND context->'policy'->>'status'='APPROVED'
  AND context->>'evidenceHash' ~ '^[a-f0-9]{64}$'
  AND context->'evidence'->'policy'=context->'policy'
  AND ((state='CONFIRMING' AND NOT is_locked AND final_score IS NULL AND is_passed IS NULL AND finalized_by IS NULL AND finalized_at IS NULL AND NOT is_published AND published_by IS NULL AND published_at IS NULL)
   OR (state IN ('FINALIZED','PUBLISHED') AND is_locked AND final_score BETWEEN 0 AND 10
    AND final_score=(context->'calculation'->>'finalScore')::numeric
    AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL
    AND ((state='FINALIZED' AND NOT is_published AND published_by IS NULL AND published_at IS NULL)
     OR (state='PUBLISHED' AND is_published AND published_by IS NOT NULL AND published_at IS NOT NULL))))) IS TRUE);
CREATE FUNCTION public.fr_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE src jsonb; c jsonb; role_name text; actor text;
BEGIN
 -- Preserve ordinary maintenance of actual baseline results, never adopt them.
 IF TG_OP IN ('UPDATE','DELETE') AND OLD.revision=0 THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.revision=0 AND NEW.state='LEGACY_UNVERIFIED' AND NEW.context IS NULL AND NOT NEW.is_locked
    AND NEW.finalized_by IS NULL AND NEW.finalized_at IS NULL AND NEW.published_by IS NULL
    AND NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.proposal_id IS NOT DISTINCT FROM OLD.proposal_id
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'UC24 legacy results require separate reconciliation, not adoption';
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'UC24 history immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.revision=0 OR OLD.state='PUBLISHED' OR NEW.revision<>OLD.revision+1 OR NEW.proposal_id<>OLD.proposal_id OR NEW.id<>OLD.id THEN RAISE EXCEPTION 'UC24 legacy/identity/revision/immutable conflict'; END IF;
  IF OLD.state='FINALIZED' AND (NEW.state<>'PUBLISHED' OR
   (to_jsonb(NEW)-ARRAY['revision','state','is_published','published_by','published_at','updated_at']) IS DISTINCT FROM
   (to_jsonb(OLD)-ARRAY['revision','state','is_published','published_by','published_at','updated_at'])) THEN RAISE EXCEPTION 'UC24 finalized snapshot immutable'; END IF;
  IF OLD.state='CONFIRMING' AND (NEW.state NOT IN ('CONFIRMING','FINALIZED') OR NEW.context->>'evidenceHash'<>OLD.context->>'evidenceHash'
    OR NEW.context->'policy' IS DISTINCT FROM OLD.context->'policy' OR NEW.context->'calculation' IS DISTINCT FROM OLD.context->'calculation'
    OR NEW.context->'evidence' IS DISTINCT FROM OLD.context->'evidence') THEN RAISE EXCEPTION 'UC24 cannot rebind source'; END IF;
 ELSE
  IF NEW.revision<>1 OR NEW.state NOT IN ('CONFIRMING','FINALIZED') THEN RAISE EXCEPTION 'UC24 first transition invalid'; END IF;
 END IF;
 IF jsonb_typeof(NEW.context->'evidence'->'sources') IS DISTINCT FROM 'array'
   OR jsonb_typeof(NEW.context->'policy'->'confirmation'->'roles') IS DISTINCT FROM 'array'
   OR jsonb_typeof(NEW.context->'confirmations') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'UC24 source/confirmation provenance arrays required'; END IF;
 IF (NEW.context#>>'{policy,confirmation,scope}'='STUDENT'
   AND NEW.context#>>'{policy,confirmation,rule}'='ONE_PER_ROLE'
   AND jsonb_typeof(NEW.context#>'{policy,confirmation,distinctActors}')='boolean'
   AND jsonb_typeof(NEW.context#>'{policy,confirmation,reasonRequired}')='boolean'
   AND jsonb_typeof(NEW.context#>'{policy,separation,finalizerNotConfirmer}')='boolean'
   AND jsonb_typeof(NEW.context#>'{policy,separation,publisherNotFinalizer}')='boolean') IS NOT TRUE
 THEN RAISE EXCEPTION 'UC24 explicit confirmation/separation policy required'; END IF;
 -- An explicitly empty role list is valid in the shared contract. Missing,
 -- duplicate or unsupported roles are not equivalent to that policy choice.
 IF jsonb_array_length(NEW.context#>'{policy,confirmation,roles}')>3
   OR jsonb_array_length(NEW.context#>'{policy,confirmation,roles}')<>(
     SELECT count(DISTINCT r) FROM jsonb_array_elements_text(NEW.context#>'{policy,confirmation,roles}') r)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.context#>'{policy,confirmation,roles}') r
     WHERE r IS NULL OR r NOT IN ('CHAIR','SECRETARY','MEMBER'))
 THEN RAISE EXCEPTION 'UC24 invalid confirmation roles'; END IF;
 IF jsonb_array_length(NEW.context->'evidence'->'sources')=0
   OR jsonb_array_length(NEW.context->'evidence'->'sources')<>(SELECT count(DISTINCT x->>'scoreEntryId') FROM jsonb_array_elements(NEW.context->'evidence'->'sources') x)
   OR jsonb_array_length(NEW.context->'confirmations')<>(SELECT count(DISTINCT x->>'role') FROM jsonb_array_elements(NEW.context->'confirmations') x)
 THEN RAISE EXCEPTION 'UC24 missing/duplicate source or confirmation provenance'; END IF;
 IF (NEW.context#>>'{policy,confirmation,distinctActors}')::boolean
   AND jsonb_array_length(NEW.context->'confirmations')<>(SELECT count(DISTINCT x->>'actor') FROM jsonb_array_elements(NEW.context->'confirmations') x)
 THEN RAISE EXCEPTION 'UC24 confirmation actors must be distinct'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."TERM_PARAMETER" p WHERE p.term_id=NEW.context->>'termId' AND p.key='UC24_POLICY' AND p.value::jsonb=NEW.context->'policy') THEN RAISE EXCEPTION 'UC24 current approved policy required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."PROPOSAL" p JOIN public."TERM_STUDENT" ts ON ts.student_id=p.student_id AND ts.term_id=p.term_id
  WHERE p.id=NEW.proposal_id AND ts.id=NEW.context->>'termStudentId' AND p.term_id=NEW.context->>'termId') THEN RAISE EXCEPTION 'UC24 owner mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE" dc WHERE dc.id=NEW.context->'evidence'->'committee'->>'committeeId'
  AND dc.term_id=NEW.context->>'termId' AND dc.state='FINALIZED' AND dc.revision=(NEW.context->'evidence'->'committee'->>'revision')::integer) THEN RAISE EXCEPTION 'UC24 committee not current'; END IF;
 FOR src IN SELECT * FROM jsonb_array_elements(NEW.context->'evidence'->'sources') LOOP
  role_name=CASE src->>'source' WHEN 'ADVISOR_UC17' THEN 'ADVISOR' WHEN 'REVIEWER' THEN 'REVIEWER' WHEN 'COMMITTEE' THEN 'COMMITTEE_MEMBER' ELSE NULL END;
  IF role_name IS NULL OR NOT EXISTS(SELECT 1 FROM public."SCORE_ENTRY" se JOIN public."FINAL_REPORT_VERSION" v ON v.id=se.report_version_id
   JOIN public."FILE_ASSET" fa ON fa.id=v.file_asset_id JOIN public."FINAL_REPORT" fr ON fr.id=v.report_id
   WHERE se.id=src->>'scoreEntryId' AND se.proposal_id=NEW.proposal_id AND se.scorer_id=src->>'lecturerId' AND se.role=role_name
    AND se.revision=(src->>'revision')::integer AND se.total_score=(src->>'totalScore')::numeric
    AND se.report_version_id=src->>'reportVersionId' AND fa.checksum=src->>'reportChecksum' AND fa.state='READY'
    AND (role_name='ADVISOR' OR se.is_locked) AND fr.proposal_id=NEW.proposal_id
    AND NOT EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION" later WHERE later.report_id=v.report_id AND later.sequence>v.sequence)) THEN RAISE EXCEPTION 'UC24 source changed'; END IF;
 END LOOP;
 FOR c IN SELECT * FROM jsonb_array_elements(NEW.context->'confirmations') LOOP
  IF (NEW.context#>>'{policy,confirmation,reasonRequired}')::boolean
    AND COALESCE(length(btrim(c->>'reason')),0)=0
  THEN RAISE EXCEPTION 'UC24 confirmation reason required by policy'; END IF;
  IF c->>'evidenceHash' IS DISTINCT FROM NEW.context->>'evidenceHash'
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.context->'policy'->'confirmation'->'roles') r WHERE r=c->>'role')
    OR NOT EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" cm JOIN public."LECTURER" l ON l.id=cm.lecturer_id
      JOIN public."USER_ACCOUNT" u ON u.id=l.user_id
    WHERE cm.committee_id=NEW.context->'evidence'->'committee'->>'committeeId' AND cm.lecturer_id=c->>'lecturerId'
      AND cm.role::text=c->>'role' AND l.user_id=c->>'actor' AND l.is_active AND u.status='ACTIVE')
  THEN RAISE EXCEPTION 'UC24 confirmation owner mismatch'; END IF;
 END LOOP;
 IF NEW.state IN ('FINALIZED','PUBLISHED') AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.context->'policy'->'confirmation'->'roles') role
  WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.context->'confirmations') c WHERE c->>'role'=role)) THEN RAISE EXCEPTION 'UC24 incomplete confirmation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fr_transition_guard BEFORE INSERT OR UPDATE OR DELETE ON public."FINAL_RESULT" FOR EACH ROW EXECUTE FUNCTION public.fr_guard();
CREATE FUNCTION public.fr_commit_check() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE latest public."FINAL_RESULT"; event public."AUDIT_LOG"; actor text;
BEGIN
 IF NEW.revision=0 THEN RETURN NULL; END IF; -- legacy never becomes an official UC24 result
 SELECT * INTO latest FROM public."FINAL_RESULT" WHERE id=NEW.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'UC24 deferred result is not verifiable' USING ERRCODE='23514'; END IF;
 IF latest.revision<>NEW.revision THEN RETURN NEW; END IF;
 SELECT * INTO event FROM public."AUDIT_LOG" WHERE resource='defense-result' AND resource_id=NEW.id
  AND new_value->>'revision'=NEW.revision::text AND new_value->'context'=NEW.context ORDER BY created_at DESC LIMIT 1;
 actor=event.user_id;
 IF actor IS NULL OR event.action IS DISTINCT FROM (CASE NEW.state WHEN 'CONFIRMING' THEN 'RESULT_CONFIRM' WHEN 'FINALIZED' THEN 'RESULT_FINALIZE' ELSE 'RESULT_PUBLISH' END)
 OR NOT EXISTS(SELECT 1 FROM public."IDEMPOTENCY_RECORD" k WHERE k."actorId"=actor AND k.method='POST'
   AND k.route='/defense-results/'||(NEW.context->>'termStudentId')||'/'||CASE NEW.state WHEN 'CONFIRMING' THEN 'confirm' WHEN 'FINALIZED' THEN 'finalize' ELSE 'publish' END
   AND k."payloadHash" ~ '^[a-f0-9]{64}$' AND k.result->>'finalResultId'=NEW.id
   AND k.result->>'revision'=NEW.revision::text AND k.result->>'state'=NEW.state)
 THEN RAISE EXCEPTION 'UC24 atomic audit/idempotency required'; END IF;
 IF NEW.state='FINALIZED' AND actor<>NEW.finalized_by OR NEW.state='PUBLISHED' AND actor<>NEW.published_by THEN RAISE EXCEPTION 'UC24 actor mismatch'; END IF;
 IF NEW.state='FINALIZED' AND (NEW.context#>>'{policy,separation,finalizerNotConfirmer}')::boolean
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.context->'confirmations') c WHERE c->>'actor'=actor)
 THEN RAISE EXCEPTION 'UC24 finalizer separation required by policy'; END IF;
 IF NEW.state='PUBLISHED' AND (NEW.context#>>'{policy,separation,publisherNotFinalizer}')::boolean AND actor=NEW.finalized_by
 THEN RAISE EXCEPTION 'UC24 publisher separation required by policy'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER fr_commit_guard AFTER INSERT OR UPDATE ON public."FINAL_RESULT" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fr_commit_check();
-- Role mappings are proposed in README, not provisioned here. ACL/RLS/REST rehearsal required.
COMMIT;
