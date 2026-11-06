import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment';

const base = {
  DATABASE_URL: 'postgresql://user:example@localhost:5432/test',
  DIRECT_URL: 'postgresql://user:example@localhost:5432/test',
  JWT_SECRET: 'test-access-secret-at-least-16',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-16',
};

describe('backend environment', () => {
  it('accepts local CI and TLS Supabase URLs, coercing ports', () => {
    expect(validateEnvironment({ ...base, PORT: '3001' }).PORT).toBe(3001);
    expect(validateEnvironment({ ...base, DIRECT_URL: 'postgresql://user:example@db.example.supabase.co:5432/postgres?sslmode=require' }).PORT).toBe(3000);
  });
  it('rejects missing URLs, weak secrets and invalid ports without exposing values', () => {
    expect(() => validateEnvironment({ ...base, DIRECT_URL: undefined })).toThrow('DIRECT_URL');
    expect(() => validateEnvironment({ ...base, JWT_SECRET: 'short', PORT: 'invalid' })).toThrow('JWT_SECRET');
    expect(() => validateEnvironment({ ...base, JWT_SECRET: 'REPLACE_WITH_RANDOM_ACCESS_SECRET' })).toThrow('JWT_SECRET');
    const credential = 'sensitive-value-never-print';
    try { validateEnvironment({ ...base, DATABASE_URL: credential }); }
    catch (error) { expect(String(error)).not.toContain(credential); }
  });
  it('requires TLS for Supabase and preserves unrelated JWT configuration', () => {
    expect(() => validateEnvironment({ ...base, DIRECT_URL: 'postgresql://user:example@db.example.supabase.co:5432/postgres' })).toThrow('DIRECT_URL');
    expect(validateEnvironment({ ...base, JWT_EXPIRES_IN: '8h' }).JWT_EXPIRES_IN).toBe('8h');
  });
  it('accepts multiple browser origins and rejects invalid origins', () => {
    expect(validateEnvironment({ ...base, FRONTEND_URL: 'http://localhost:5173,http://127.0.0.1:5173' }).FRONTEND_URL).toContain(',');
    expect(() => validateEnvironment({ ...base, FRONTEND_URL: 'http://localhost:5173,invalid' })).toThrow('FRONTEND_URL');
  });
});
