-- Forward repair: eliminate PL/pgSQL variable/column ambiguity. Original applied migration is unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.fr_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE src jsonb; confirmation_item jsonb; role_name text; actor text;
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
 FOR confirmation_item IN SELECT * FROM jsonb_array_elements(NEW.context->'confirmations') LOOP
  IF (NEW.context#>>'{policy,confirmation,reasonRequired}')::boolean
    AND COALESCE(length(btrim(confirmation_item->>'reason')),0)=0
  THEN RAISE EXCEPTION 'UC24 confirmation reason required by policy'; END IF;
  IF confirmation_item->>'evidenceHash' IS DISTINCT FROM NEW.context->>'evidenceHash'
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.context->'policy'->'confirmation'->'roles') r WHERE r=confirmation_item->>'role')
    OR NOT EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" cm JOIN public."LECTURER" l ON l.id=cm.lecturer_id
      JOIN public."USER_ACCOUNT" u ON u.id=l.user_id
    WHERE cm.committee_id=NEW.context->'evidence'->'committee'->>'committeeId' AND cm.lecturer_id=confirmation_item->>'lecturerId'
      AND cm.role::text=confirmation_item->>'role' AND l.user_id=confirmation_item->>'actor' AND l.is_active AND u.status='ACTIVE')
  THEN RAISE EXCEPTION 'UC24 confirmation owner mismatch'; END IF;
 END LOOP;
 IF NEW.state IN ('FINALIZED','PUBLISHED') AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.context->'policy'->'confirmation'->'roles') role
  WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.context->'confirmations') confirmed(value) WHERE confirmed.value->>'role'=role)) THEN RAISE EXCEPTION 'UC24 incomplete confirmation'; END IF;
 RETURN NEW;
END $$;
COMMIT;
