-- Restore academic scope omitted by term creation before this fix.
-- Only an active FACULTY account recorded as the term's creator qualifies.
-- Never replace or widen an existing explicit grant.
BEGIN;
SET LOCAL lock_timeout = '10s';
INSERT INTO public."ACADEMIC_TERM_GRANT"
  (id, "createdAt", "updatedAt", "allDepartments", revision, "userId", "termId")
SELECT gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, 0,
       creator.user_id, creator.resource_id
FROM (
  SELECT DISTINCT a.user_id, a.resource_id
  FROM public."AUDIT_LOG" a
  JOIN public."USER_ACCOUNT" u ON u.id = a.user_id AND u.status = 'ACTIVE'
  JOIN public."THESIS_TERM" t ON t.id = a.resource_id
  JOIN public."USER_ROLE" ur ON ur.user_id = u.id
  JOIN public."ROLE" r ON r.id = ur.role_id AND r.name = 'FACULTY'
  WHERE a.action = 'CREATE_TERM' AND a.resource = 'term'
) creator
ON CONFLICT ("userId", "termId") DO NOTHING;
COMMIT;
