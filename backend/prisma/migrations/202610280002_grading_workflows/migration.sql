-- Package F. Additive review only. SQL NOT EXECUTED. No legacy backfill.
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TYPE public."GradingKind" AS ENUM ('REVIEWER', 'COMMITTEE');
CREATE TYPE public."GradingSheetState" AS ENUM ('DRAFT', 'SEALED');
CREATE TYPE public."GradingResultState" AS ENUM ('SEALED', 'PUBLISHED');
ALTER TABLE public."PROPOSAL" ADD CONSTRAINT proposal_grading_term_key UNIQUE (id, term_id);

CREATE TABLE public."GRADING_POLICY" (
  term_id VARCHAR(36) PRIMARY KEY REFERENCES public."THESIS_TERM"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  current_revision_id VARCHAR(36) UNIQUE,
  CONSTRAINT grading_policy_pointer CHECK ((revision = 0 AND current_revision_id IS NULL) OR (revision > 0 AND current_revision_id IS NOT NULL)),
  CONSTRAINT grading_policy_pointer_key UNIQUE (current_revision_id, term_id, revision)
);
CREATE TABLE public."GRADING_POLICY_REVISION" (
  id VARCHAR(36) PRIMARY KEY,
  term_id VARCHAR(36) NOT NULL REFERENCES public."GRADING_POLICY"(term_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  revision INTEGER NOT NULL CHECK (revision > 0),
  config JSONB NOT NULL CHECK (jsonb_typeof(config) = 'object' AND (config->>'schemaVersion' = '1') IS TRUE),
  content_hash VARCHAR(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  recorded_at TIMESTAMPTZ(6) NOT NULL,
  recorded_by_user_id VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_policy_version_key UNIQUE (term_id, revision),
  CONSTRAINT grading_policy_identity_key UNIQUE (id, term_id, revision)
);
ALTER TABLE public."GRADING_POLICY" ADD CONSTRAINT grading_policy_current_fk
  FOREIGN KEY (current_revision_id, term_id, revision) REFERENCES public."GRADING_POLICY_REVISION"(id, term_id, revision) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE public."GRADING_SHEET" (
  id VARCHAR(36) PRIMARY KEY,
  term_id VARCHAR(36) NOT NULL REFERENCES public."THESIS_TERM"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  proposal_id VARCHAR(36) NOT NULL,
  scorer_user_id VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  kind public."GradingKind" NOT NULL,
  state public."GradingSheetState" NOT NULL DEFAULT 'DRAFT',
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  current_revision_id VARCHAR(36) UNIQUE,
  CONSTRAINT grading_sheet_proposal_fk FOREIGN KEY (proposal_id, term_id) REFERENCES public."PROPOSAL"(id, term_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_sheet_pointer CHECK ((revision = 0 AND current_revision_id IS NULL AND state = 'DRAFT') OR (revision > 0 AND current_revision_id IS NOT NULL)),
  CONSTRAINT grading_sheet_owner_key UNIQUE (term_id, proposal_id, scorer_user_id, kind),
  CONSTRAINT grading_sheet_term_key UNIQUE (id, term_id),
  CONSTRAINT grading_sheet_pointer_key UNIQUE (current_revision_id, id, revision)
);
CREATE TABLE public."GRADING_SHEET_REVISION" (
  id VARCHAR(36) PRIMARY KEY,
  sheet_id VARCHAR(36) NOT NULL,
  term_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  state public."GradingSheetState" NOT NULL,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  content_hash VARCHAR(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  source_artifact_id VARCHAR(36) NOT NULL,
  source_stage public."DefenseStage" NOT NULL CHECK (source_stage IN ('REVIEWERS', 'SCHEDULE')),
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  recorded_at TIMESTAMPTZ(6) NOT NULL,
  recorded_by_user_id VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_sheet_history_fk FOREIGN KEY (sheet_id, term_id) REFERENCES public."GRADING_SHEET"(id, term_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_sheet_source_fk FOREIGN KEY (source_artifact_id, term_id, source_stage, source_revision)
    REFERENCES public."DEFENSE_STAGE_ARTIFACT"(id, term_id, stage, workflow_revision) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_sheet_version_key UNIQUE (sheet_id, revision),
  CONSTRAINT grading_sheet_revision_identity_key UNIQUE (id, sheet_id, revision),
  CONSTRAINT grading_sheet_envelope CHECK ((
    snapshot->>'schemaVersion' = '1' AND snapshot->>'sheetId' = sheet_id AND snapshot->>'termId' = term_id
    AND (snapshot->>'revision')::integer = revision AND snapshot->>'state' = state::text
    AND snapshot->>'actorUserId' = recorded_by_user_id AND (snapshot->>'recordedAt')::timestamptz = recorded_at
    AND ((source_stage = 'REVIEWERS' AND snapshot->>'kind' = 'REVIEWER') OR (source_stage = 'SCHEDULE' AND snapshot->>'kind' = 'COMMITTEE'))
  ) IS TRUE)
);
ALTER TABLE public."GRADING_SHEET" ADD CONSTRAINT grading_sheet_current_fk
  FOREIGN KEY (current_revision_id, id, revision) REFERENCES public."GRADING_SHEET_REVISION"(id, sheet_id, revision) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE public."GRADING_RESULT" (
  proposal_id VARCHAR(36) PRIMARY KEY,
  term_id VARCHAR(36) NOT NULL REFERENCES public."THESIS_TERM"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state public."GradingResultState" NOT NULL DEFAULT 'SEALED',
  current_revision_id VARCHAR(36) UNIQUE,
  CONSTRAINT grading_result_proposal_fk FOREIGN KEY (proposal_id, term_id) REFERENCES public."PROPOSAL"(id, term_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_result_pointer CHECK ((revision = 0 AND current_revision_id IS NULL AND state = 'SEALED') OR (revision > 0 AND current_revision_id IS NOT NULL)),
  CONSTRAINT grading_result_term_key UNIQUE (proposal_id, term_id),
  CONSTRAINT grading_result_pointer_key UNIQUE (current_revision_id, proposal_id, revision)
);
CREATE TABLE public."GRADING_RESULT_REVISION" (
  id VARCHAR(36) PRIMARY KEY,
  proposal_id VARCHAR(36) NOT NULL,
  term_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  state public."GradingResultState" NOT NULL,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  content_hash VARCHAR(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  policy_revision INTEGER NOT NULL CHECK (policy_revision > 0),
  recorded_at TIMESTAMPTZ(6) NOT NULL,
  recorded_by_user_id VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_result_history_fk FOREIGN KEY (proposal_id, term_id) REFERENCES public."GRADING_RESULT"(proposal_id, term_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_result_policy_fk FOREIGN KEY (term_id, policy_revision) REFERENCES public."GRADING_POLICY_REVISION"(term_id, revision) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT grading_result_version_key UNIQUE (proposal_id, revision),
  CONSTRAINT grading_result_revision_identity_key UNIQUE (id, proposal_id, revision),
  CONSTRAINT grading_result_envelope CHECK ((
    snapshot->>'schemaVersion' = '1' AND snapshot->>'proposalId' = proposal_id AND snapshot->>'termId' = term_id
    AND (snapshot->>'revision')::integer = revision AND snapshot->>'state' = state::text
    AND (snapshot->>'policyRevision')::integer = policy_revision AND snapshot->>'actorUserId' = recorded_by_user_id
    AND (snapshot->>'recordedAt')::timestamptz = recorded_at
  ) IS TRUE)
);
ALTER TABLE public."GRADING_RESULT" ADD CONSTRAINT grading_result_current_fk
  FOREIGN KEY (current_revision_id, proposal_id, revision) REFERENCES public."GRADING_RESULT_REVISION"(id, proposal_id, revision) ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TRIGGER grading_policy_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public."GRADING_POLICY_REVISION" FOR EACH STATEMENT EXECUTE FUNCTION public.pr2b_append_only();
CREATE TRIGGER grading_sheet_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public."GRADING_SHEET_REVISION" FOR EACH STATEMENT EXECUTE FUNCTION public.pr2b_append_only();
CREATE TRIGGER grading_result_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public."GRADING_RESULT_REVISION" FOR EACH STATEMENT EXECUTE FUNCTION public.pr2b_append_only();
REVOKE ALL ON TABLE public."GRADING_POLICY", public."GRADING_POLICY_REVISION", public."GRADING_SHEET", public."GRADING_SHEET_REVISION", public."GRADING_RESULT", public."GRADING_RESULT_REVISION" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE public."GRADING_POLICY", public."GRADING_POLICY_REVISION", public."GRADING_SHEET", public."GRADING_SHEET_REVISION", public."GRADING_RESULT", public."GRADING_RESULT_REVISION" FROM %I', r);
    END IF;
  END LOOP;
END $$;
COMMIT;
