-- Step 5 expand-only. No inferred assignment actors, versions or decisions.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE public."PROPOSAL_REVIEW_WORKFLOW"
  ADD COLUMN "assignedAt" TIMESTAMPTZ(6),
  ADD COLUMN "assignedByUserId" VARCHAR(36),
  ADD CONSTRAINT "PROPOSAL_REVIEW_WORKFLOW_assignedByUserId_fkey"
    FOREIGN KEY ("assignedByUserId") REFERENCES public."USER_ACCOUNT"(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO public."PERMISSION" (id,resource,action,description)
VALUES ('perm-proposal-read','proposal','read','Read proposals within academic scope'),
       ('perm-proposal-assign','proposal','assign','Assign proposal reviews within faculty grant'),
       ('perm-proposal-comment','proposal','comment','Comment on assigned sealed proposal versions'),
       ('perm-proposal-review','proposal','review','Start and decide assigned proposal reviews')
ON CONFLICT (resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION" (role_id,permission_id)
SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p
WHERE p.resource='proposal'
  AND ((r.name='FACULTY' AND p.action IN ('read','assign'))
    OR (r.name='LECTURER' AND p.action IN ('read','comment','review'))
    OR (r.name='STUDENT' AND p.action='read'))
ON CONFLICT DO NOTHING;
-- Existing PR2B constraints already enforce one active round/proposal, one
-- immutable decision/round and matching review/version ownership. Retain them.
COMMIT;
