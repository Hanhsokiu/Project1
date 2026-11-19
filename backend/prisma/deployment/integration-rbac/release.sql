\set ON_ERROR_STOP on
-- Supply approval_json via a protected operator configuration, never edit this package with live IDs.
BEGIN;
SELECT set_config('datn.rbac_approval', :'approval_json', true);
\ir preflight.sql
\ir migration.sql
\ir postflight.sql
COMMIT;
