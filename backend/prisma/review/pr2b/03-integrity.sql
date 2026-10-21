-- REVIEW ONLY. Appended inside the same transaction as generated expand DDL.
-- Supporting keys are additive; existing PK/unique/FK constraints are retained.
CREATE UNIQUE INDEX pr2b_topic_id_term ON public."TOPIC"(id,term_id);
CREATE UNIQUE INDEX pr2b_student_id_term ON public."TERM_STUDENT"(id,term_id);
CREATE UNIQUE INDEX pr2b_plan_id_term ON public."ASSIGNMENT_PLAN"(id,term_id);
CREATE UNIQUE INDEX pr2b_version_id_proposal ON public."PROPOSAL_VERSION"(id,proposal_id);
CREATE UNIQUE INDEX pr2b_review_id_proposal ON public."PROPOSAL_REVIEW"(id,proposal_id);
CREATE UNIQUE INDEX pr2b_dossier_id_proposal ON public."THESIS_DOSSIER"(id,proposal_id);
CREATE UNIQUE INDEX pr2b_guidance_id_proposal ON public."GUIDANCE_PLAN"(id,proposal_id);
CREATE UNIQUE INDEX pr2b_task_id_plan ON public."TASK"(id,guidance_plan_id);
CREATE UNIQUE INDEX pr2b_submission_id_task ON public."TASK_SUBMISSION"(id,task_id);

ALTER TABLE public."TOPIC_WORKFLOW"
  ADD CONSTRAINT pr2b_topic_owner_scope CHECK ("termStudentId" IS NULL OR "termId" IS NOT NULL),
  ADD CONSTRAINT pr2b_topic_term FOREIGN KEY ("topicId","termId") REFERENCES public."TOPIC"(id,term_id),
  ADD CONSTRAINT pr2b_owner_term FOREIGN KEY ("termStudentId","termId") REFERENCES public."TERM_STUDENT"(id,term_id);
ALTER TABLE public."TERM_WORKFLOW"
  ADD CONSTRAINT pr2b_official_plan_term FOREIGN KEY ("officialAssignmentPlanId","termId") REFERENCES public."ASSIGNMENT_PLAN"(id,term_id);
ALTER TABLE public."PROPOSAL_WORKFLOW"
  ADD CONSTRAINT pr2b_working_version_owner FOREIGN KEY ("workingVersionId","proposalId") REFERENCES public."PROPOSAL_VERSION"(id,proposal_id),
  ADD CONSTRAINT pr2b_submitted_version_owner FOREIGN KEY ("submittedVersionId","proposalId") REFERENCES public."PROPOSAL_VERSION"(id,proposal_id);
ALTER TABLE public."PROPOSAL_REVIEW_WORKFLOW"
  ADD CONSTRAINT pr2b_review_owner FOREIGN KEY ("reviewId","proposalId") REFERENCES public."PROPOSAL_REVIEW"(id,proposal_id),
  ADD CONSTRAINT pr2b_review_version_owner FOREIGN KEY ("versionId","proposalId") REFERENCES public."PROPOSAL_VERSION"(id,proposal_id),
  ADD CONSTRAINT pr2b_active_review_has_version CHECK (state IS NULL OR ("versionId" IS NOT NULL AND "roundNumber" IS NOT NULL AND "roundNumber">0));
CREATE UNIQUE INDEX pr2b_one_active_review ON public."PROPOSAL_REVIEW_WORKFLOW"("proposalId") WHERE state IN ('ASSIGNED','IN_REVIEW');
ALTER TABLE public."PROPOSAL_REVIEW_DECISION"
  ADD CONSTRAINT pr2b_decision_review_version FOREIGN KEY ("reviewId","versionId") REFERENCES public."PROPOSAL_REVIEW_WORKFLOW"("reviewId","versionId"),
  ADD CONSTRAINT pr2b_revision_comment CHECK (decision<>'REVISION_REQUIRED' OR length(btrim(comment))>0 AND comment IS NOT NULL);
ALTER TABLE public."REVIEW_COMMENT"
  ADD CONSTRAINT pr2b_comment_review_version FOREIGN KEY ("reviewId","versionId") REFERENCES public."PROPOSAL_REVIEW_WORKFLOW"("reviewId","versionId"),
  ADD CONSTRAINT pr2b_comment_not_empty CHECK (length(btrim(text))>0);
ALTER TABLE public."DOSSIER_FINALIZATION"
  ADD CONSTRAINT pr2b_finalization_owner FOREIGN KEY ("dossierId","proposalId") REFERENCES public."THESIS_DOSSIER"(id,proposal_id),
  ADD CONSTRAINT pr2b_finalization_version FOREIGN KEY ("versionId","proposalId") REFERENCES public."PROPOSAL_VERSION"(id,proposal_id),
  ADD CONSTRAINT pr2b_finalization_sequence CHECK (sequence>0);
