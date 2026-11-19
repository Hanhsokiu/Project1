-- REVIEW ONLY. Never run after any UC17 writes. Prefer disabling writes + roll-forward.
-- Does NOT delete academic rows, audit, idempotency, files, permissions or policies.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- Rehearsal/maintenance only, with all writers stopped. Fail immediately if any
-- writer holds a conflicting table lock; do not wait while holding reverse-order
-- child/parent locks. An operator must ROLLBACK the transaction on any error.
LOCK TABLE public."FILE_ASSET",public."SUBMISSION_ASSET",public."GUIDANCE_SUBMISSION_UPLOAD",
  public."FINAL_REPORT",public."FINAL_REPORT_VERSION",public."DEFENSE_CONFIRMATION",
  public."SCORE_ENTRY",public."AUDIT_LOG",public."IDEMPOTENCY_RECORD" IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION")
    OR EXISTS(SELECT 1 FROM public."FINAL_REPORT" WHERE revision <> 0)
    OR EXISTS(SELECT 1 FROM public."DEFENSE_CONFIRMATION" WHERE revision <> 0 OR report_version_id IS NOT NULL OR context IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public."SCORE_ENTRY" WHERE revision <> 0 OR report_version_id IS NOT NULL OR comment IS NOT NULL OR context IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public."AUDIT_LOG" WHERE resource='final-defense')
    OR EXISTS(SELECT 1 FROM public."IDEMPOTENCY_RECORD" WHERE route LIKE '/proposals/%/final-report/%')
  THEN RAISE EXCEPTION 'UC17 data/staging exists; rollback refused. Preserve data and roll forward.'; END IF;
END $$;
DROP TRIGGER final_pdf_no_weekly_submission ON public."SUBMISSION_ASSET";
DROP TRIGGER final_pdf_no_weekly_upload ON public."GUIDANCE_SUBMISSION_UPLOAD";
DROP FUNCTION public.final_pdf_no_weekly_reuse();
-- Remove the FILE_ASSET guard before dropping its referenced version table.
-- Keep the baseline step8b_file_asset_guard and all weekly guards untouched.
DROP TRIGGER final_pdf_asset_immutable ON public."FILE_ASSET";
DROP FUNCTION public.final_pdf_asset_immutable();
DROP TRIGGER final_confirmation_owner ON public."DEFENSE_CONFIRMATION";
DROP TRIGGER advisor_score_owner ON public."SCORE_ENTRY";
DROP FUNCTION public.final_decision_owner_check();
ALTER TABLE public."DEFENSE_CONFIRMATION" DROP CONSTRAINT final_confirmation_version_fk, DROP CONSTRAINT final_confirmation_valid;
ALTER TABLE public."SCORE_ENTRY" DROP CONSTRAINT advisor_score_version_fk, DROP CONSTRAINT final_advisor_score_valid;
ALTER TABLE public."FINAL_REPORT" DROP CONSTRAINT final_report_revision_nonnegative;
DROP TABLE public."FINAL_REPORT_VERSION";
DROP FUNCTION public.final_pdf_immutable();
DROP FUNCTION public.final_pdf_asset_check();
ALTER TABLE public."FINAL_REPORT" DROP COLUMN revision;
ALTER TABLE public."DEFENSE_CONFIRMATION" DROP COLUMN revision,DROP COLUMN report_version_id,DROP COLUMN context;
ALTER TABLE public."SCORE_ENTRY" DROP COLUMN revision,DROP COLUMN report_version_id,DROP COLUMN comment,DROP COLUMN context;
-- Preserve all permission rows/grants: ON CONFLICT inserts may have reused existing
-- grants. Exact ACL reversal requires the reviewed pre-deployment permission snapshot.
COMMIT;
