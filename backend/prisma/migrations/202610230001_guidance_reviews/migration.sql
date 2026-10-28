-- Step 8C: reuse PR2B review/meeting models; additive indexes, grants and guards.
BEGIN;
SET LOCAL lock_timeout='10s';
CREATE INDEX "PROGRESS_REVIEW_reviewerUserId_recordedAt_idx" ON public."PROGRESS_REVIEW"("reviewerUserId","recordedAt");
CREATE INDEX "GUIDANCE_MEETING_guidance_plan_id_meeting_date_idx" ON public."GUIDANCE_MEETING"(guidance_plan_id,meeting_date);
CREATE INDEX "NOTIFICATION_user_id_created_at_id_idx" ON public."NOTIFICATION"(user_id,created_at,id);
INSERT INTO public."PERMISSION"(id,resource,action,description) VALUES
 ('perm-task-review','task','review','Review/amend current submissions as current official advisor'),
 ('perm-guidance-monitor','guidance','monitor','Read scoped faculty guidance dashboard') ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p
 WHERE (r.name='LECTURER' AND p.resource='task' AND p.action='review') OR
 (r.name='FACULTY' AND p.resource='guidance' AND p.action='monitor') ON CONFLICT DO NOTHING;
-- Deferred consistency for canonical 8B submissions only. Legacy rows stay untouched.
CREATE FUNCTION public.step8c_review_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE task_id text; w record;
BEGIN
 IF TG_TABLE_NAME='PROGRESS_REVIEW' THEN
  SELECT "taskId" INTO task_id FROM public."SUBMISSION_WORKFLOW" WHERE "submissionId"=NEW."submissionId";
 ELSE task_id:=NEW."taskId"; END IF;
 SELECT tw.state AS task_state,sw.state AS submission_state,sw."effectiveReviewId",sw."contextSnapshot",
  r.state AS review_state,r.decision,r."submissionId" AS reviewed_submission,sw."submissionId"
 INTO w FROM public."TASK_WORKFLOW" tw JOIN public."SUBMISSION_WORKFLOW" sw ON sw."submissionId"=tw."currentSubmissionId"
 LEFT JOIN public."PROGRESS_REVIEW" r ON r.id=sw."effectiveReviewId" WHERE tw."taskId"=task_id;
 IF NOT FOUND OR w."contextSnapshot" IS NULL THEN RETURN NEW; END IF;
 IF (w.submission_state='REVIEWED' AND w."effectiveReviewId" IS NULL) OR
  (w."effectiveReviewId" IS NOT NULL AND (w.review_state IS DISTINCT FROM 'RECORDED' OR w.submission_state IS DISTINCT FROM 'REVIEWED' OR w.reviewed_submission IS DISTINCT FROM w."submissionId")) THEN
   RAISE EXCEPTION 'Effective review must be RECORDED on current REVIEWED submission' USING ERRCODE='23514';
 END IF;
 IF w.task_state<>'CANCELLED' AND w."effectiveReviewId" IS NOT NULL AND
  ((w.decision='PASS' AND w.task_state IS DISTINCT FROM 'COMPLETED') OR
   (w.decision IN('FAIL','REVISION_REQUIRED') AND w.task_state IS DISTINCT FROM 'REVISION_REQUESTED')) THEN
  RAISE EXCEPTION 'Task state must reflect the effective current submission decision' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER step8c_review_task AFTER INSERT OR UPDATE ON public."TASK_WORKFLOW"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.step8c_review_consistency();
CREATE CONSTRAINT TRIGGER step8c_review_submission AFTER INSERT OR UPDATE ON public."SUBMISSION_WORKFLOW"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.step8c_review_consistency();
CREATE CONSTRAINT TRIGGER step8c_review_record AFTER INSERT OR UPDATE ON public."PROGRESS_REVIEW"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.step8c_review_consistency();
COMMIT;