ALTER TABLE public."DOSSIER_WORKFLOW"
  ADD CONSTRAINT pr2b_current_finalization_owner FOREIGN KEY ("currentFinalizationId","dossierId") REFERENCES public."DOSSIER_FINALIZATION"(id,"dossierId");
ALTER TABLE public."GUIDANCE_PLAN_WORKFLOW"
  ADD CONSTRAINT pr2b_guidance_proposal FOREIGN KEY ("planId","proposalId") REFERENCES public."GUIDANCE_PLAN"(id,proposal_id),
  ADD CONSTRAINT pr2b_guidance_finalization FOREIGN KEY ("finalizationId","proposalId") REFERENCES public."DOSSIER_FINALIZATION"(id,"proposalId");
ALTER TABLE public."GUIDANCE_PERIOD"
  ADD CONSTRAINT pr2b_period_dates CHECK ("startsAt"<"endsAt"),
  ADD CONSTRAINT pr2b_week_due CHECK (type<>'WEEK' OR "reportDueAt" IS NOT NULL),
  ADD CONSTRAINT pr2b_period_ordinal CHECK (ordinal>0);
ALTER TABLE public."PERIOD_REQUIRED_STUDENT"
  ADD CONSTRAINT pr2b_period_term FOREIGN KEY ("periodId","termId") REFERENCES public."GUIDANCE_PERIOD"(id,"termId"),
  ADD CONSTRAINT pr2b_required_student_term FOREIGN KEY ("termStudentId","termId") REFERENCES public."TERM_STUDENT"(id,term_id);
ALTER TABLE public."WEEKLY_REPORT_OBLIGATION"
  ADD CONSTRAINT pr2b_obligation_applicability FOREIGN KEY ("periodId","termStudentId") REFERENCES public."PERIOD_REQUIRED_STUDENT"("periodId","termStudentId"),
  ADD CONSTRAINT pr2b_current_task_has_plan CHECK ("currentTaskId" IS NULL OR "planId" IS NOT NULL);
ALTER TABLE public."TASK_WORKFLOW"
  ADD CONSTRAINT pr2b_task_plan FOREIGN KEY ("taskId","planId") REFERENCES public."TASK"(id,guidance_plan_id),
  ADD CONSTRAINT pr2b_task_obligation_period FOREIGN KEY ("obligationId","periodId") REFERENCES public."WEEKLY_REPORT_OBLIGATION"(id,"periodId"),
  ADD CONSTRAINT pr2b_current_submission_owner FOREIGN KEY ("currentSubmissionId","taskId") REFERENCES public."TASK_SUBMISSION"(id,task_id),
  ADD CONSTRAINT pr2b_weekly_task_fields CHECK (kind IS NULL OR ("planId" IS NOT NULL AND (kind<>'WEEKLY_REPORT' OR ("obligationId" IS NOT NULL AND "periodId" IS NOT NULL AND state IS NOT NULL))));
CREATE UNIQUE INDEX pr2b_one_weekly_task ON public."TASK_WORKFLOW"("obligationId") WHERE kind='WEEKLY_REPORT' AND state<>'CANCELLED';
ALTER TABLE public."WEEKLY_REPORT_OBLIGATION"
  ADD CONSTRAINT pr2b_current_task_obligation FOREIGN KEY ("currentTaskId",id) REFERENCES public."TASK_WORKFLOW"("taskId","obligationId");
ALTER TABLE public."SUBMISSION_WORKFLOW"
  ADD CONSTRAINT pr2b_submission_owner FOREIGN KEY ("submissionId","taskId") REFERENCES public."TASK_SUBMISSION"(id,task_id),
  ADD CONSTRAINT pr2b_effective_review_owner FOREIGN KEY ("effectiveReviewId","submissionId") REFERENCES public."PROGRESS_REVIEW"(id,"submissionId"),
  ADD CONSTRAINT pr2b_submission_evidence CHECK (state IS NULL OR ("versionNumber">0 AND "versionNumber" IS NOT NULL AND "submittedAt" IS NOT NULL AND "submittedByUserId" IS NOT NULL AND "deadlineSnapshot" IS NOT NULL AND "isLate" IS NOT NULL));
ALTER TABLE public."PROGRESS_REVIEW"
  ADD CONSTRAINT pr2b_review_structured_submission FOREIGN KEY ("submissionId") REFERENCES public."SUBMISSION_WORKFLOW"("submissionId"),
  ADD CONSTRAINT pr2b_progress_comment CHECK (decision='PASS' OR (comment IS NOT NULL AND length(btrim(comment))>0)),
  ADD CONSTRAINT pr2b_review_no_self CHECK (id<>"supersedesReviewId");
