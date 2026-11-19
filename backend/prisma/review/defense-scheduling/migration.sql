-- REVIEW ONLY. Same database/client. Requires approved UC19 (UC17 -> UC18 -> UC19).
-- UC20 schema is needed at runtime ONLY when approved attendance policy requires reviewers.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
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
    ('DEFENSE_SESSION','id'),
    ('DEFENSE_SESSION','committee_id'),
    ('DEFENSE_SESSION','room_id'),
    ('DEFENSE_SESSION','scheduled_at'),
    ('DEFENSE_SESSION','duration_min')) e(t,c)
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
 IF EXISTS(SELECT 1 FROM (VALUES ('COMMITTEE_MEMBER','cc_member_guard','cc_member_guard'),
    ('DEFENSE_COMMITTEE_ASSIGNMENT','cca_transition_guard','cca_transition_guard')) e(tbl,trg,fn)
   WHERE NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
     JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE t.tgrelid=to_regclass('public.'||quote_ident(e.tbl)) AND t.tgname=e.trg
       AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname=e.fn
       AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off']
       AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public')))
 THEN RAISE EXCEPTION 'Upstream v2 guard identity/configuration mismatch; stop'; END IF;
END $uc_guard_identity$;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."DEFENSE_COMMITTEE"'::regclass AND tgname='cc_final_structure_guard' AND tgenabled IN ('O','A'))
 THEN RAISE EXCEPTION 'Reviewed UC19 schema required'; END IF;
END $$;
ALTER TABLE public."DEFENSE_SESSION"
 ADD COLUMN revision INTEGER NOT NULL DEFAULT 0, ADD COLUMN state VARCHAR(20), ADD COLUMN local_date VARCHAR(10),
 ADD COLUMN session_type VARCHAR(20), ADD COLUMN timezone VARCHAR(50), ADD COLUMN ends_at TIMESTAMPTZ(6), ADD COLUMN context JSONB,
 ADD COLUMN created_by VARCHAR(36), ADD COLUMN updated_by VARCHAR(36), ADD COLUMN updated_at TIMESTAMPTZ(6),
 ADD COLUMN finalized_by VARCHAR(36), ADD COLUMN finalized_at TIMESTAMPTZ(6), ADD COLUMN published_by VARCHAR(36), ADD COLUMN published_at TIMESTAMPTZ(6),
 ADD CONSTRAINT sc_provenance_valid CHECK(revision>=0 AND (
  (revision=0 AND state IS NULL AND local_date IS NULL AND session_type IS NULL AND timezone IS NULL AND ends_at IS NULL AND context IS NULL
    AND created_by IS NULL AND updated_by IS NULL AND updated_at IS NULL AND finalized_by IS NULL AND finalized_at IS NULL AND published_by IS NULL AND published_at IS NULL)
  OR (revision>0 AND state IS NOT NULL AND state IN ('DRAFT','FINALIZED','CANCELLED') AND local_date IS NOT NULL AND session_type IS NOT NULL AND session_type IN ('MORNING','AFTERNOON') AND timezone IS NOT NULL AND timezone='Asia/Ho_Chi_Minh'
    AND ends_at IS NOT NULL AND ends_at>scheduled_at AND duration_min>0 AND created_by IS NOT NULL AND updated_by IS NOT NULL AND updated_at IS NOT NULL
    AND COALESCE(context->>'origin'='UC21',false) AND COALESCE(context->>'policyHash' ~ '^[a-f0-9]{64}$',false)
    AND COALESCE(context->>'evidenceHash' ~ '^[a-f0-9]{64}$',false) AND COALESCE(jsonb_typeof(context->'slots')='array',false)
    AND COALESCE(jsonb_array_length(context->'slots') BETWEEN 1 AND 200,false)
    AND ((state IN ('DRAFT','CANCELLED') AND finalized_by IS NULL AND finalized_at IS NULL AND published_by IS NULL AND published_at IS NULL)
      OR (state='FINALIZED' AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL AND ((published_by IS NULL AND published_at IS NULL) OR (published_by IS NOT NULL AND published_at IS NOT NULL))))
  )));
-- Statement-level acquisition happens before this statement takes tuple locks.
-- All writers, including legacy/direct SQL, use ReadCommitted and this mutex.
CREATE FUNCTION public.sc_booking_mutex_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,public SET row_security=off AS $$
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed'
 THEN RAISE EXCEPTION 'DEFENSE_SESSION writers require ReadCommitted before DML'; END IF;
 PERFORM pg_advisory_xact_lock(2117,21);
 RETURN NULL;
END $$;
CREATE TRIGGER sc_booking_mutex_guard BEFORE INSERT OR UPDATE OR DELETE ON public."DEFENSE_SESSION"
FOR EACH STATEMENT EXECUTE FUNCTION public.sc_booking_mutex_guard();
CREATE FUNCTION public.sc_transition_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
BEGIN
 -- The statement guard already holds the mutex; do not acquire it after a tuple.
 IF TG_OP='DELETE' THEN
  IF OLD.revision>0 THEN RAISE EXCEPTION 'UC21 keeps history; cancel draft explicitly'; END IF; RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.revision=0 AND NEW.revision>0 THEN RAISE EXCEPTION 'Legacy schedule requires reconciliation'; END IF;
  IF OLD.revision>0 THEN
   IF NEW.id<>OLD.id OR NEW.revision<>OLD.revision+1 OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.state='CANCELLED'
   THEN RAISE EXCEPTION 'UC21 owner/revision/immutable cancellation'; END IF;
   IF OLD.state='FINALIZED' AND NOT (
     NEW.state='FINALIZED' AND OLD.published_at IS NULL AND OLD.published_by IS NULL AND NEW.published_at IS NOT NULL AND NEW.published_by IS NOT NULL
     AND NEW.finalized_at=OLD.finalized_at AND NEW.finalized_by=OLD.finalized_by AND NEW.committee_id=OLD.committee_id AND NEW.room_id=OLD.room_id
     AND NEW.scheduled_at=OLD.scheduled_at AND NEW.ends_at=OLD.ends_at AND NEW.duration_min=OLD.duration_min AND NEW.local_date=OLD.local_date
     AND NEW.session_type=OLD.session_type AND NEW.timezone=OLD.timezone AND NEW.context=OLD.context)
   THEN RAISE EXCEPTION 'UC21 finalized schedule only permits explicit publication'; END IF;
  END IF;
 END IF;
 IF NEW.revision=0 THEN RETURN NEW; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'UC21 requires ReadCommitted under the global booking mutex'; END IF;
 IF TG_OP='INSERT' AND (NEW.revision<>1 OR NEW.state<>'DRAFT') THEN RAISE EXCEPTION 'UC21 starts at draft revision one'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.created_by) OR NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.updated_by)
   OR (NEW.finalized_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.finalized_by))
   OR (NEW.published_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.published_by))
 THEN RAISE EXCEPTION 'UC21 actor missing'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sc_transition_guard BEFORE INSERT OR UPDATE OR DELETE ON public."DEFENSE_SESSION" FOR EACH ROW EXECUTE FUNCTION public.sc_transition_guard();
