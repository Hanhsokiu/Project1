-- UC18 whole-term coordinator and immutable finalization snapshots only.
-- No default rows, legacy backfill, eligibility changes or new permissions.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TYPE public."DefenseListState" AS ENUM ('DRAFT', 'OPEN', 'FINALIZED');

CREATE TABLE public."DEFENSE_LIST" (
  "term_id" VARCHAR(36) NOT NULL,
  "state" public."DefenseListState" NOT NULL DEFAULT 'DRAFT',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "opened_at" TIMESTAMPTZ(6),
  "opened_by_user_id" VARCHAR(36),
  "current_finalization_id" VARCHAR(36),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DEFENSE_LIST_pkey" PRIMARY KEY ("term_id"),
  CONSTRAINT "DEFENSE_LIST_term_id_fkey"
    FOREIGN KEY ("term_id") REFERENCES public."THESIS_TERM"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "DEFENSE_LIST_opened_by_user_id_fkey"
    FOREIGN KEY ("opened_by_user_id") REFERENCES public."USER_ACCOUNT"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uc18_list_revision_nonnegative" CHECK ("revision" >= 0),
  CONSTRAINT "uc18_list_state_metadata" CHECK (
    ("state" = 'DRAFT' AND "opened_at" IS NULL
      AND "opened_by_user_id" IS NULL AND "current_finalization_id" IS NULL)
    OR ("state" = 'OPEN' AND "opened_at" IS NOT NULL
      AND "opened_by_user_id" IS NOT NULL AND "current_finalization_id" IS NULL)
    OR ("state" = 'FINALIZED' AND "opened_at" IS NOT NULL
      AND "opened_by_user_id" IS NOT NULL AND "current_finalization_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "DEFENSE_LIST_current_finalization_id_term_id_revision_key"
  ON public."DEFENSE_LIST"("current_finalization_id", "term_id", "revision");

CREATE TABLE public."DEFENSE_LIST_FINALIZATION" (
  "id" VARCHAR(36) NOT NULL,
  "term_id" VARCHAR(36) NOT NULL,
  "version" INTEGER NOT NULL,
  "list_revision" INTEGER NOT NULL,
  "snapshot_schema_version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "content_hash" VARCHAR(64) NOT NULL,
  "finalized_at" TIMESTAMPTZ(6) NOT NULL,
  "finalized_by_user_id" VARCHAR(36) NOT NULL,
  CONSTRAINT "DEFENSE_LIST_FINALIZATION_pkey" PRIMARY KEY ("id"),
  -- This FK only needs the coordinator to exist, so INSERT of a new snapshot
  -- is possible while the coordinator is OPEN, before its atomic state update.
  CONSTRAINT "DEFENSE_LIST_FINALIZATION_term_id_fkey"
    FOREIGN KEY ("term_id") REFERENCES public."DEFENSE_LIST"("term_id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "DEFENSE_LIST_FINALIZATION_finalized_by_user_id_fkey"
    FOREIGN KEY ("finalized_by_user_id") REFERENCES public."USER_ACCOUNT"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uc18_finalization_version_positive" CHECK ("version" > 0),
  CONSTRAINT "uc18_finalization_list_revision_positive" CHECK ("list_revision" > 0),
  CONSTRAINT "uc18_finalization_snapshot_version_positive" CHECK ("snapshot_schema_version" > 0),
  -- Only the JSON envelope is fixed here. Roster coverage, academic proof and
  -- canonical SHA-256 verification belong to the future producer/reader.
  CONSTRAINT "uc18_finalization_snapshot_object" CHECK (jsonb_typeof("snapshot") = 'object'),
  CONSTRAINT "uc18_finalization_hash_sha256" CHECK ("content_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "DEFENSE_LIST_FINALIZATION_term_id_version_key"
  ON public."DEFENSE_LIST_FINALIZATION"("term_id", "version");
CREATE UNIQUE INDEX "DEFENSE_LIST_FINALIZATION_term_id_list_revision_key"
  ON public."DEFENSE_LIST_FINALIZATION"("term_id", "list_revision");
CREATE UNIQUE INDEX "DEFENSE_LIST_FINALIZATION_id_term_id_list_revision_key"
  ON public."DEFENSE_LIST_FINALIZATION"("id", "term_id", "list_revision");

-- MATCH SIMPLE skips this FK when current_finalization_id is NULL (DRAFT/OPEN).
-- The state CHECK requires a pointer in FINALIZED, where all three FK columns
-- are non-NULL and enforce both the term and the sealed coordinator revision.
ALTER TABLE public."DEFENSE_LIST"
  ADD CONSTRAINT "DEFENSE_LIST_current_finalization_id_term_id_revision_fkey"
    FOREIGN KEY ("current_finalization_id", "term_id", "revision")
    REFERENCES public."DEFENSE_LIST_FINALIZATION"("id", "term_id", "list_revision")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Reuse the existing append-only function without modifying any old object.
-- INSERT is deliberately absent; even empty UPDATE/DELETE/TRUNCATE statements
-- against finalization history are rejected by this statement-level trigger.
CREATE TRIGGER uc18_finalization_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public."DEFENSE_LIST_FINALIZATION"
  FOR EACH STATEMENT EXECUTE FUNCTION public.pr2b_append_only();

-- Follow the existing private-table convention. Do not grant roles or seed data.
REVOKE ALL ON TABLE public."DEFENSE_LIST", public."DEFENSE_LIST_FINALIZATION" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public."DEFENSE_LIST", public."DEFENSE_LIST_FINALIZATION" FROM %I', r
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
