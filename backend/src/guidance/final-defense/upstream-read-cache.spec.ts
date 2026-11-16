import { describe, it, expect, vi } from "vitest";
import { UpstreamReadCache } from "./upstream-read-cache";

describe("transaction-scoped upstream snapshots", () => {
  it("shares one in-flight snapshot for repeated downstream consumers", async () => {
    const cache = new UpstreamReadCache();
    const load = vi.fn(async () => ({ students: Array.from({length:60},(_,i)=>i) }));
    const values = await Promise.all(Array.from({length:60},()=>cache.read("UC20","faculty","term",load)));
    expect(load).toHaveBeenCalledTimes(1);
    expect(values.every(v=>v === values[0])).toBe(true);
  });
  it("does not reuse permissions across actors, terms, producers or transactions", async () => {
    const a = new UpstreamReadCache(), b = new UpstreamReadCache();
    const load = vi.fn(async () => "snapshot");
    await a.read("UC19","faculty-a","term-a",load);
    await a.read("UC19","faculty-b","term-a",load);
    await a.read("UC19","faculty-a","term-b",load);
    await a.read("UC20","faculty-a","term-a",load);
    await b.read("UC19","faculty-a","term-a",load);
    expect(load).toHaveBeenCalledTimes(5);
  });
  it("does not preserve a failed snapshot as a successful cached result", async () => {
    const cache = new UpstreamReadCache(), load = vi.fn().mockRejectedValueOnce(Error("failed")).mockResolvedValue("current");
    await expect(cache.read("UC20","a","t",load)).rejects.toThrow("failed");
    await expect(cache.read("UC20","a","t",load)).resolves.toBe("current");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
