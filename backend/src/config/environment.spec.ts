import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./environment";

const base = {
  DATABASE_URL: "postgresql://user:example@localhost:5432/test",
  DIRECT_URL: "postgresql://user:example@localhost:5432/test",
  JWT_SECRET: "test-access-secret-at-least-16",
  JWT_REFRESH_SECRET: "test-refresh-secret-at-least-16",
};

describe("backend environment", () => {
  it("keeps all nine B9-B10 writes disabled and local storage compatible by default", () => {
    const config = validateEnvironment(base);
    for (let uc = 17; uc <= 25; uc++) {
      expect(config[`UC${uc}_WRITES_ENABLED` as keyof typeof config]).toBe(
        "false",
      );
      expect(() =>
        validateEnvironment({ ...base, [`UC${uc}_WRITES_ENABLED`]: "1" }),
      ).toThrow(`UC${uc}_WRITES_ENABLED`);
    }
    expect(config.STORAGE_GUIDANCE_DRIVER).toBe("local");
    expect(() =>
      validateEnvironment({ ...base, STORAGE_GUIDANCE_DRIVER: "public" }),
    ).toThrow("STORAGE_GUIDANCE_DRIVER");
  });
  it("fails startup for incomplete, redirect-capable or credential-bearing object storage configuration", () => {
    const storage = {
      ...base,
      STORAGE_GUIDANCE_DRIVER: "supabase",
      STORAGE_SUPABASE_URL: "https://storage.example.invalid",
      STORAGE_SUPABASE_BUCKET: "private-integration",
      STORAGE_SUPABASE_SERVICE_KEY: "synthetic-private-key-not-for-deployment",
    };
    expect(validateEnvironment(storage).STORAGE_GUIDANCE_DRIVER).toBe(
      "supabase",
    );
    for (const url of [
      "http://storage.example.invalid",
      "https://user:secret@storage.example.invalid",
      "https://storage.example.invalid/path",
      "https://storage.example.invalid?token=hidden",
      "https://storage.example.invalid/#private",
    ]) {
      expect(() =>
        validateEnvironment({ ...storage, STORAGE_SUPABASE_URL: url }),
      ).toThrow("STORAGE_SUPABASE_URL");
    }
    for (const field of [
      "STORAGE_SUPABASE_URL",
      "STORAGE_SUPABASE_BUCKET",
      "STORAGE_SUPABASE_SERVICE_KEY",
    ]) {
      expect(() => validateEnvironment({ ...storage, [field]: "" })).toThrow(
        field,
      );
    }
    expect(() =>
      validateEnvironment({
        ...storage,
        STORAGE_SUPABASE_SERVICE_KEY: "REPLACE_WITH_PRIVATE_SERVER_KEY",
      }),
    ).toThrow("STORAGE_SUPABASE_SERVICE_KEY");
    try {
      validateEnvironment({
        ...storage,
        STORAGE_SUPABASE_URL:
          "https://user:never-print-this@storage.example.invalid",
      });
    } catch (error) {
      expect(String(error)).not.toContain("never-print-this");
    }
  });
  it("accepts local CI and TLS Supabase URLs, coercing ports", () => {
    expect(validateEnvironment(base).UC23_WRITES_ENABLED).toBe("false");
    expect(validateEnvironment(base).UC24_WRITES_ENABLED).toBe("false");
    expect(validateEnvironment(base).UC25_WRITES_ENABLED).toBe("false");
    expect(validateEnvironment(base).UC25_MAX_ROWS).toBe(100);
    expect(validateEnvironment({ ...base, PORT: "3001" }).PORT).toBe(3001);
    expect(
      validateEnvironment({
        ...base,
        DIRECT_URL:
          "postgresql://user:example@db.example.supabase.co:5432/postgres?sslmode=require",
      }).PORT,
    ).toBe(3000);
  });
  it("rejects missing URLs, weak secrets and invalid ports without exposing values", () => {
    expect(() =>
      validateEnvironment({ ...base, DIRECT_URL: undefined }),
    ).toThrow("DIRECT_URL");
    expect(() =>
      validateEnvironment({ ...base, JWT_SECRET: "short", PORT: "invalid" }),
    ).toThrow("JWT_SECRET");
    expect(() =>
      validateEnvironment({
        ...base,
        JWT_SECRET: "REPLACE_WITH_RANDOM_ACCESS_SECRET",
      }),
    ).toThrow("JWT_SECRET");
    const credential = "sensitive-value-never-print";
    try {
      validateEnvironment({ ...base, DATABASE_URL: credential });
    } catch (error) {
      expect(String(error)).not.toContain(credential);
    }
  });
  it("requires TLS for Supabase and preserves unrelated JWT configuration", () => {
    expect(() =>
      validateEnvironment({
        ...base,
        DIRECT_URL:
          "postgresql://user:example@db.example.supabase.co:5432/postgres",
      }),
    ).toThrow("DIRECT_URL");
    expect(
      validateEnvironment({ ...base, JWT_EXPIRES_IN: "8h" }).JWT_EXPIRES_IN,
    ).toBe("8h");
  });
  it("accepts multiple browser origins and rejects invalid origins", () => {
    expect(
      validateEnvironment({
        ...base,
        FRONTEND_URL: "http://localhost:5173,http://127.0.0.1:5173",
      }).FRONTEND_URL,
    ).toContain(",");
    expect(() =>
      validateEnvironment({
        ...base,
        FRONTEND_URL: "http://localhost:5173,invalid",
      }),
    ).toThrow("FRONTEND_URL");
  });
});
