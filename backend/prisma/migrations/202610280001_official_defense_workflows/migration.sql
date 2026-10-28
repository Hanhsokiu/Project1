-- Package E: additive only. SQL NOT EXECUTED; no official rows/backfill.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TYPE public."DefenseStage" AS ENUM ('COMMITTEES', 'REVIEWERS', 'SCHEDULE');
CREATE TYPE public."DefenseStageState" AS ENUM ('DRAFT', 'FINALIZED', 'PUBLISHED');
CREATE TYPE public."DefenseAcademicVerdict" AS ENUM ('SATISFIED', 'NOT_SATISFIED', 'SPECIAL');

ALTER TABLE public."DEFENSE_LIST"
  ADD COLUMN workflow_policy JSONB,
  ADD COLUMN workflow_policy_revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN workflow_policy_updated_at TIMESTAMPTZ(6),
  ADD COLUMN workflow_policy_updated_by_user_id VARCHAR(36),
  ADD CONSTRAINT "DEFENSE_LIST_workflow_policy_updated_by_user_id_fkey"
    FOREIGN KEY (workflow_policy_updated_by_user_id) REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT defense_policy_revision CHECK (workflow_policy_revision >= 0),
  ADD CONSTRAINT defense_policy_metadata CHECK (
    (workflow_policy IS NULL AND workflow_policy_revision = 0 AND workflow_policy_updated_at IS NULL AND workflow_policy_updated_by_user_id IS NULL)
    OR (workflow_policy IS NOT NULL AND jsonb_typeof(workflow_policy) = 'object' AND workflow_policy_revision > 0 AND workflow_policy_updated_at IS NOT NULL AND workflow_policy_updated_by_user_id IS NOT NULL)
  );

