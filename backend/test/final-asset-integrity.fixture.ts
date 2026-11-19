// TEST_ONLY reference model of the UC17 integrity contract, NOT a PostgreSQL
// emulator. It cannot verify trigger execution, MVCC, locks, RLS or deadlocks.
import type { FileAsset } from "@prisma/client";
import { isDeepStrictEqual } from "util";

type State = {
  assets: Map<string, FileAsset>;
  versions: Map<string, string>;
  weekly: Set<string>;
  generations: Map<string, number>;
};
export function finalAssetIntegrityModel() {
  let state: State = {
    assets: new Map(),
    versions: new Map(),
    weekly: new Set(),
    generations: new Map(),
  };
  const asset = (id: string) => {
    const a = state.assets.get(id);
    if (!a) throw Error("ASSET_MISSING");
    return a;
  };
  const linked = (id: string) => [...state.versions.values()].includes(id);
  const touch = (id: string, expectedGeneration?: number) => {
    asset(id);
    const current = state.generations.get(id)!;
    if (expectedGeneration !== undefined && expectedGeneration !== current)
      throw Error("SERIALIZATION_CONFLICT_MODEL");
    state.generations.set(id, current + 1);
  };
  return {
    add(a: FileAsset) {
      if (state.assets.has(a.id)) throw Error("ASSET_DUPLICATE");
      state.assets.set(a.id, structuredClone(a));
      state.generations.set(a.id, 0);
    },
    get: (id: string) => structuredClone(asset(id)),
    generation: (id: string) => state.generations.get(id)!,
    final(id: string, owner: string, version: string, expected?: number) {
      const a = asset(id);
      touch(id, expected);
      if (linked(id) || state.versions.has(version))
        throw Error("FINAL_DUPLICATE");
      if (state.weekly.has(id)) throw Error("WEEKLY_ASSET");
      if (
        a.createdByUserId !== owner ||
        a.kind !== "REPORT" ||
        a.state !== "READY" ||
        a.mimeType !== "application/pdf" ||
        a.sizeBytes <= 0 ||
        !/^[0-9a-f]{64}$/.test(a.checksum) ||
        !/^guidance\/[0-9a-f-]{36}$/.test(a.storageKey) ||
        a.storageKey !== `guidance/${a.id}`
      )
        throw Error("FINAL_ASSET_INVALID");
      state.versions.set(version, id);
    },
    weekly(id: string, expected?: number) {
      touch(id, expected);
      if (linked(id)) throw Error("FINAL_ASSET");
      state.weekly.add(id);
    },
    update(id: string, data: Partial<FileAsset>, expected?: number) {
      const before = asset(id),
        after = { ...before, ...data };
      touch(id, expected);
      if (linked(id) && !isDeepStrictEqual(before, after))
        throw Error("FINAL_METADATA_IMMUTABLE");
      state.assets.set(id, after);
    },
    delete(id: string, expected?: number) {
      touch(id, expected);
      if (linked(id)) throw Error("FINAL_DELETE_FORBIDDEN");
      state.assets.delete(id);
    },
    transaction<T>(fn: () => T): T {
      const before = structuredClone(state);
      try {
        return fn();
      } catch (e) {
        state = before;
        throw e;
      }
    },
    version: (id: string) => state.versions.get(id),
  };
}
