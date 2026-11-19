import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { SupabasePrivateStorage } from "./supabase-private-storage";
import { FileStorageService } from "./file-storage.service";
import { createHash } from "crypto";

const key = "guidance/10000000-0000-4000-8000-000000000001";
const config = (extra = {}) =>
  new ConfigService({
    STORAGE_GUIDANCE_DRIVER: "supabase",
    STORAGE_SUPABASE_URL: "https://storage.example.invalid",
    STORAGE_SUPABASE_BUCKET: "private-synthetic-fixtures",
    STORAGE_SUPABASE_SERVICE_KEY: "synthetic-test-only-credential",
    ...extra,
  });
const bucket = (isPublic = false) =>
  new Response(
    JSON.stringify({
      id: "private-synthetic-fixtures",
      public: isPublic,
    }),
  );
afterEach(() => vi.unstubAllGlobals());

describe("private Supabase object adapter (mock transport, no network)", () => {
  it("saves immutably and survives a new service instance without local filesystem", async () => {
    const bytes = Buffer.from("%PDF-1.7\nsynthetic-only-pdf\n%%EOF");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(bucket())
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(bucket())
      .mockResolvedValueOnce(new Response(bytes));
    vi.stubGlobal("fetch", fetchMock);
    await new FileStorageService(config()).savePrivateGuidance(key, bytes);
    expect(
      await new FileStorageService(config()).readPrivateGuidance(
        key,
        bytes.length,
      ),
    ).toEqual(bytes);
    const write = fetchMock.mock.calls[1];
    expect(write[0]).toContain(`/object/private-synthetic-fixtures/${key}`);
    expect(write[1].headers["x-upsert"]).toBe("false");
    expect(write[1].redirect).toBe("error");
    expect(Buffer.from(write[1].body)).toEqual(bytes);
    expect(fetchMock.mock.calls[3][0]).toContain("/object/authenticated/");
    expect(
      fetchMock.mock.calls.every(
        ([url]) => !url.includes("/public/") && !url.includes("/sign/"),
      ),
    ).toBe(true);
  });

  it("rejects duplicate writes without overwriting an object", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(bucket())
        .mockResolvedValueOnce(
          new Response("provider details", { status: 409 }),
        ),
    );
    await expect(
      new SupabasePrivateStorage(config()).save(key, Buffer.from("data")),
    ).rejects.toThrow("could not be saved immutably");
  });

  it.each(["save", "read", "delete"] as const)(
    "refuses %s if bucket is public",
    async (operation) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(bucket(true));
      vi.stubGlobal("fetch", fetchMock);
      const storage = new SupabasePrivateStorage(config());
      const task =
        operation === "save"
          ? storage.save(key, Buffer.from("data"))
          : operation === "read"
            ? storage.read(key, 100)
            : storage.delete(key);
      await expect(task).rejects.toThrow("must not be public");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects key traversal before any transport call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const storage = new SupabasePrivateStorage(config());
    await expect(
      storage.save("guidance/../secret", Buffer.from("data")),
    ).rejects.toThrow("Invalid private storage key");
    await expect(
      storage.read("https://other.invalid/file", 100),
    ).rejects.toThrow("Invalid private storage key");
    await expect(storage.delete("guidance/../../file")).rejects.toThrow(
      "Invalid private storage key",
    );
    await expect(
      storage.read(`guidance/${"-".repeat(36)}`, 100),
    ).rejects.toThrow("Invalid private storage key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds declared and actual response sizes, including chunked bodies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(bucket())
      .mockResolvedValueOnce(
        new Response("large", { headers: { "Content-Length": "1000" } }),
      )
      .mockResolvedValueOnce(bucket())
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2, 3]));
              controller.enqueue(new Uint8Array([4, 5, 6]));
              controller.close();
            },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const storage = new SupabasePrivateStorage(config());
    await expect(storage.read(key, 5)).rejects.toThrow(
      "Invalid private file size",
    );
    await expect(storage.read(key, 5)).rejects.toThrow(
      "Invalid private file size",
    );
  });

  it("does not expose transport secrets or provider body on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("secret-provider-url-and-token")),
    );
    await expect(
      new SupabasePrivateStorage(config()).read(key, 100),
    ).rejects.toThrow(/^Private object storage is unavailable$/);
  });

  it("deletes only one canonical key and remains idempotent for an absent object", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(bucket())
      .mockResolvedValueOnce(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await new SupabasePrivateStorage(config()).delete(key);
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      prefixes: [key],
    });
  });

  it("does not mark cleanup successful when bucket or authorization is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not found", { status: 404 })),
    );
    await expect(
      new SupabasePrivateStorage(config()).delete(key),
    ).rejects.toThrow("bucket is unavailable");
  });

  it.each([401, 403, 404, 500])(
    "fails closed for authenticated download status %s without returning provider details",
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(bucket())
        .mockResolvedValueOnce(
          new Response("sensitive provider body", { status }),
        );
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        new SupabasePrivateStorage(config()).read(key, 100),
      ).rejects.toThrow(/^Private object is unavailable$/);
      const headers = fetchMock.mock.calls[1][1].headers;
      expect(headers.Authorization).toBe(
        "Bearer synthetic-test-only-credential",
      );
      expect(headers.apikey).toBe("synthetic-test-only-credential");
      expect(fetchMock.mock.calls[1][1].redirect).toBe("error");
    },
  );

  it("rechecks privacy on every call instead of retaining the first bucket ACL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(bucket())
      .mockResolvedValueOnce(new Response("synthetic"))
      .mockResolvedValueOnce(bucket(true));
    vi.stubGlobal("fetch", fetchMock);
    const storage = new SupabasePrivateStorage(config());
    expect(await storage.read(key, 100)).toEqual(Buffer.from("synthetic"));
    await expect(storage.read(key, 100)).rejects.toThrow("must not be public");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("restores a stateful synthetic object backup into a separate store with exact hashes", async () => {
    // This exercises transport serialization across new adapter instances. It is
    // not a claim that a live Supabase bucket or Render restart has been tested.
    let objects = new Map<string, Buffer>();
    const fetchMock = vi.fn(async (input: string, init: RequestInit) => {
      if (input.endsWith("/bucket/private-synthetic-fixtures")) return bucket();
      if (init.method === "POST") {
        if (objects.has(input))
          return new Response("conflict", { status: 409 });
        objects.set(input, Buffer.from(init.body as Uint8Array));
        return new Response("{}");
      }
      const objectUrl = input.replace("/object/authenticated/", "/object/");
      const bytes = objects.get(objectUrl);
      return bytes
        ? new Response(new Uint8Array(bytes))
        : new Response("missing", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const bytes = Buffer.from("%PDF-1.7\nstateful-synthetic-backup\n%%EOF");
    const sha = (value: Buffer) =>
      createHash("sha256").update(value).digest("hex");
    await new FileStorageService(config()).savePrivateGuidance(key, bytes);
    const backup = [...objects].map(
      ([name, value]) => [name, Buffer.from(value)] as const,
    );
    const manifest = backup.map(([name, value]) => ({
      name,
      size: value.length,
      sha256: sha(value),
    }));
    objects = new Map();
    await expect(
      new FileStorageService(config()).readPrivateGuidance(key, bytes.length),
    ).rejects.toThrow("unavailable");
    objects = new Map(
      backup.map(([name, value]) => [name, Buffer.from(value)]),
    );
    const restored = await new FileStorageService(config()).readPrivateGuidance(
      key,
      bytes.length,
    );
    expect(restored).toEqual(bytes);
    expect(restored.length).toBe(manifest[0].size);
    expect(sha(restored)).toBe(manifest[0].sha256);
    await expect(
      new FileStorageService(config()).savePrivateGuidance(
        key,
        Buffer.from("replacement"),
      ),
    ).rejects.toThrow("immutably");
    expect(
      await new FileStorageService(config()).readPrivateGuidance(
        key,
        bytes.length,
      ),
    ).toEqual(bytes);
  });

  it.each([
    { STORAGE_SUPABASE_URL: "http://storage.example.invalid" },
    { STORAGE_SUPABASE_URL: "https://user:secret@storage.example.invalid" },
    { STORAGE_SUPABASE_URL: "https://storage.example.invalid/route" },
    { STORAGE_SUPABASE_URL: "https://storage.example.invalid?token=secret" },
    { STORAGE_SUPABASE_BUCKET: "../bucket" },
    { STORAGE_SUPABASE_SERVICE_KEY: "" },
  ])("rejects unsafe or incomplete configuration", (extra) => {
    expect(() => new SupabasePrivateStorage(config(extra))).toThrow(
      "configuration",
    );
  });

  it("fails closed for an unknown driver without silently choosing local storage", () => {
    expect(
      () =>
        new FileStorageService(config({ STORAGE_GUIDANCE_DRIVER: "other" })),
    ).toThrow("Invalid private guidance storage driver");
  });
});
