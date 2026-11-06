-- Step 6 additive metadata and enforcement of the approved immutable snapshot contract.
BEGIN;
SET LOCAL lock_timeout='10s';
ALTER TABLE public."PROPOSAL_VERSION_WORKFLOW"
  ADD COLUMN "changeSummary" TEXT,
  ADD COLUMN "revisionResponses" JSONB;
ALTER TABLE public."PROPOSAL_VERSION_WORKFLOW" ADD CONSTRAINT step6_responses_array
  CHECK ("revisionResponses" IS NULL OR jsonb_typeof("revisionResponses")='array');
CREATE FUNCTION public.step6_preserve_version_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."PROPOSAL_VERSION_WORKFLOW" WHERE "versionId"=OLD.id AND state IN ('DRAFT','SEALED')) THEN
    RAISE EXCEPTION 'Proposal snapshot is immutable; append a new version' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER step6_snapshot_immutable BEFORE UPDATE OR DELETE ON public."PROPOSAL_VERSION"
FOR EACH ROW EXECUTE FUNCTION public.step6_preserve_version_content();
CREATE FUNCTION public.step6_preserve_version_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state IN ('DRAFT','SEALED') THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Proposal snapshot metadata cannot be deleted' USING ERRCODE='23514'; END IF;
    IF OLD.state<>'DRAFT' OR NEW.state<>'SEALED'
       OR (to_jsonb(NEW)-'state'-'submittedAt'-'submittedByUserId'-'updatedAt'-'revision') IS DISTINCT FROM
          (to_jsonb(OLD)-'state'-'submittedAt'-'submittedByUserId'-'updatedAt'-'revision')
       OR NEW."submittedAt" IS NULL OR NEW."submittedByUserId" IS NULL OR NEW.revision<>OLD.revision+1 THEN
      RAISE EXCEPTION 'Only a one-time DRAFT to SEALED transition is allowed' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER step6_snapshot_metadata_immutable BEFORE UPDATE OR DELETE ON public."PROPOSAL_VERSION_WORKFLOW"
FOR EACH ROW EXECUTE FUNCTION public.step6_preserve_version_metadata();
INSERT INTO public."PERMISSION" (id,resource,action,description)
VALUES ('perm-proposal-edit','proposal','edit','Append proposal snapshots as owner or current official advisor'),
       ('perm-proposal-submit','proposal','submit','Submit own current proposal snapshot')
ON CONFLICT (resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION" (role_id,permission_id)
SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p
WHERE p.resource='proposal' AND ((r.name='STUDENT' AND p.action IN ('read','edit','submit'))
  OR (r.name='LECTURER' AND p.action IN ('read','edit')))
ON CONFLICT DO NOTHING;
-- Legacy rows with unknown state remain unchanged; no actor/ownership/approval backfill.
COMMIT;
