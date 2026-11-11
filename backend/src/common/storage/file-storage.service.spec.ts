import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { copyFile, mkdir, mkdtemp, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { createHash } from "crypto";
import path from "path";
import { FileStorageService } from "./file-storage.service";
let root: string;
const key = "guidance/10000000-0000-4000-8000-000000000001";
const service = () =>
  new FileStorageService(new ConfigService({ STORAGE_LOCAL_PATH: root }));
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "uc17-storage-readonly-"));
});
afterEach(async () => {
  vi.unstubAllGlobals();
  const owned = path.resolve(root),
    parent = path.resolve(tmpdir());
  if (
    path.dirname(owned).toLowerCase() !== parent.toLowerCase() ||
    !path.basename(owned).startsWith("uc17-storage-readonly-")
  )
    throw Error("Refusing cleanup outside owned synthetic temp root");
  await rm(owned, { recursive: true, force: true });
});
describe("private guidance storage remains read-only on GET", () => {
  it("does not create a private directory when a missing PDF is read", async () => {
    await expect(service().readPrivateGuidance(key, 100)).rejects.toMatchObject(
      { code: "ENOENT" },
    );
    await expect(
      stat(path.join(root, ".private-guidance")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("keeps immutable bytes readable from a new service instance using the same root", async () => {
    const bytes = Buffer.from("synthetic-only-pdf-bytes");
    await service().savePrivateGuidance(key, bytes);
    expect(await service().readPrivateGuidance(key, 100)).toEqual(bytes);
    await expect(
      service().savePrivateGuidance(key, Buffer.from("replacement")),
    ).rejects.toMatchObject({ code: "EEXIST" });
    expect(await service().readPrivateGuidance(key, 100)).toEqual(bytes);
  });
  it("keeps deletion of a missing private root idempotent without creating it", async () => {
    await service().deletePrivateGuidance(key);
    await expect(
      stat(path.join(root, ".private-guidance")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("rejects traversal keys before creating storage directories", async () => {
    await expect(
      service().savePrivateGuidance(
        "guidance/../other",
        Buffer.from("synthetic"),
      ),
    ).rejects.toThrow("Invalid private storage key");
    await expect(
      stat(path.join(root, ".private-guidance")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("restores synthetic immutable PDF bytes into a separate root and verifies SHA-256", async () => {
    const bytes = Buffer.from("%PDF-1.7\nsynthetic-backup-fixture\n%%EOF");
    const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    await service().savePrivateGuidance(key, bytes);
    const backupRoot = path.join(root, "owned-synthetic-backup");
    const restoreRoot = path.join(root, "owned-synthetic-restore");
    await mkdir(backupRoot, { recursive: true, mode: 0o700 });
    await mkdir(path.join(restoreRoot, ".private-guidance"), {
      recursive: true,
      mode: 0o700,
    });
    const filename = key.slice("guidance/".length);
    await copyFile(
      path.join(root, ".private-guidance", filename),
      path.join(backupRoot, filename),
    );
    await copyFile(
      path.join(backupRoot, filename),
      path.join(restoreRoot, ".private-guidance", filename),
    );
    const restored = new FileStorageService(
      new ConfigService({ STORAGE_LOCAL_PATH: restoreRoot }),
    );
    const actual = await restored.readPrivateGuidance(key, bytes.length);
    expect(actual).toEqual(bytes);
    expect(sha(actual)).toBe(sha(bytes));
    expect(await service().readPrivateGuidance(key, bytes.length)).toEqual(
      bytes,
    );
    await expect(
      restored.readPrivateGuidance(key, bytes.length - 1),
    ).rejects.toThrow("Invalid private file");
  });
  it("rejects unbounded limits on local reads", async () => {
    await expect(service().readPrivateGuidance(key, Infinity)).rejects.toThrow(
      "size limit",
    );
    await expect(service().readPrivateGuidance(key, 0)).rejects.toThrow(
      "size limit",
    );
  });
  it("does not fall back to local bytes or delete them after switching to an empty object provider", async () => {
    const bytes = Buffer.from("%PDF-1.7\nowned-local-fixture\n%%EOF");
    await service().savePrivateGuidance(key, bytes);
    const remote = new FileStorageService(
      new ConfigService({
        STORAGE_LOCAL_PATH: root,
        STORAGE_GUIDANCE_DRIVER: "supabase",
        STORAGE_SUPABASE_URL: "https://storage.example.invalid",
        STORAGE_SUPABASE_BUCKET: "private-synthetic-fixtures",
        STORAGE_SUPABASE_SERVICE_KEY: "synthetic-test-only-credential",
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async (url: string) =>
          url.includes("/bucket/")
            ? new Response(
                JSON.stringify({
                  id: "private-synthetic-fixtures",
                  public: false,
                }),
              )
            : new Response("missing", { status: 404 }),
        ),
    );
    await expect(remote.readPrivateGuidance(key, bytes.length)).rejects.toThrow(
      "unavailable",
    );
    await expect(remote.deletePrivateGuidance(key)).rejects.toThrow(
      "cleanup was not completed",
    );
    expect(await service().readPrivateGuidance(key, bytes.length)).toEqual(
      bytes,
    );
  });
});
