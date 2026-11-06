import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_AUTH_API", "true");
  vi.stubEnv("VITE_TERM_API", "false");
  vi.stubEnv("VITE_CATALOG_API", "false");
  vi.stubEnv("VITE_IMPORT_API", "false");
  vi.stubEnv("VITE_REGISTRATION_API", "false");
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("API source isolation", () => {
  it("selects the server for every module when API authentication is enabled", async () => {
    const { step1Api } = await import("./snapshot-api");
    const { REGISTRATION_API } =
      await import("../../features/registration/services/registration-api");
    expect(step1Api).toEqual({ term: true, catalog: true, imports: true });
    expect(REGISTRATION_API).toBe(true);
  });
  it("ignores old browser data and rejects local business writes without changing that data", async () => {
    const { createSeed } = await import("./seed");
    const { DATA_KEY, readDb, mutate } = await import("./store");
    const old = JSON.stringify(createSeed(true));
    localStorage.setItem(DATA_KEY, old);
    const db = readDb();
    expect(db.terms).toEqual([]);
    expect(db.accounts).toEqual([]);
    expect(db.tasks).toEqual([]);
    expect(db.catalogs).toEqual([]);
    expect(() => mutate("write", undefined, () => "fake success")).toThrow(
      "chưa kết nối",
    );
    expect(localStorage.getItem(DATA_KEY)).toBe(old);
  });
});
