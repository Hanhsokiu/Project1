import { afterEach, describe, expect, it, vi } from "vitest";
import { LOOKUP_STALE_TIME, SnapshotLookupCache } from "./snapshot-lookup-cache";

afterEach(() => vi.useRealTimers());

describe("snapshot reference list cache", () => {
  it("shares in-flight reads and reuses them until the freshness window expires", async () => {
    vi.useFakeTimers();
    const cache = new SnapshotLookupCache();
    const load = vi.fn(async () => [{ id: "department" }]);
    const first = cache.read("account-a", "/departments", load);
    const second = cache.read("account-a", "/departments", load);
    expect(first).toBe(second);
    await first;
    await cache.read("account-a", "/departments", load);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(LOOKUP_STALE_TIME);
    await cache.read("account-a", "/departments", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invalidates only the affected lookup and the semester created through a term", async () => {
    const cache = new SnapshotLookupCache();
    const load = vi.fn(async () => []);
    for (const path of ["/departments", "/training-systems", "/semesters"])
      await cache.read("account-a", path, load);
    expect(cache.invalidateWrite("https://api.example/api/departments/d")).toEqual(["/departments"]);
    await cache.read("account-a", "/departments", load);
    await cache.read("account-a", "/training-systems", load);
    expect(load).toHaveBeenCalledTimes(4);
    cache.invalidateWrite("/terms");
    await cache.read("account-a", "/semesters", load);
    expect(load).toHaveBeenCalledTimes(5);
    cache.invalidateWrite("/students/s");
    await cache.read("account-a", "/training-systems", load);
    expect(load).toHaveBeenCalledTimes(5);
  });

  it("does not reuse another session's data or cache rejected requests", async () => {
    const cache = new SnapshotLookupCache();
    const load = vi.fn(async () => "first");
    await cache.read("account-a", "/departments", load);
    load.mockRejectedValueOnce(new Error("API unavailable"));
    await expect(cache.read("account-b", "/departments", load)).rejects.toThrow("API unavailable");
    load.mockResolvedValue("second");
    expect(await cache.read("account-b", "/departments", load)).toBe("second");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("does not restore an invalidated in-flight result to the cache", async () => {
    const cache = new SnapshotLookupCache();
    let resolveOld!: (value: string) => void;
    const old = cache.read("account-a", "/departments", () =>
      new Promise<string>((resolve) => { resolveOld = resolve; }));
    await Promise.resolve();
    cache.invalidate(["/departments"]);
    await cache.read("account-a", "/departments", async () => "new");
    resolveOld("old");
    await old;
    expect(await cache.read("account-a", "/departments", async () => "unexpected")).toBe("new");
  });
});
