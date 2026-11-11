-- REVIEW ONLY. Not in the active deploy chain. No existing rows are rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Fail rather than repair an unexpected target or invent missing academic roles.
DO $$ BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
      AND (table_name,column_name,udt_name) IN (
        ('FINAL_REPORT','proposal_id','varchar'),('DEFENSE_CONFIRMATION','advisor_id','varchar'),
        ('SCORE_ENTRY','role','varchar'),('FILE_ASSET','storageKey','text'),
        ('SUBMISSION_ASSET','fileId','varchar'),('GUIDANCE_SUBMISSION_UPLOAD','assetId','varchar'))) <> 6
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='SCORE_ENTRY' AND column_name='total_score' AND numeric_precision=4 AND numeric_scale=1)
  THEN RAISE EXCEPTION 'UC17 baseline metadata mismatch; stop and review'; END IF;
  IF (SELECT count(*) FROM public."ROLE" WHERE name IN ('STUDENT','LECTURER','FACULTY')) <> 3
  THEN RAISE EXCEPTION 'UC17 academic roles missing; no roles are created by this migration'; END IF;
END $$;
ALTER TABLE public."FINAL_REPORT" ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public."DEFENSE_CONFIRMATION" ADD COLUMN revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN report_version_id VARCHAR(36), ADD COLUMN context JSONB;
ALTER TABLE public."SCORE_ENTRY" ADD COLUMN revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN report_version_id VARCHAR(36), ADD COLUMN comment TEXT, ADD COLUMN context JSONB;
CREATE TABLE public."FINAL_REPORT_VERSION" (
  id VARCHAR(36) PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES public."FINAL_REPORT"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  file_asset_id VARCHAR(36) NOT NULL UNIQUE REFERENCES public."FILE_ASSET"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  submitted_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE(report_id, sequence)
);
ALTER TABLE public."DEFENSE_CONFIRMATION" ADD CONSTRAINT final_confirmation_version_fk
  FOREIGN KEY (report_version_id) REFERENCES public."FINAL_REPORT_VERSION"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."SCORE_ENTRY" ADD CONSTRAINT advisor_score_version_fk
  FOREIGN KEY (report_version_id) REFERENCES public."FINAL_REPORT_VERSION"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."FINAL_REPORT" ADD CONSTRAINT final_report_revision_nonnegative CHECK(revision >= 0);
ALTER TABLE public."DEFENSE_CONFIRMATION" ADD CONSTRAINT final_confirmation_valid CHECK(
  revision >= 0 AND (report_version_id IS NULL OR
    (context IS NOT NULL AND status IS NOT NULL AND status IN ('PENDING','CONFIRMED','REJECTED')
      AND (status <> 'REJECTED' OR length(btrim(coalesce(note,''))) > 0))));
ALTER TABLE public."SCORE_ENTRY" ADD CONSTRAINT final_advisor_score_valid CHECK(
  revision >= 0 AND (report_version_id IS NULL OR
    (role='ADVISOR' AND context IS NOT NULL AND total_score IS NOT NULL
      AND total_score BETWEEN 0 AND 10 AND length(btrim(coalesce(comment,''))) > 0)));
CREATE FUNCTION public.final_pdf_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Final PDF versions are append only'; END $$;
CREATE TRIGGER final_pdf_immutable BEFORE UPDATE OR DELETE ON public."FINAL_REPORT_VERSION"
  FOR EACH ROW EXECUTE FUNCTION public.final_pdf_immutable();
-- A linked final asset has no mutable technical fields in the current source.
-- Whole-row comparison also protects future metadata, id and timestamps. Exact
-- no-op UPDATE is allowed for the claim fence below; it changes no metadata.
-- SECURITY INVOKER is retained. row_security=off does NOT bypass RLS: it fails
-- instead of mistaking policy-hidden references for an unclaimed asset.
CREATE FUNCTION public.final_pdf_asset_immutable() RETURNS trigger LANGUAGE plpgsql VOLATILE
  SET search_path=pg_catalog,public SET row_security=off AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."FINAL_REPORT_VERSION" WHERE file_asset_id=OLD.id) THEN
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION 'Final PDF asset cannot be deleted' USING ERRCODE='23514';
    END IF;
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION 'Final PDF asset metadata is immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER final_pdf_asset_immutable BEFORE UPDATE OR DELETE ON public."FILE_ASSET"
  FOR EACH ROW EXECUTE FUNCTION public.final_pdf_asset_immutable();
CREATE FUNCTION public.final_pdf_asset_check() RETURNS trigger LANGUAGE plpgsql VOLATILE
  SET search_path=pg_catalog,public SET row_security=off AS $$