CREATE FUNCTION public.sc_conflict_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE r public."DEFENSE_SESSION"; other public."DEFENSE_SESSION"; c public."DEFENSE_COMMITTEE"; policy JSONB; slot JSONB; a public."DEFENSE_COMMITTEE_ASSIGNMENT"; tid TEXT; n INTEGER;
BEGIN
 SELECT * INTO r FROM public."DEFENSE_SESSION" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.revision=0 THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'UC21 deferred schedule is not verifiable' USING ERRCODE='23514';
 END IF;
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=r.committee_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'UC21 parent committee is not verifiable' USING ERRCODE='23514'; END IF;
 IF r.revision>0 AND r.state='CANCELLED' THEN RETURN NULL; END IF;
 IF r.revision>0 THEN
  IF c.state IS DISTINCT FROM 'FINALIZED' OR c.revision::text IS DISTINCT FROM r.context#>>'{source,committeeRevision}'
    OR c.context->>'contentHash' IS DISTINCT FROM r.context#>>'{source,committeeEvidenceHash}'
    OR c.id IS DISTINCT FROM r.context#>>'{source,committeeId}'
  THEN RAISE EXCEPTION 'UC21 needs current finalized committee binding'; END IF;
  tid:=c.term_id;
  SELECT value::jsonb INTO policy FROM public."TERM_PARAMETER" WHERE term_id=tid AND key='UC21_POLICY';
  IF policy IS NULL OR policy->>'status' IS DISTINCT FROM 'APPROVED' OR policy->>'version' IS DISTINCT FROM r.context->>'policyVersion'
    OR NOT COALESCE((policy->>'approvedAt')::timestamptz<=now(),false) OR policy->>'timezone' IS DISTINCT FROM 'Asia/Ho_Chi_Minh'
    OR COALESCE(policy->>'reviewerAttendance','PENDING_APPROVAL')='PENDING_APPROVAL'
  THEN RAISE EXCEPTION 'UC21 approved policy required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(policy->'allowedDates') d WHERE d=r.local_date)
    OR (r.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text<>r.local_date
    OR (r.ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text<>r.local_date
  THEN RAISE EXCEPTION 'UC21 date/time mismatch'; END IF;
  IF NOT COALESCE((r.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time >= (policy#>>ARRAY['periods',r.session_type,'start'])::time,false)
    OR NOT COALESCE(r.ends_at+(policy->>'sessionBufferMin')::integer*interval '1 minute' <=
       ((r.local_date||' '||(policy#>>ARRAY['periods',r.session_type,'end']))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),false)
  THEN RAISE EXCEPTION 'UC21 session outside approved morning/afternoon window'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public."ROOM" room JOIN jsonb_array_elements(policy->'roomAccess') access ON access->>'roomId'=room.id
    WHERE room.id=r.room_id AND room.capacity>=(policy->>'minRoomCapacity')::integer AND (access->'departmentIds') ? c.department_id)
  THEN RAISE EXCEPTION 'UC21 room not approved for department'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public."THESIS_TERM" t JOIN public."TERM_PHASE" p ON p.term_id=t.id AND p.code='DEFENSE'
    WHERE t.id=tid AND r.scheduled_at>=GREATEST(t.start_date,p.start_date) AND r.ends_at+(policy->>'sessionBufferMin')::integer*interval '1 minute'<=LEAST(t.end_date,p.end_date) AND NOT t.is_locked AND NOT p.is_locked)
  THEN RAISE EXCEPTION 'UC21 outside defense/term bounds'; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(r.context->'slots');
  IF NOT COALESCE(jsonb_typeof(r.context#>'{booking,lecturers}')='array',false)
    OR NOT COALESCE(jsonb_typeof(r.context#>'{booking,students}')='array',false)
    OR r.context#>>'{booking,id}' IS DISTINCT FROM r.id OR r.context#>>'{booking,roomId}' IS DISTINCT FROM r.room_id
    OR r.context#>>'{booking,committeeId}' IS DISTINCT FROM r.committee_id
    OR (r.context#>>'{booking,start}')::numeric IS DISTINCT FROM extract(epoch FROM r.scheduled_at)*1000
    OR NOT COALESCE((r.context#>>'{booking,end}')::numeric=extract(epoch FROM r.ends_at)*1000+(policy->>'sessionBufferMin')::numeric*60000,false)
    OR n IS DISTINCT FROM jsonb_array_length(r.context#>'{booking,students}')
  THEN RAISE EXCEPTION 'UC21 booking resources incomplete'; END IF;
  IF EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" m WHERE m.committee_id=c.id AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(r.context#>'{booking,lecturers}') l WHERE l->>'lecturerId'=m.lecturer_id
      AND (l->>'start')::numeric<=extract(epoch FROM r.scheduled_at)*1000 AND (l->>'end')::numeric>=(r.context#>>'{booking,end}')::numeric))
  THEN RAISE EXCEPTION 'UC21 must reserve every committee member'; END IF;
  IF n>(policy->>'maxStudentsPerSession')::integer OR n<>(SELECT count(DISTINCT x->>'proposalId') FROM jsonb_array_elements(r.context->'slots') x)
    OR n<>(SELECT count(DISTINCT x->>'order') FROM jsonb_array_elements(r.context->'slots') x)
  THEN RAISE EXCEPTION 'UC21 student capacity/order/duplicate'; END IF;
  FOR slot IN SELECT * FROM jsonb_array_elements(r.context->'slots') LOOP
    SELECT * INTO a FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=c.id AND term_student_id=slot->>'termStudentId' AND proposal_id=slot->>'proposalId' AND state='ACTIVE';
    IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public."TERM_STUDENT" ts WHERE ts.id=a.term_student_id AND ts.student_id=slot->>'studentId' AND ts.term_id=tid)
    THEN RAISE EXCEPTION 'UC21 requires an owned active UC19 student assignment'; END IF;
    PERFORM public.cc_check_student(c.id,a.proposal_id,a.term_student_id,a.context);
    IF (slot->>'startAt')::timestamptz<r.scheduled_at OR (slot->>'endAt')::timestamptz>r.ends_at OR (slot->>'startAt')::timestamptz>=(slot->>'endAt')::timestamptz
    THEN RAISE EXCEPTION 'UC21 invalid slot range'; END IF;
    IF extract(epoch FROM ((slot->>'endAt')::timestamptz-(slot->>'startAt')::timestamptz)) IS DISTINCT FROM (policy->>'durationMin')::numeric*60
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(policy#>ARRAY['periods',r.session_type,'breaks']) br WHERE
        ((slot->>'startAt')::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::time < (br->>'end')::time
        AND (br->>'start')::time < (((slot->>'endAt')::timestamptz + (policy->>'bufferMin')::integer*interval '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::time)
    THEN RAISE EXCEPTION 'UC21 slot duration/break policy mismatch'; END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.context#>'{booking,students}') b WHERE b->>'proposalId'=slot->>'proposalId' AND b->>'studentId'=slot->>'studentId'
      AND (b->>'start')::numeric=extract(epoch FROM (slot->>'startAt')::timestamptz)*1000
      AND (b->>'end')::numeric=extract(epoch FROM (slot->>'endAt')::timestamptz)*1000+(policy->>'bufferMin')::numeric*60000)
    THEN RAISE EXCEPTION 'UC21 student booking missing'; END IF;
  END LOOP;
  IF r.published_at IS NOT NULL AND (r.state<>'FINALIZED' OR r.published_at<(policy->>'publishNotBefore')::timestamptz)
  THEN RAISE EXCEPTION 'UC21 publication not permitted yet'; END IF;
 END IF;
 -- Includes ALL terms, and stale/draft reservations. Legacy durations are not guessed.
 FOR other IN SELECT * FROM public."DEFENSE_SESSION" WHERE id<>r.id AND (revision=0 OR state<>'CANCELLED') LOOP
  IF r.revision=0 OR other.revision=0 THEN
   IF r.room_id=other.room_id OR r.committee_id=other.committee_id OR EXISTS(
     SELECT 1 FROM public."COMMITTEE_MEMBER" m JOIN public."COMMITTEE_MEMBER" x ON x.lecturer_id=m.lecturer_id WHERE m.committee_id=r.committee_id AND x.committee_id=other.committee_id)
   THEN RAISE EXCEPTION 'Legacy shared room/committee/member schedule requires reconciliation'; END IF;
   IF other.revision=0 AND r.revision>0 AND EXISTS(SELECT 1 FROM public."COMMITTEE_STUDENT" cs JOIN public."PROPOSAL" p ON p.id=cs.proposal_id
     JOIN jsonb_array_elements(r.context->'slots') s ON s->>'proposalId'=p.id OR s->>'studentId'=p.student_id WHERE cs.session_id=other.id)
   THEN RAISE EXCEPTION 'Legacy student schedule requires reconciliation'; END IF;
   CONTINUE;
  END IF;
  IF (r.context#>>'{booking,start}')::numeric<(other.context#>>'{booking,end}')::numeric AND (other.context#>>'{booking,start}')::numeric<(r.context#>>'{booking,end}')::numeric
    AND (r.room_id=other.room_id OR r.committee_id=other.committee_id)
  THEN RAISE EXCEPTION 'UC21 overlapping room/committee'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.context#>'{booking,lecturers}') l CROSS JOIN jsonb_array_elements(other.context#>'{booking,lecturers}') m
    WHERE l->>'lecturerId'=m->>'lecturerId' AND (l->>'start')::numeric<(m->>'end')::numeric AND (m->>'start')::numeric<(l->>'end')::numeric)
  THEN RAISE EXCEPTION 'UC21 overlapping lecturer/reviewer'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.context#>'{booking,students}') s CROSS JOIN jsonb_array_elements(other.context#>'{booking,students}') t
    WHERE s->>'proposalId'=t->>'proposalId' OR (s->>'studentId'=t->>'studentId' AND (s->>'start')::numeric<(t->>'end')::numeric AND (t->>'start')::numeric<(s->>'end')::numeric))
  THEN RAISE EXCEPTION 'UC21 duplicate proposal/overlapping student'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sc_conflict_guard AFTER INSERT OR UPDATE ON public."DEFENSE_SESSION" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sc_conflict_guard();
-- Preserve legacy DEFENSE_SESSION ACL/RLS; approve security DDL separately.
INSERT INTO public."PERMISSION"(id,resource,action,description)
 SELECT gen_random_uuid()::text,'defense-schedule',a,'UC21 '||a FROM unnest(ARRAY['read','create','update','finalize','publish']) a ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p WHERE p.resource='defense-schedule'
 AND ((r.name='FACULTY' AND p.action IN ('read','create','update','finalize','publish'))
   OR (r.name IN ('STUDENT','LECTURER') AND p.action='read')) ON CONFLICT DO NOTHING;
COMMIT;
