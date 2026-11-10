import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm, stat } from "fs/promises";
import { tmpdir } from "os";
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
});
