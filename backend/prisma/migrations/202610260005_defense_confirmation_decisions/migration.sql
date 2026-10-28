-- UC17 current decision metadata and immutable history only.
-- Preserve all legacy values, both existing FKs and VARCHAR status storage.
-- revision=0 is a legacy/uninitialized marker; do not fabricate past decisions.
BEGIN;
SET LOCAL lock_timeout = '10s';

-- Typed snapshot contract, schemaVersion=1:
-- assignment: {assignmentId, revision}; pdf: null (REJECTED only), or
-- {finalReportId, revision, checksum, originalName, sizeBytes, submittedAt}.
-- No FileAsset FK, storageKey or PDF bytes are stored here. Other context keys
-- may carry progress warnings/evidence; they are not automatic eligibility rules.
CREATE FUNCTION public.uc17_decision_context_valid(context JSONB, decision_status TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $context$
  SELECT COALESCE(
    jsonb_typeof(context) = 'object'
    AND context->'schemaVersion' = '1'::jsonb
    AND jsonb_typeof(context->'assignment') = 'object'
    AND jsonb_typeof(context->'assignment'->'assignmentId') = 'string'
    AND (context->'assignment'->>'assignmentId') ~ '[^[:space:]]'
    AND jsonb_typeof(context->'assignment'->'revision') = 'number'
    AND (context->'assignment'->>'revision') ~ '^[0-9]+$'
    AND context->'assignment'->'revision' <= '2147483647'::jsonb
    AND (
      (decision_status = 'REJECTED' AND context->'pdf' = 'null'::jsonb)
      OR (
        decision_status IN ('CONFIRMED', 'REJECTED')
        AND jsonb_typeof(context->'pdf') = 'object'
        AND jsonb_typeof(context->'pdf'->'finalReportId') = 'string'
        AND (context->'pdf'->>'finalReportId') ~ '[^[:space:]]'
        AND jsonb_typeof(context->'pdf'->'revision') = 'number'
        AND (context->'pdf'->>'revision') ~ '^[0-9]+$'
        AND context->'pdf'->'revision' <= '2147483647'::jsonb
        AND jsonb_typeof(context->'pdf'->'checksum') = 'string'
        AND (context->'pdf'->>'checksum') ~ '^[0-9a-f]{64}$'
        AND jsonb_typeof(context->'pdf'->'originalName') = 'string'
        AND (context->'pdf'->>'originalName') ~ '[^[:space:]]'
        AND jsonb_typeof(context->'pdf'->'sizeBytes') = 'number'
        AND (context->'pdf'->>'sizeBytes') ~ '^[0-9]+$'
        AND context->'pdf'->'sizeBytes' > '0'::jsonb
        AND context->'pdf'->'sizeBytes' <= '2147483647'::jsonb
        AND jsonb_typeof(context->'pdf'->'submittedAt') = 'string'
        AND (context->'pdf'->>'submittedAt') ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$'
      )
    ), false
  );
$context$;

ALTER TABLE public."DEFENSE_CONFIRMATION"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "decided_at" TIMESTAMPTZ(6),
  ADD COLUMN "decided_by_user_id" VARCHAR(36),
  ADD COLUMN "decision_context" JSONB,
  ADD COLUMN "updated_at" TIMESTAMPTZ(6),
  ADD CONSTRAINT "DEFENSE_CONFIRMATION_decided_by_user_id_fkey"
    FOREIGN KEY ("decided_by_user_id") REFERENCES public."USER_ACCOUNT"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "uc17_confirmation_revision_nonnegative" CHECK ("revision" >= 0),
  ADD CONSTRAINT "uc17_confirmation_decision_metadata" CHECK (
    "revision" = 0 OR (
      "status" IS NOT NULL AND "status" IN ('CONFIRMED', 'REJECTED')
      AND "decided_at" IS NOT NULL AND "decided_by_user_id" IS NOT NULL
      AND "updated_at" IS NOT NULL
      AND ("status" <> 'REJECTED' OR ("note" IS NOT NULL AND "note" ~ '[^[:space:]]'))
      AND public.uc17_decision_context_valid("decision_context", "status")
    )
  );

CREATE TABLE public."DEFENSE_CONFIRMATION_HISTORY" (
  "id" VARCHAR(36) NOT NULL,
  "confirmation_id" VARCHAR(36) NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "note" TEXT,
  "change_reason" TEXT,
  "decided_at" TIMESTAMPTZ(6) NOT NULL,
  "actor_id" VARCHAR(36) NOT NULL,
  "advisor_id" VARCHAR(36) NOT NULL,
  "decision_context" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DEFENSE_CONFIRMATION_HISTORY_pkey" PRIMARY KEY ("id"),
  -- RESTRICT deliberately preserves history even if its parent would otherwise
  -- be deleted by the original Proposal -> DefenseConfirmation CASCADE.
  CONSTRAINT "DEFENSE_CONFIRMATION_HISTORY_confirmation_id_fkey"
    FOREIGN KEY ("confirmation_id") REFERENCES public."DEFENSE_CONFIRMATION"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "DEFENSE_CONFIRMATION_HISTORY_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES public."USER_ACCOUNT"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "DEFENSE_CONFIRMATION_HISTORY_advisor_id_fkey"
    FOREIGN KEY ("advisor_id") REFERENCES public."LECTURER"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uc17_history_revision_positive" CHECK ("revision" > 0),
  CONSTRAINT "uc17_history_status" CHECK ("status" IN ('CONFIRMED', 'REJECTED')),
  CONSTRAINT "uc17_history_rejection_note" CHECK (
    "status" <> 'REJECTED' OR ("note" IS NOT NULL AND "note" ~ '[^[:space:]]')
  ),
  CONSTRAINT "uc17_history_context" CHECK (public.uc17_decision_context_valid("decision_context", "status"))
);

CREATE UNIQUE INDEX "DEFENSE_CONFIRMATION_HISTORY_confirmation_id_revision_key"
  ON public."DEFENSE_CONFIRMATION_HISTORY"("confirmation_id", "revision");
CREATE INDEX "DEFENSE_CONFIRMATION_HISTORY_actor_id_decided_at_idx"
  ON public."DEFENSE_CONFIRMATION_HISTORY"("actor_id", "decided_at");

-- Reuse the existing append-only guard, without modifying its function or any
-- old trigger. Statement-level coverage also prevents TRUNCATE of this table.
CREATE TRIGGER uc17_history_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public."DEFENSE_CONFIRMATION_HISTORY"
  FOR EACH STATEMENT EXECUTE FUNCTION public.pr2b_append_only();

-- Follow existing private-table isolation. No RBAC or default data is inserted.
REVOKE ALL ON TABLE public."DEFENSE_CONFIRMATION_HISTORY" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public."DEFENSE_CONFIRMATION_HISTORY" FROM %I', r
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
