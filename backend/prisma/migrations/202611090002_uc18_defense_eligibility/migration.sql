-- REVIEW ONLY. After the approved UC17 package. Never run automatically at startup/deploy.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
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
    ('DEFENSE_ELIGIBILITY','id'),
    ('DEFENSE_ELIGIBILITY','proposal_id'),
    ('DEFENSE_ELIGIBILITY','status'),
    ('DEFENSE_ELIGIBILITY','checked_at'),
    ('DEFENSE_ELIGIBILITY','note')) e(t,c)
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
DO $$ BEGIN
  IF to_regclass('public."FINAL_REPORT_VERSION"') IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public."FINAL_REPORT_VERSION"'::regclass
    AND tgname='final_pdf_immutable' AND tgenabled IN ('O','A')) THEN
    RAISE EXCEPTION 'Apply and verify the reviewed UC17 migration first';
  END IF;
END $$;
ALTER TABLE public."DEFENSE_ELIGIBILITY"
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN context JSONB,
  ADD COLUMN reviewed_by VARCHAR(36),
  ADD COLUMN decided_by VARCHAR(36),
  ADD COLUMN decided_at TIMESTAMPTZ(6),
  ADD COLUMN finalized_by VARCHAR(36),
  ADD COLUMN finalized_at TIMESTAMPTZ(6),
  ADD CONSTRAINT eligibility_provenance_valid CHECK (
    revision >= 0 AND (
      (revision=0 AND context IS NULL AND reviewed_by IS NULL AND decided_by IS NULL
        AND decided_at IS NULL AND finalized_by IS NULL AND finalized_at IS NULL)
      OR
      (revision>0 AND status IS NOT NULL AND context IS NOT NULL AND reviewed_by IS NOT NULL AND checked_at IS NOT NULL AND note IS NOT NULL AND length(btrim(note))>0
        AND COALESCE(context->>'schemaVersion'='1',false)
        AND COALESCE(context->>'termId'<>'',false) AND COALESCE(context->>'termStudentId'<>'',false)
        AND COALESCE(context->>'evidenceHash' ~ '^[a-f0-9]{64}$',false)
        AND COALESCE(context->>'policyHash' ~ '^[a-f0-9]{64}$',false)
        AND ((status='PENDING' AND decided_by IS NULL AND decided_at IS NULL)
          OR (status IN ('ELIGIBLE','INELIGIBLE','DEFERRED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
        AND ((finalized_at IS NULL AND finalized_by IS NULL)
          OR (finalized_at IS NOT NULL AND finalized_by IS NOT NULL AND status='ELIGIBLE'
            AND decided_at IS NOT NULL AND finalized_at>=decided_at
            AND COALESCE(context->>'batchId'<>'',false)))
      )
    ) IS TRUE
  );
-- Actor/scope referential checks are conditional: legacy rows are left unchanged.
-- Kept as a trigger rather than unconditional FKs that could reject unrelated legacy orphans.
CREATE FUNCTION public.eligibility_transition_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE actor_id TEXT;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.revision>0 THEN RAISE EXCEPTION 'UC18 records must retain their audit provenance'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'Finalized eligibility is immutable; reopening requires an approved workflow'; END IF;
    IF OLD.revision=0 AND NEW.revision>0 THEN RAISE EXCEPTION 'Legacy eligibility requires a separate approved reconciliation'; END IF;
    IF OLD.revision>0 AND (NEW.revision<>OLD.revision+1 OR NEW.proposal_id<>OLD.proposal_id) THEN
      RAISE EXCEPTION 'Eligibility revision/owner conflict';
    END IF;
  ELSIF NEW.revision<>1 THEN RAISE EXCEPTION 'UC18 inserts start at revision one';
  END IF;
  IF NEW.revision>0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public."PROPOSAL" p JOIN public."TOPIC" t ON t.id=p.topic_id
      JOIN public."TOPIC_WORKFLOW" w ON w."topicId"=t.id
      JOIN public."TERM_STUDENT" s ON s.id=w."termStudentId"
      WHERE p.id=NEW.proposal_id AND s.student_id=p.student_id AND s.term_id=p.term_id
      AND t.term_id=p.term_id AND w."termId"=p.term_id
      AND s.id=NEW.context->>'termStudentId' AND s.term_id=NEW.context->>'termId'
    ) THEN RAISE EXCEPTION 'UC18 context must match the official proposal owner and term'; END IF;
    FOREACH actor_id IN ARRAY ARRAY[NEW.reviewed_by,NEW.decided_by,NEW.finalized_by] LOOP
      IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."USER_ACCOUNT" WHERE id=actor_id) THEN
        RAISE EXCEPTION 'UC18 actor does not exist';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER eligibility_transition_guard BEFORE INSERT OR UPDATE OR DELETE ON public."DEFENSE_ELIGIBILITY"
FOR EACH ROW EXECUTE FUNCTION public.eligibility_transition_guard();
-- Legacy table ACL/RLS is preserved, not disabled or broadened. Approval and
-- runtime-role rehearsal are required before any separate legacy security DDL.
INSERT INTO public."PERMISSION"(id,resource,action,description)
SELECT gen_random_uuid()::text,'defense-eligibility',action,'UC18: '||action
FROM (VALUES ('read'),('review'),('decide'),('finalize')) AS x(action)
ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p
WHERE p.resource='defense-eligibility' AND
 ((r.name='FACULTY' AND p.action IN ('read','review','decide','finalize'))
   OR (r.name IN ('STUDENT','LECTURER') AND p.action='read'))
ON CONFLICT DO NOTHING;
COMMIT;
