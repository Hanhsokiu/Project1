import { describe, expect, it } from 'vitest';
import { runtimeDatabaseUrl } from './connection-url';

const sessionUrl = 'postgresql://postgres.example:p%40ss@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

describe('Runtime Supabase connection budget', () => {
  it('limits the shared session pool while preserving credentials and TLS', () => {
    const url = new URL(runtimeDatabaseUrl(sessionUrl)!);
    expect(url.searchParams.get('connection_limit')).toBe('3');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.username).toBe('postgres.example');
    expect(url.password).toBe('p%40ss');
    expect(url.pathname).toBe('/postgres');
  });

  it('recognizes the implicit PostgreSQL session port', () => {
    const url = new URL(runtimeDatabaseUrl(sessionUrl.replace(':5432', ''))!);
    expect(url.searchParams.get('connection_limit')).toBe('3');
  });

  it('respects an explicitly configured connection budget', () => {
    const url = new URL(runtimeDatabaseUrl(`${sessionUrl}&connection_limit=2&pool_timeout=20`)!);
    expect(url.searchParams.get('connection_limit')).toBe('2');
    expect(url.searchParams.get('pool_timeout')).toBe('20');
  });

  it.each([
    'postgresql://test:test@127.0.0.1:55451/test',
    'postgresql://test:test@db.example.supabase.co:5432/postgres?sslmode=require',
    sessionUrl.replace(':5432', ':6543'),
    sessionUrl.replace('.pooler.supabase.com', '.pooler.supabase.com.example.org'),
  ])('preserves other database connection modes: %s', value => {
    expect(runtimeDatabaseUrl(value)).toBe(value);
  });

  it('preserves Prisma environment fallback when no URL was supplied', () => {
    expect(runtimeDatabaseUrl(undefined)).toBeUndefined();
  });
});