CREATE TABLE public."DEFENSE_ACADEMIC_EVIDENCE" (
  id VARCHAR(36) PRIMARY KEY,
  term_id VARCHAR(36) NOT NULL REFERENCES public."THESIS_TERM"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  term_student_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  verdict public."DefenseAcademicVerdict" NOT NULL,
  source_reference TEXT NOT NULL CHECK (length(btrim(source_reference)) BETWEEN 1 AND 2000),
  note TEXT NOT NULL CHECK (length(note) <= 4000),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  content_hash VARCHAR(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  verified_at TIMESTAMPTZ(6) NOT NULL,
  verified_by_user_id VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "DEFENSE_ACADEMIC_EVIDENCE_term_id_term_student_id_revision_key" UNIQUE (term_id, term_student_id, revision)
);
CREATE INDEX "DEFENSE_ACADEMIC_EVIDENCE_term_id_student_id_revision_idx" ON public."DEFENSE_ACADEMIC_EVIDENCE" (term_id, student_id, revision);

CREATE TABLE public."DEFENSE_STAGE_WORKFLOW" (
  term_id VARCHAR(36) NOT NULL REFERENCES public."DEFENSE_LIST"(term_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  stage public."DefenseStage" NOT NULL,
  state public."DefenseStageState" NOT NULL DEFAULT 'DRAFT',
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  draft JSONB,
  source_finalization_id VARCHAR(36) NOT NULL,
  source_list_revision INTEGER NOT NULL CHECK (source_list_revision > 0),
  upstream_artifact_id VARCHAR(36),
  upstream_stage public."DefenseStage",
  upstream_revision INTEGER,
  current_artifact_id VARCHAR(36),
  updated_by_user_id VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (term_id, stage),
  CONSTRAINT defense_stage_source_fkey FOREIGN KEY (source_finalization_id, term_id, source_list_revision)
    REFERENCES public."DEFENSE_LIST_FINALIZATION"(id, term_id, list_revision) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT defense_stage_state CHECK (
    (state = 'DRAFT' AND current_artifact_id IS NULL)
    OR (state = 'FINALIZED' AND current_artifact_id IS NOT NULL)
    OR (state = 'PUBLISHED' AND stage = 'SCHEDULE' AND current_artifact_id IS NOT NULL)
  ),
  CONSTRAINT defense_stage_draft_object CHECK (draft IS NULL OR jsonb_typeof(draft) = 'object'),
  CONSTRAINT defense_stage_upstream CHECK ((
    (stage = 'COMMITTEES' AND upstream_artifact_id IS NULL AND upstream_stage IS NULL AND upstream_revision IS NULL)
    OR (stage = 'REVIEWERS' AND upstream_stage = 'COMMITTEES' AND upstream_artifact_id IS NOT NULL AND upstream_revision > 0)
    OR (stage = 'SCHEDULE' AND upstream_artifact_id IS NOT NULL AND upstream_revision > 0
        AND (upstream_stage = 'REVIEWERS' OR (state = 'DRAFT' AND upstream_stage = 'COMMITTEES')))
  ) IS TRUE)
);
CREATE UNIQUE INDEX defense_stage_current_key ON public."DEFENSE_STAGE_WORKFLOW" (current_artifact_id, term_id, stage, revision);
CREATE INDEX "DEFENSE_STAGE_WORKFLOW_term_id_state_idx" ON public."DEFENSE_STAGE_WORKFLOW" (term_id, state);

CREATE TABLE public."DEFENSE_STAGE_ARTIFACT" (
  id VARCHAR(36) PRIMARY KEY,
  term_id VARCHAR(36) NOT NULL,
  stage public."DefenseStage" NOT NULL,
  state public."DefenseStageState" NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  workflow_revision INTEGER NOT NULL CHECK (workflow_revision > 0),
  snapshot_schema_version INTEGER NOT NULL CHECK (snapshot_schema_version = 1),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  content_hash VARCHAR(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  sealed_at TIMESTAMPTZ(6) NOT NULL,
  sealed_by_user_id VARCHAR(36) NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT defense_artifact_state CHECK (state = 'FINALIZED' OR (state = 'PUBLISHED' AND stage = 'SCHEDULE')),
  CONSTRAINT defense_artifact_workflow_fkey FOREIGN KEY (term_id, stage) REFERENCES public."DEFENSE_STAGE_WORKFLOW"(term_id, stage) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT defense_artifact_version_key UNIQUE (term_id, stage, version),
  CONSTRAINT defense_artifact_revision_key UNIQUE (term_id, stage, workflow_revision),
  CONSTRAINT defense_artifact_identity_key UNIQUE (id, term_id, stage, workflow_revision)
);
ALTER TABLE public."DEFENSE_STAGE_WORKFLOW"
  ADD CONSTRAINT defense_stage_current_fkey FOREIGN KEY (current_artifact_id, term_id, stage, revision)
    REFERENCES public."DEFENSE_STAGE_ARTIFACT"(id, term_id, stage, workflow_revision) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT defense_stage_upstream_fkey FOREIGN KEY (upstream_artifact_id, term_id, upstream_stage, upstream_revision)
    REFERENCES public."DEFENSE_STAGE_ARTIFACT"(id, term_id, stage, workflow_revision) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Existing append-only function; statements with no matching rows are blocked too.
CREATE TRIGGER defense_academic_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public."DEFENSE_ACADEMIC_EVIDENCE"
  FOR EACH STATEMENT EXECUTE FUNCTION public.pr2b_append_only();
CREATE TRIGGER defense_artifact_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public."DEFENSE_STAGE_ARTIFACT"
  FOR EACH STATEMENT EXECUTE FUNCTION public.pr2b_append_only();
REVOKE ALL ON TABLE public."DEFENSE_ACADEMIC_EVIDENCE", public."DEFENSE_STAGE_WORKFLOW", public."DEFENSE_STAGE_ARTIFACT" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE public."DEFENSE_ACADEMIC_EVIDENCE", public."DEFENSE_STAGE_WORKFLOW", public."DEFENSE_STAGE_ARTIFACT" FROM %I', r);
    END IF;
  END LOOP;
END $$;
COMMIT;
