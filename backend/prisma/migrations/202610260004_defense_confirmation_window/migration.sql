-- UC17 configuration only: independent from FINAL_REPORT_SUBMISSION and FINAL.
-- No default windows, permissions, advisor decisions or eligibility rows are created.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE public."DEFENSE_CONFIRMATION_WINDOW" (
  "term_id" VARCHAR(36) NOT NULL,
  "opens_at" TIMESTAMPTZ(6) NOT NULL,
  "closes_at" TIMESTAMPTZ(6) NOT NULL,
  "is_locked" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DEFENSE_CONFIRMATION_WINDOW_pkey" PRIMARY KEY ("term_id"),
  CONSTRAINT "DEFENSE_CONFIRMATION_WINDOW_term_id_fkey"
    FOREIGN KEY ("term_id") REFERENCES public."THESIS_TERM"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "defense_confirmation_window_dates_increasing" CHECK ("opens_at" < "closes_at"),
  CONSTRAINT "defense_confirmation_window_revision_nonnegative" CHECK ("revision" >= 0)
);

-- Match the existing private-table convention; no new grants or RBAC records.
REVOKE ALL ON TABLE public."DEFENSE_CONFIRMATION_WINDOW" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public."DEFENSE_CONFIRMATION_WINDOW" FROM %I', r
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
