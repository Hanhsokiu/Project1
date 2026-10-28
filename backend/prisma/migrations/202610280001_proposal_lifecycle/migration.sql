-- Add only the explicit faculty capability. Existing academic grants still scope every command.
BEGIN;
SET LOCAL lock_timeout='10s';
INSERT INTO public."PERMISSION" (id,resource,action,description)
VALUES ('perm-proposal-reopen','proposal','reopen','Reopen approved proposals within faculty academic scope')
ON CONFLICT (resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION" (role_id,permission_id)
SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p
WHERE r.name='FACULTY' AND p.resource='proposal' AND p.action='reopen'
ON CONFLICT DO NOTHING;
COMMIT;
