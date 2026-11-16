BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Provenance readers filter by resource/resource_id and need the newest 100 rows.
-- Avoid scanning large JSON audit records for every candidate in a term.
CREATE INDEX "AUDIT_LOG_resource_history_idx"
ON public."AUDIT_LOG" (resource, resource_id, created_at DESC, id DESC);
COMMIT;