CREATE UNIQUE INDEX pr2b_one_effective_progress_review ON public."PROGRESS_REVIEW"("submissionId") WHERE state='RECORDED';
ALTER TABLE public."FILE_ASSET" ADD CONSTRAINT pr2b_file_size CHECK ("sizeBytes">=0);

-- Every extension aggregate revision is technical metadata, never an approval.
DO $checks$ DECLARE t text; BEGIN
  FOR t IN SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.column_name='revision'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (revision>=0)',t,'pr2b_revision_'||lower(t));
  END LOOP;
END $checks$;

-- New decision/comment/history rows are append-only; no legacy trigger changes.
CREATE FUNCTION public.pr2b_append_only() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN RAISE EXCEPTION 'PR2B append-only record: create a new event/round instead' USING ERRCODE='23514'; END;
$body$;
CREATE TRIGGER pr2b_decision_immutable BEFORE UPDATE OR DELETE ON public."PROPOSAL_REVIEW_DECISION" FOR EACH ROW EXECUTE FUNCTION public.pr2b_append_only();
CREATE TRIGGER pr2b_comment_immutable BEFORE UPDATE OR DELETE ON public."REVIEW_COMMENT" FOR EACH ROW EXECUTE FUNCTION public.pr2b_append_only();

CREATE FUNCTION public.pr2b_progress_preserve_content() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Progress review history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF (to_jsonb(NEW)-'state'-'updatedAt'-'revision') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'updatedAt'-'revision')
     OR NOT (OLD.state='RECORDED' AND NEW.state='SUPERSEDED') THEN
    RAISE EXCEPTION 'Create a superseding review instead of rewriting its decision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER pr2b_progress_content_immutable BEFORE UPDATE OR DELETE ON public."PROGRESS_REVIEW" FOR EACH ROW EXECUTE FUNCTION public.pr2b_progress_preserve_content();

CREATE FUNCTION public.pr2b_completed_requires_review() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW.state='COMPLETED' AND NOT EXISTS (
    SELECT 1 FROM public."SUBMISSION_WORKFLOW" sw
    JOIN public."PROGRESS_REVIEW" r ON r.id=sw."effectiveReviewId" AND r."submissionId"=sw."submissionId"
    WHERE sw."submissionId"=NEW."currentSubmissionId" AND sw."taskId"=NEW."taskId"
      AND r.state='RECORDED' AND r.decision='PASS'
  ) THEN RAISE EXCEPTION 'Completion requires a PASS review of the current submission' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER pr2b_completion_evidence BEFORE INSERT OR UPDATE ON public."TASK_WORKFLOW" FOR EACH ROW EXECUTE FUNCTION public.pr2b_completed_requires_review();

DO $history$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ASSIGNMENT_CHANGE','DOSSIER_HISTORY','PLAN_HISTORY','TASK_HISTORY','MEETING_HISTORY','EVALUATION_HISTORY','TASK_PROGRESS_EVENT','REVIEW_MEMBERSHIP_HISTORY'] LOOP
    EXECUTE format('CREATE TRIGGER pr2b_history_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.pr2b_append_only()',t);
  END LOOP;
END $history$;

-- SELECT-only weekly obligation coverage, independent of manual task existence.
CREATE VIEW public.pr2b_weekly_coverage AS
SELECT req."termStudentId",req."periodId",p."termId",p."reportDueAt",
       o.id AS "obligationId",o."planId",o."currentTaskId",
       (sw."submissionId" IS NOT NULL) AS "hasSubmission",
       (o.id IS NULL) AS "missingObligationRecord",
       (o."planId" IS NULL) AS "missingPlan",
       (o."currentTaskId" IS NULL) AS "missingTask",
       (now()>p."reportDueAt" AND sw."submissionId" IS NULL) AS "isOverdue",
       r.decision AS "reviewResult"
FROM public."PERIOD_REQUIRED_STUDENT" req
JOIN public."GUIDANCE_PERIOD" p ON p.id=req."periodId" AND p.type='WEEK'
LEFT JOIN public."WEEKLY_REPORT_OBLIGATION" o ON o."periodId"=req."periodId" AND o."termStudentId"=req."termStudentId"
LEFT JOIN public."TASK_WORKFLOW" tw ON tw."taskId"=o."currentTaskId" AND tw.state<>'CANCELLED'
LEFT JOIN public."SUBMISSION_WORKFLOW" sw ON sw."submissionId"=tw."currentSubmissionId" AND sw.state IN ('SUBMITTED','REVIEWED')
LEFT JOIN public."PROGRESS_REVIEW" r ON r.id=sw."effectiveReviewId" AND r.state='RECORDED';
