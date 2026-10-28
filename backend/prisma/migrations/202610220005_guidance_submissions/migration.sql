-- Additive Step 8B. Never infer owner, submission result or file from legacy rows.
BEGIN;
SET LOCAL lock_timeout='10s';
ALTER TABLE public."SUBMISSION_WORKFLOW" ADD COLUMN "contextSnapshot" JSONB,
 ADD COLUMN "filePolicySnapshot" JSONB;
CREATE TABLE public."GUIDANCE_SUBMISSION_UPLOAD" (
 id VARCHAR(36) PRIMARY KEY, "taskId" TEXT NOT NULL REFERENCES public."TASK"(id) ON DELETE RESTRICT,
 "actorId" TEXT NOT NULL REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT,
 "storageKey" TEXT NOT NULL UNIQUE, state VARCHAR(16) NOT NULL DEFAULT 'PENDING',
 "requestKey" VARCHAR(200) NOT NULL, "payloadHash" TEXT NOT NULL, "cleanedAt" TIMESTAMPTZ(6),
 manifest JSONB NOT NULL, "policySnapshot" JSONB NOT NULL,
 "assetId" VARCHAR(36) UNIQUE REFERENCES public."FILE_ASSET"(id) ON DELETE RESTRICT,
 "submissionId" TEXT REFERENCES public."TASK_SUBMISSION"(id) ON DELETE RESTRICT,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT step8b_upload_state CHECK(state IN ('PENDING','READY','COMMITTED','EXPIRED')),
 CONSTRAINT step8b_upload_pointers CHECK(
  (state='PENDING' AND "assetId" IS NULL AND "submissionId" IS NULL) OR
  (state='READY' AND "assetId" IS NOT NULL AND "submissionId" IS NULL) OR
  (state='COMMITTED' AND "assetId" IS NOT NULL AND "submissionId" IS NOT NULL) OR
  (state='EXPIRED' AND "submissionId" IS NULL))
);
CREATE INDEX "GUIDANCE_SUBMISSION_UPLOAD_state_expiresAt_idx" ON public."GUIDANCE_SUBMISSION_UPLOAD"(state,"expiresAt");
CREATE INDEX "GUIDANCE_SUBMISSION_UPLOAD_actorId_state_idx" ON public."GUIDANCE_SUBMISSION_UPLOAD"("actorId",state);
CREATE UNIQUE INDEX "GUIDANCE_SUBMISSION_UPLOAD_actorId_taskId_requestKey_key" ON public."GUIDANCE_SUBMISSION_UPLOAD"("actorId","taskId","requestKey");
CREATE FUNCTION public.step8b_submission_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='TASK_SUBMISSION' THEN
  IF EXISTS(SELECT 1 FROM public."SUBMISSION_WORKFLOW" WHERE "submissionId"=OLD.id AND "contextSnapshot" IS NOT NULL) THEN
   RAISE EXCEPTION 'Official submission snapshots are immutable' USING ERRCODE='23514';
  END IF;
 ELSE
  IF OLD."contextSnapshot" IS NOT NULL AND (TG_OP='DELETE' OR
   (to_jsonb(NEW)-ARRAY['state','revision','effectiveReviewId','updatedAt']) IS DISTINCT FROM
   (to_jsonb(OLD)-ARRAY['state','revision','effectiveReviewId','updatedAt'])) THEN
   RAISE EXCEPTION 'Official submission snapshot metadata is immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER step8b_submission_immutable BEFORE UPDATE OR DELETE ON public."TASK_SUBMISSION"
 FOR EACH ROW EXECUTE FUNCTION public.step8b_submission_immutable();
CREATE TRIGGER step8b_snapshot_immutable BEFORE UPDATE OR DELETE ON public."SUBMISSION_WORKFLOW"
 FOR EACH ROW EXECUTE FUNCTION public.step8b_submission_immutable();
CREATE FUNCTION public.step8b_submission_file_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."GUIDANCE_SUBMISSION_UPLOAD" WHERE state='COMMITTED' AND
  ("assetId"=OLD."fileId" OR "submissionId"=OLD."submissionId")) THEN
  RAISE EXCEPTION 'Official submission file references are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER step8b_submission_file_guard BEFORE UPDATE OR DELETE ON public."SUBMISSION_ASSET"
 FOR EACH ROW EXECUTE FUNCTION public.step8b_submission_file_guard();
CREATE FUNCTION public.step8b_asset_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."SUBMISSION_WORKFLOW" WHERE "submissionId"=NEW."submissionId" AND "contextSnapshot" IS NOT NULL) AND NOT EXISTS(
  SELECT 1 FROM public."GUIDANCE_SUBMISSION_UPLOAD" u JOIN public."SUBMISSION_WORKFLOW" sw ON sw."submissionId"=NEW."submissionId"
  WHERE u."assetId"=NEW."fileId" AND u.state='READY' AND u."taskId"=sw."taskId" AND u."actorId"=sw."submittedByUserId"
   AND sw."contextSnapshot"->'files' @> jsonb_build_array(jsonb_build_object('fileId',NEW."fileId"))) THEN
  RAISE EXCEPTION 'Official file must be owned READY staging in submission manifest' USING ERRCODE='23514';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER step8b_asset_link_guard BEFORE INSERT ON public."SUBMISSION_ASSET"
 FOR EACH ROW EXECUTE FUNCTION public.step8b_asset_link_guard();
CREATE FUNCTION public.step8b_committed_upload_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state='COMMITTED' THEN RAISE EXCEPTION 'Committed upload intent is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER step8b_committed_upload_guard BEFORE UPDATE OR DELETE ON public."GUIDANCE_SUBMISSION_UPLOAD"
 FOR EACH ROW EXECUTE FUNCTION public.step8b_committed_upload_guard();
CREATE FUNCTION public.step8b_file_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."GUIDANCE_SUBMISSION_UPLOAD" WHERE "assetId"=OLD.id AND state='COMMITTED') AND
  (TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['state','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','updatedAt'])) THEN
  RAISE EXCEPTION 'Committed file metadata is immutable' USING ERRCODE='23514';
 END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER step8b_file_asset_guard BEFORE UPDATE OR DELETE ON public."FILE_ASSET"
 FOR EACH ROW EXECUTE FUNCTION public.step8b_file_asset_guard();
INSERT INTO public."PERMISSION"(id,resource,action,description) VALUES
 ('perm-submission-read','submission','read','Read submissions within parent guidance scope'),
 ('perm-submission-create','submission','create','Stage and submit own report/source files'),
 ('perm-submission-download','submission','download','Download private files within parent guidance scope')
 ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p WHERE p.resource='submission' AND
 ((r.name IN ('FACULTY','LECTURER','STUDENT') AND p.action IN ('read','download')) OR
 (r.name='STUDENT' AND p.action='create')) ON CONFLICT DO NOTHING;
COMMIT;
