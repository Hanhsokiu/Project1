// Budget session connections across the team's long-lived NestJS instances.
// Prisma's CPU-based pool default can exceed a small shared Supabase pool.
export function runtimeDatabaseUrl(value: string | undefined) {
  if (!value) return value;
  const url = new URL(value);
  const sessionPooler =
    url.hostname.endsWith('.pooler.supabase.com') &&
    (url.port === '' || url.port === '5432');
  if (!sessionPooler) return value;

  if (!url.searchParams.has('connection_limit'))
    url.searchParams.set('connection_limit', '3');
  return url.toString();
}
