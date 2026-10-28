-- Step 9: independent submission window and a single current PDF per proposal.
-- Preserve legacy file_path values and the existing FINAL_REPORT.proposal_id FK.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE public."FINAL_REPORT_SUBMISSION_WINDOW" (
  "term_id" VARCHAR(36) NOT NULL,
  "opens_at" TIMESTAMPTZ(6) NOT NULL,
  "closes_at" TIMESTAMPTZ(6) NOT NULL,
  "is_locked" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FINAL_REPORT_SUBMISSION_WINDOW_pkey" PRIMARY KEY ("term_id"),
  CONSTRAINT "FINAL_REPORT_SUBMISSION_WINDOW_term_id_fkey"
    FOREIGN KEY ("term_id") REFERENCES public."THESIS_TERM"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "final_report_window_dates_increasing" CHECK ("opens_at" < "closes_at"),
  CONSTRAINT "final_report_window_revision_nonnegative" CHECK ("revision" >= 0)
);

ALTER TABLE public."FINAL_REPORT"
  ADD COLUMN "file_asset_id" VARCHAR(36),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "final_report_revision_nonnegative" CHECK ("revision" >= 0);

CREATE UNIQUE INDEX "FINAL_REPORT_file_asset_id_key"
  ON public."FINAL_REPORT"("file_asset_id");

ALTER TABLE public."FINAL_REPORT"
  ADD CONSTRAINT "FINAL_REPORT_file_asset_id_fkey"
  FOREIGN KEY ("file_asset_id") REFERENCES public."FILE_ASSET"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Follow the existing private-table convention; no permissions or configuration
-- records are created. Access remains through the backend database role.
REVOKE ALL ON TABLE public."FINAL_REPORT_SUBMISSION_WINDOW" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public."FINAL_REPORT_SUBMISSION_WINDOW" FROM %I', r
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
