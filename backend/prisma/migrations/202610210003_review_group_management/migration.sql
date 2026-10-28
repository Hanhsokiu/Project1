-- Step 4 only: nullable metadata, no legacy ownership/backfill/drop.
BEGIN;
ALTER TABLE public."REVIEW_GROUP_WORKFLOW" ADD COLUMN "archivedAt" TIMESTAMPTZ(6);
CREATE INDEX "REVIEW_GROUP_WORKFLOW_departmentId_archivedAt_idx"
  ON public."REVIEW_GROUP_WORKFLOW"("departmentId", "archivedAt");
-- Define new actions only; never give ADMIN implicit academic access.
INSERT INTO public."PERMISSION" (id, resource, action, description)
VALUES ('perm-review-group-read', 'review-group', 'read', 'Read review groups within academic scope'),
       ('perm-review-group-manage', 'review-group', 'manage', 'Manage review groups within academic scope')
ON CONFLICT (resource, action) DO NOTHING;
-- Bind only existing business roles. Roles created later must be configured by
-- the auth/RBAC owner; this migration does not create users, roles or grants.
INSERT INTO public."ROLE_PERMISSION" (role_id, permission_id)
SELECT r.id, p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p
WHERE p.resource='review-group' AND p.action IN ('read','manage')
  AND (r.name='FACULTY' OR (r.name='LECTURER' AND p.action='read'))
ON CONFLICT DO NOTHING;
COMMIT;
