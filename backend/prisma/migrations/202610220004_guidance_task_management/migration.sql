-- Step 8A additive only. Preserve legacy TaskStatus, task data and histories.
BEGIN;
SET LOCAL lock_timeout='10s';
ALTER TABLE public."TASK_WORKFLOW" ADD COLUMN "startsAt" TIMESTAMPTZ(6),
 ADD COLUMN "expectedDeliverables" TEXT, ADD COLUMN "createdByUserId" VARCHAR(36),
 ADD COLUMN "assignedAdvisorId" VARCHAR(36);
ALTER TABLE public."TASK_WORKFLOW" ADD CONSTRAINT step8a_task_creator
 FOREIGN KEY ("createdByUserId") REFERENCES public."USER_ACCOUNT"(id) ON DELETE RESTRICT;
ALTER TABLE public."TASK_WORKFLOW" ADD CONSTRAINT step8a_task_advisor
 FOREIGN KEY ("assignedAdvisorId") REFERENCES public."LECTURER"(id) ON DELETE RESTRICT;
CREATE INDEX "TASK_WORKFLOW_planId_state_periodId_idx" ON public."TASK_WORKFLOW"("planId",state,"periodId");
CREATE INDEX "TASK_guidance_plan_id_deadline_idx" ON public."TASK"(guidance_plan_id,deadline);
-- SQL-only cross-row owner checks complement existing PR2B composite FKs.
CREATE FUNCTION public.step8a_task_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t text; owner text;
BEGIN
 IF NEW."planId" IS NOT NULL AND NEW."periodId" IS NOT NULL THEN
  SELECT topic.term_id,tw."termStudentId" INTO t,owner FROM public."GUIDANCE_PLAN" gp
   JOIN public."PROPOSAL" p ON p.id=gp.proposal_id JOIN public."TOPIC" topic ON topic.id=p.topic_id
   LEFT JOIN public."TOPIC_WORKFLOW" tw ON tw."topicId"=topic.id WHERE gp.id=NEW."planId";
  IF NOT EXISTS(SELECT 1 FROM public."GUIDANCE_PERIOD" WHERE id=NEW."periodId" AND "termId"=t) THEN
   RAISE EXCEPTION 'Task period must belong to plan term' USING ERRCODE='23514';
  END IF;
  IF NEW."obligationId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."WEEKLY_REPORT_OBLIGATION" WHERE id=NEW."obligationId" AND "termStudentId"=owner AND ("planId" IS NULL OR "planId"=NEW."planId")) THEN
   RAISE EXCEPTION 'Weekly task owner must match plan owner' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW."startsAt" IS NOT NULL AND EXISTS(SELECT 1 FROM public."TASK" WHERE id=NEW."taskId" AND deadline<=NEW."startsAt") THEN
  RAISE EXCEPTION 'Task deadline must follow start time' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER step8a_task_scope BEFORE INSERT OR UPDATE ON public."TASK_WORKFLOW"
 FOR EACH ROW EXECUTE FUNCTION public.step8a_task_scope();
CREATE FUNCTION public.step8a_task_deadline() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."TASK" t JOIN public."TASK_WORKFLOW" w ON w."taskId"=t.id WHERE t.id=NEW.id AND w."startsAt" IS NOT NULL AND t.deadline<=w."startsAt") THEN
  RAISE EXCEPTION 'Task deadline must follow start time' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER step8a_task_deadline AFTER INSERT OR UPDATE ON public."TASK"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.step8a_task_deadline();
INSERT INTO public."PERMISSION"(id,resource,action,description) VALUES
 ('perm-guidance-read','guidance','read','Read scoped guidance plans and tasks'),
 ('perm-guidance-manage','guidance','manage','Manage plans as current official advisor'),
 ('perm-task-manage','task','manage','Assign and amend tasks as current official advisor'),
 ('perm-task-progress','task','progress','Append own task progress; never complete a task'),
 ('perm-task-ensure-weekly','task','ensure-weekly','Materialize a configured weekly reporting obligation')
 ON CONFLICT(resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION"(role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p WHERE
 (r.name IN('FACULTY','LECTURER','STUDENT') AND p.resource='guidance' AND p.action='read') OR
 (r.name='LECTURER' AND ((p.resource='guidance' AND p.action='manage') OR (p.resource='task' AND p.action IN('manage','ensure-weekly')))) OR
 (r.name='STUDENT' AND p.resource='task' AND p.action IN('progress','ensure-weekly'))
 ON CONFLICT DO NOTHING;
COMMIT;