BEGIN
  -- Both final and weekly claims actually UPDATE the same FILE_ASSET row.
  -- A lock alone does not invalidate a waiting Repeatable Read snapshot.
  -- This SQL no-op creates a row version without changing id/updatedAt/content.
  UPDATE public."FILE_ASSET" SET id=id WHERE id=NEW.file_asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Final PDF asset claim requires an updated asset row' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."FILE_ASSET" a
    JOIN public."FINAL_REPORT" r ON r.id=NEW.report_id
    JOIN public."PROPOSAL" p ON p.id=r.proposal_id
    JOIN public."STUDENT" s ON s.id=p.student_id
    WHERE a.id=NEW.file_asset_id AND a."createdByUserId"=s.user_id
    AND a.kind='REPORT' AND a.state='READY' AND a."mimeType"='application/pdf'
    AND a."sizeBytes">0 AND a.checksum ~ '^[0-9a-f]{64}$'
    AND a."storageKey" ~ '^guidance/[0-9a-f-]{36}$'
    AND a."storageKey"='guidance/' || a.id) THEN
    RAISE EXCEPTION 'Final report requires a private ready PDF asset' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."SUBMISSION_ASSET" WHERE "fileId"=NEW.file_asset_id) THEN
    RAISE EXCEPTION 'Weekly submission assets cannot be final reports';
  END IF;
  IF EXISTS (SELECT 1 FROM public."GUIDANCE_SUBMISSION_UPLOAD" WHERE "assetId"=NEW.file_asset_id) THEN
    RAISE EXCEPTION 'Weekly upload assets cannot be final reports';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER final_pdf_asset_check BEFORE INSERT ON public."FINAL_REPORT_VERSION"
  FOR EACH ROW EXECUTE FUNCTION public.final_pdf_asset_check();
CREATE FUNCTION public.final_decision_owner_check() RETURNS trigger LANGUAGE plpgsql VOLATILE
  SET search_path=pg_catalog,public SET row_security=off AS $$
BEGIN
  IF NEW.report_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."FINAL_REPORT_VERSION" v JOIN public."FINAL_REPORT" r ON r.id=v.report_id
    WHERE v.id=NEW.report_version_id AND r.proposal_id=NEW.proposal_id
  ) THEN RAISE EXCEPTION 'Final PDF belongs to a different proposal'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER final_confirmation_owner BEFORE INSERT OR UPDATE ON public."DEFENSE_CONFIRMATION"
  FOR EACH ROW EXECUTE FUNCTION public.final_decision_owner_check();
CREATE TRIGGER advisor_score_owner BEFORE INSERT OR UPDATE ON public."SCORE_ENTRY"
  FOR EACH ROW EXECUTE FUNCTION public.final_decision_owner_check();
-- Symmetric check: an already-final PDF must not subsequently become a weekly asset.
CREATE FUNCTION public.final_pdf_no_weekly_reuse() RETURNS trigger LANGUAGE plpgsql VOLATILE
  SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE asset_id TEXT := to_jsonb(NEW)->>TG_ARGV[0];
BEGIN
  IF asset_id IS NOT NULL THEN
    -- Same row/write fence as the final claim. Never lock a final/weekly child
    -- from FILE_ASSET's guard: that would reverse the writer's lock order.
    UPDATE public."FILE_ASSET" SET id=id WHERE id=asset_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Weekly asset claim requires an updated asset row' USING ERRCODE='23514';
    END IF;
    IF EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION" WHERE file_asset_id=asset_id)
    THEN RAISE EXCEPTION 'Final PDF assets cannot be reused by weekly submissions'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER final_pdf_no_weekly_submission BEFORE INSERT OR UPDATE OF "fileId" ON public."SUBMISSION_ASSET"
  FOR EACH ROW EXECUTE FUNCTION public.final_pdf_no_weekly_reuse('fileId');
CREATE TRIGGER final_pdf_no_weekly_upload BEFORE INSERT OR UPDATE OF "assetId" ON public."GUIDANCE_SUBMISSION_UPLOAD"
  FOR EACH ROW EXECUTE FUNCTION public.final_pdf_no_weekly_reuse('assetId');
ALTER TABLE public."FINAL_REPORT_VERSION" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."FINAL_REPORT_VERSION" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public."FINAL_REPORT_VERSION" FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public."FINAL_REPORT_VERSION" FROM authenticated; END IF;
END $$;
-- Explicit rights: no ADMIN academic bypass, no student access to score/comments/reasons.
INSERT INTO public."PERMISSION"(id,resource,action,description)
SELECT gen_random_uuid()::text,resource,action,'UC17: ' || resource || ':' || action FROM (VALUES
 ('final-report','read'),('final-report','create'),('final-report','download'),
 ('defense-confirmation','read'),('defense-confirmation','review'),('defense-confirmation','decide'),
 ('defense-confirmation','score-read'),('defense-confirmation','comment-read'),
 ('defense-confirmation','rejection-read'),('defense-confirmation','status-read')
) AS p(resource,action) ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p WHERE
 (r.name IN ('STUDENT','LECTURER','FACULTY') AND ((p.resource='final-report' AND p.action IN ('read','download')) OR (p.resource='defense-confirmation' AND p.action IN ('read','status-read'))))
 OR (r.name='STUDENT' AND p.resource='final-report' AND p.action='create')
 OR (r.name='LECTURER' AND p.resource='defense-confirmation' AND p.action IN ('review','decide','score-read','comment-read','rejection-read'))
ON CONFLICT DO NOTHING;
COMMIT;
