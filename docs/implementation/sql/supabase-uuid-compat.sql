-- REVIEW BEFORE EXECUTION. This script writes one function and its privileges.
-- Intended only for a fresh Supabase application schema, BEFORE Prisma deploy.
-- Project1: zlsygwjskvxgtzdjhvzt. Select the postgres role in SQL Editor.
-- Does not relocate extensions, edit migration history or create app tables.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ) THEN
    RAISE EXCEPTION 'Stop: public already has tables. Review existing schema/history first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'extensions'
  ) OR to_regprocedure('extensions.uuid_generate_v4()') IS NULL THEN
    RAISE EXCEPTION 'Stop: expected uuid-ossp in extensions is absent.';
  END IF;

  IF to_regprocedure('public.uuid_generate_v4()') IS NOT NULL THEN
    RAISE EXCEPTION 'Stop: public UUID function already exists; do not overwrite it.';
  END IF;
END
$guard$;

CREATE FUNCTION public.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
  SELECT extensions.uuid_generate_v4();
$function$;

REVOKE ALL ON FUNCTION public.uuid_generate_v4() FROM PUBLIC;
DO $privileges$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.uuid_generate_v4() FROM %I', api_role);
    END IF;
  END LOOP;
END
$privileges$;

COMMENT ON FUNCTION public.uuid_generate_v4() IS
  'Compatibility for unchanged Prisma migrations on Supabase: delegates to extensions.uuid_generate_v4(). Keep while app defaults depend on it.';

SET LOCAL search_path = public;
SELECT to_regprocedure('uuid_generate_v4()')::text AS uuid_function,
       public.uuid_generate_v4() IS NOT NULL AS generates_uuid;
COMMIT;
