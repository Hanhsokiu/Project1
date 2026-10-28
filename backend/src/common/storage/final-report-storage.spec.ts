import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import * as path from "path";
import { FileStorageService } from "./file-storage.service";

const key = "final-reports/11111111-1111-4111-8111-111111111111";
const pdf = Buffer.from("private final report");
let root: string, storage: FileStorageService;
beforeEach(async () => {
  const parent = path.resolve(process.cwd(), ".tmp");
  await fs.mkdir(parent, { recursive: true });
  root = await fs.mkdtemp(path.join(parent, "final-report-storage-"));
  storage = new FileStorageService(
    new ConfigService({ STORAGE_LOCAL_PATH: path.join(root, "uploads") }),
  );
});
afterEach(async () => {
  // Never recursively remove an unchecked computed path.
  if (!root.startsWith(path.resolve(process.cwd(), ".tmp") + path.sep))
    throw new Error("Unsafe test cleanup target");
  await fs.rm(root, { recursive: true, force: true });
});

describe("Private final report storage and Step 8 compatibility", () => {
  it("stores private bytes with exclusive creation and validates read size", async () => {
    await storage.savePrivateFinalReport(key, pdf);
    expect(await storage.readPrivateFinalReport(key, pdf.length)).toEqual(pdf);
    await expect(
      storage.savePrivateFinalReport(key, Buffer.from("overwrite")),
    ).rejects.toThrow();
    await expect(
      storage.readPrivateFinalReport(key, pdf.length - 1),
    ).rejects.toThrow();
    const page = await storage.listPrivateFinalReports();
    expect(page.entries.map((e) => e.key)).toEqual([key]);
  });
  it("rejects traversal and keys from another storage namespace", async () => {
    for (const value of [
      "../x",
      "final-reports/../x",
      "guidance/11111111-1111-4111-8111-111111111111",
      "C:\\private.pdf",
      "final-reports/report.pdf",
    ]) {
      await expect(
        storage.savePrivateFinalReport(value, pdf),
      ).rejects.toThrow();
      await expect(
        storage.readPrivateFinalReport(value, pdf.length),
      ).rejects.toThrow();
      await expect(storage.deletePrivateFinalReport(value)).rejects.toThrow();
    }
  });
  it("deletes idempotently without accepting a user path", async () => {
    await storage.savePrivateFinalReport(key, pdf);
    await storage.deletePrivateFinalReport(key);
    await storage.deletePrivateFinalReport(key);
    await expect(
      storage.readPrivateFinalReport(key, pdf.length),
    ).rejects.toThrow();
  });
  it("leaves guidance methods, namespace and bytes unchanged", async () => {
    const guidance = "guidance/11111111-1111-4111-8111-111111111111";
    await storage.savePrivateGuidance(guidance, Buffer.from("weekly report"));
    await storage.savePrivateFinalReport(key, pdf);
    await storage.deletePrivateFinalReport(key);
    expect((await storage.readPrivateGuidance(guidance, 1024)).toString()).toBe(
      "weekly report",
    );
    await storage.deletePrivateGuidance(guidance);
  });
  it("rejects a private storage root redirected to another directory", async () => {
    const uploads = path.join(root, "uploads"),
      outside = path.join(root, "outside");
    await fs.mkdir(uploads);
    await fs.mkdir(outside);
    await fs.symlink(
      outside,
      path.join(uploads, ".private-final-reports"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(storage.savePrivateFinalReport(key, pdf)).rejects.toThrow();
    expect(await fs.readdir(outside)).toEqual([]);
  });
  it("paginates reconciliation files without starving later keys", async () => {
    await storage.savePrivateFinalReport(key, pdf);
    const second = "final-reports/22222222-2222-4222-8222-222222222222";
    await storage.savePrivateFinalReport(second, pdf);
    const a = await storage.listPrivateFinalReports("", 1),
      b = await storage.listPrivateFinalReports(a.cursor, 1);
    expect(a.entries.map((e) => e.key)).toEqual([key]);
    expect(b.entries.map((e) => e.key)).toEqual([second]);
    expect((await storage.listPrivateFinalReports(b.cursor, 1)).cursor).toBe(
      "",
    );
  });
});
