import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import type { FileAsset, FinalReport } from "@prisma/client";
import { FinalReportService } from "./final-report.service";
import {
  FinalReportRepository,
  ReportTransaction,
  type ReportPrincipal,
  type ReportProposal,
} from "./final-report.repository";
import { FinalReportValidator } from "./final-report.validator";
import {
  SubmissionValidator,
  digest,
} from "../submissions/submission.validator";
import { AuditService } from "../../common/audit/audit.service";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { reportError } from "./final-report.dto";

const pdf = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<</Type /Catalog>>\nendobj\nstartxref\n0\n%%EOF\n",
);
const upload = (bytes = pdf) =>
  ({
    originalname: "Đồ án.pdf",
    mimetype: "application/pdf",
    size: bytes.length,
    buffer: bytes,
  }) as Express.Multer.File;
const tx = { marker: "atomic transaction" } as unknown as ReportTransaction;
let repo: Record<string, ReturnType<typeof vi.fn>>;
let storage: Record<string, ReturnType<typeof vi.fn>>;
let audit: { log: ReturnType<typeof vi.fn> };
let service: FinalReportService;
let current: FinalReport | null;
let assets: Map<string, FileAsset>;
let bytesByKey: Map<string, Buffer>;
let entries: unknown[];
let at: Date;
let principal: NonNullable<ReportPrincipal>;
let proposal: ReportProposal;

beforeEach(() => {
  current = null;
  assets = new Map();
  bytesByKey = new Map();
  entries = [];
  at = new Date("2026-11-15T00:00:00Z");
  principal = {
    id: "user",
    status: "ACTIVE",
    mustChangePassword: false,
    student: { id: "student", isActive: true },
    userRoles: [
      {
        role: {
          name: "STUDENT",
          rolePermissions: ["read", "create", "download"].map((action) => ({
            permission: { resource: "submission", action },
          })),
        },
      },
    ],
  };
  proposal = {
    id: "proposal",
    studentId: "student",
    termId: "term",
    topic: { termId: "term" },
    term: {
      id: "term",
      status: "IN_PROGRESS",
      isLocked: false,
      startDate: new Date("2026-01-01Z"),
      endDate: new Date("2027-01-01Z"),
      finalReportSubmissionWindow: {
        termId: "term",
        createdAt: at,
        updatedAt: at,
        opensAt: new Date("2026-11-01Z"),
        closesAt: new Date("2026-12-01Z"),
        isLocked: false,
        revision: 1,
      },
    },
  };
  let queue = Promise.resolve();
  repo = {
    // Unit simulation of serial transactions and DB rollback, not a PostgreSQL integration test.
    transaction: vi.fn((operation) => {
      const result = queue.then(async () => {
        const old = current ? { ...current } : null,
          oldAssets = new Map(assets),
          oldEntries = [...entries];
        try {
          return await operation(tx);
        } catch (error) {
          current = old;
          assets = oldAssets;
          entries = oldEntries;
          throw error;
        }
      });
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    }),
    principal: vi.fn(async () => principal),
    proposal: vi.fn(async () => proposal),
    roster: vi.fn(async () => ({ id: "roster" })),
    now: vi.fn(async () => at),
    lock: vi.fn(async () => undefined),
    lockKey: vi.fn(async () => undefined),
    report: vi.fn(async () =>
      current
        ? {
            ...current,
            fileAsset: current.fileAssetId
              ? (assets.get(current.fileAssetId) ?? null)
              : null,
          }
        : null,
    ),
    addAsset: vi.fn(async (data) => {
      const asset = { createdAt: at, updatedAt: at, ...data } as FileAsset;
      assets.set(asset.id, asset);
      return asset;
    }),
    swap: vi.fn(
      async (proposalId, _termId, id, fileAssetId, revision, exists) => {
        new FinalReportValidator().open(proposal, at);
        if ((current?.revision ?? 0) !== revision || !!current !== exists)
          reportError(409, "REVISION_CONFLICT", "stale");
        current = {
          id,
          proposalId,
          filePath: current?.filePath ?? null,
          fileAssetId,
          revision: revision + 1,
          submittedAt: at,
          createdAt: current?.createdAt ?? at,
        };
      },
    ),
    assetForCleanup: vi.fn(async (key) => {
      const asset = [...assets.values()].find((a) => a.storageKey === key);
      return asset
        ? {
            ...asset,
            finalReport:
              current?.fileAssetId === asset.id ? { id: current.id } : null,
            guidanceUpload: null,
            pr2bDossierPdfContent: null,
            _count: {
              pr2bDossierFinalizationPdfAssetId: 0,
              pr2bDossierReceiptScanAssetId: 0,
              pr2bSubmissionAssetFileId: 0,
              pr2bEvaluationEvidenceFileId: 0,
            },
          }
        : null;
    }),
    deleteAsset: vi.fn(async (id) => assets.delete(id)),
    cleanupCandidates: vi.fn(async () => []),
  };
  storage = {
    savePrivateFinalReport: vi.fn(async (key, bytes) => {
      bytesByKey.set(key, Buffer.from(bytes));
    }),
    readPrivateFinalReport: vi.fn(async (key) => {
      const bytes = bytesByKey.get(key);
      if (!bytes) throw new Error("missing");
      return bytes;
    }),
    deletePrivateFinalReport: vi.fn(async (key) => bytesByKey.delete(key)),
    listPrivateFinalReports: vi.fn(async () => ({
      entries: [...bytesByKey.keys()].map((key) => ({
        key,
        modifiedAt: new Date(Date.now() - 48 * 3600000),
      })),
      cursor: "",
    })),
  };
  audit = {
    log: vi.fn(async (entry, transaction) => {
      expect(transaction).toBe(tx);
      entries.push(entry);
    }),
  };
  service = new FinalReportService(
    repo as unknown as FinalReportRepository,
    new FinalReportValidator(),
    new SubmissionValidator(),
    storage as unknown as FileStorageService,
    audit as unknown as AuditService,
    new ConfigService({ FINAL_REPORT_MAX_FILE_BYTES: 1024 * 1024 }),
  );
});

describe("Final report upload, replacement and safe reads", () => {
  it("rejects a missing or invalid PDF before persisting bytes or metadata", async () => {
    await expect(
      service.put(
        "user",
        "proposal",
        0,
        undefined as unknown as Express.Multer.File,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.put("user", "proposal", 0, upload(Buffer.from("not pdf"))),
    ).rejects.toMatchObject({ status: 400 });
    expect(storage.savePrivateFinalReport).not.toHaveBeenCalled();
    expect(repo.addAsset).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it("does not block download when the configured upload cap is later reduced", async () => {
    await service.put("user", "proposal", 0, upload());
    const constrained = new FinalReportService(
      repo as unknown as FinalReportRepository,
      new FinalReportValidator(),
      new SubmissionValidator(),
      storage as unknown as FileStorageService,
      audit as unknown as AuditService,
      new ConfigService({ FINAL_REPORT_MAX_FILE_BYTES: 1 }),
    );
    await expect(
      constrained.put("user", "proposal", 1, upload()),
    ).rejects.toMatchObject({ status: 413 });
    expect(await constrained.download("user", "proposal")).toEqual({
      bytes: pdf,
      name: "Đồ án.pdf",
    });
  });
  it("returns explicit context and does not create a default configuration/report", async () => {
    expect(await service.context("user", "proposal")).toMatchObject({
      canSubmit: true,
      expectedRevision: 0,
      temporarySizeLimit: true,
      report: { state: "NOT_SUBMITTED", file: null },
    });
    expect(await service.detail("user", "proposal")).toMatchObject({
      state: "NOT_SUBMITTED",
      revision: 0,
    });
    expect(repo.addAsset).not.toHaveBeenCalled();
    expect(repo.swap).not.toHaveBeenCalled();
  });
  it("reports missing window without using FINAL or creating defaults", async () => {
    proposal.term.finalReportSubmissionWindow = null;
    expect(await service.context("user", "proposal")).toMatchObject({
      canSubmit: false,
      window: null,
      readiness: ["FINAL_REPORT_WINDOW_NOT_CONFIGURED"],
    });
    await expect(
      service.put("user", "proposal", 0, upload()),
    ).rejects.toMatchObject({ status: 409 });
    expect(storage.savePrivateFinalReport).not.toHaveBeenCalled();
  });
  it("submits a private PDF with checksum, audit and no exposed path/key", async () => {
    const result = await service.put("user", "proposal", 0, upload());
    expect(result).toMatchObject({
      state: "SUBMITTED",
      revision: 1,
      file: { originalName: "Đồ án.pdf", checksum: digest(pdf) },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /storageKey|filePath|final-reports\//,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user",
        action: "SUBMIT_FINAL_REPORT",
        newValue: result,
      }),
      tx,
    );
    expect(repo.lock).toHaveBeenCalledWith("term", "proposal", tx);
    expect(storage.savePrivateFinalReport.mock.calls[0][0]).toMatch(
      /^final-reports\/[0-9a-f-]{36}$/,
    );
  });
  it("replaces the current PDF and only then deletes the old bytes and metadata", async () => {
    await service.put("user", "proposal", 0, upload());
    const old = [...assets.values()][0],
      next = Buffer.from(pdf.toString().replace("1 0 obj", "2 0 obj"));
    storage.deletePrivateFinalReport.mockImplementation(async (key) => {
      if (key === old.storageKey) expect(current?.fileAssetId).not.toBe(old.id);
      return bytesByKey.delete(key);
    });
    const result = await service.put("user", "proposal", 1, upload(next));
    expect(result.revision).toBe(2);
    expect(bytesByKey.has(old.storageKey)).toBe(false);
    expect(assets.has(old.id)).toBe(false);
    expect(assets.size).toBe(1);
    expect(bytesByKey.size).toBe(1);
    expect(entries[1]).toMatchObject({ action: "REPLACE_FINAL_REPORT" });
    // Repository exposes no UC17, eligibility or score mutation.
    expect(Object.keys(repo)).not.toContain("defenseConfirmation");
  });
  it("preserves the previous file if filesystem write fails", async () => {
    await service.put("user", "proposal", 0, upload());
    const before = { ...current },
      keys = [...bytesByKey.keys()];
    storage.savePrivateFinalReport.mockRejectedValue(new Error("disk full"));
    await expect(service.put("user", "proposal", 1, upload())).rejects.toThrow(
      "disk full",
    );
    expect(current).toEqual(before);
    expect([...bytesByKey.keys()]).toEqual(keys);
    expect(entries).toHaveLength(1);
  });
  it("rolls back DB changes on audit failure and safely removes the new orphan", async () => {
    await service.put("user", "proposal", 0, upload());
    const before = { ...current },
      keys = [...bytesByKey.keys()];
    audit.log.mockRejectedValue(new Error("audit failed"));
    await expect(service.put("user", "proposal", 1, upload())).rejects.toThrow(
      "audit failed",
    );
    expect(current).toEqual(before);
    expect([...bytesByKey.keys()]).toEqual(keys);
    expect(assets.size).toBe(1);
  });
  it("rejects a stale revision before writing bytes", async () => {
    await service.put("user", "proposal", 0, upload());
    storage.savePrivateFinalReport.mockClear();
    await expect(
      service.put("user", "proposal", 0, upload()),
    ).rejects.toMatchObject({ status: 409 });
    expect(storage.savePrivateFinalReport).not.toHaveBeenCalled();
    expect(current?.revision).toBe(1);
  });
  it.each([0, 1])(
    "prevents silent concurrent overwrite for initial revision %s",
    async (revision) => {
      if (revision === 1) await service.put("user", "proposal", 0, upload());
      const results = await Promise.allSettled([
        service.put("user", "proposal", revision, upload()),
        service.put("user", "proposal", revision, upload()),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({
        reason: { status: 409 },
      });
      expect(current?.revision).toBe(revision + 1);
      expect(bytesByKey.size).toBe(1);
    },
  );
  it("rejects expiry reached during file write and retains the old current file", async () => {
    await service.put("user", "proposal", 0, upload());
    const before = { ...current };
    storage.savePrivateFinalReport.mockImplementation(async (key, bytes) => {
      bytesByKey.set(key, bytes);
      at = new Date("2026-12-01Z");
    });
    await expect(
      service.put("user", "proposal", 1, upload()),
    ).rejects.toMatchObject({ status: 409 });
    expect(current).toEqual(before);
    expect(bytesByKey.size).toBe(1);
  });
  it("also handles deadline rejection at the final DB write", async () => {
    await service.put("user", "proposal", 0, upload());
    const before = { ...current };
    repo.swap.mockImplementation(async () =>
      reportError(409, "FINAL_REPORT_WRITE_CONFLICT", "closed at final write"),
    );
    await expect(
      service.put("user", "proposal", 1, upload()),
    ).rejects.toMatchObject({ status: 409 });
    expect(current).toEqual(before);
    expect(bytesByKey.size).toBe(1);
  });
  it("rechecks account and permissions after file IO", async () => {
    await service.put("user", "proposal", 0, upload());
    const before = { ...current };
    storage.savePrivateFinalReport.mockImplementation(async (key, bytes) => {
      bytesByKey.set(key, bytes);
      principal = { ...principal, status: "LOCKED" };
    });
    await expect(
      service.put("user", "proposal", 1, upload()),
    ).rejects.toMatchObject({ status: 403 });
    expect(current).toEqual(before);
    expect(bytesByKey.size).toBe(1);
  });
  it("denies access to another student's proposal for all four operations", async () => {
    proposal.studentId = "other-student";
    for (const operation of [
      () => service.context("user", "proposal"),
      () => service.detail("user", "proposal"),
      () => service.put("user", "proposal", 0, upload()),
      () => service.download("user", "proposal"),
    ])
      await expect(operation()).rejects.toMatchObject({ status: 404 });
    expect(storage.savePrivateFinalReport).not.toHaveBeenCalled();
    expect(storage.readPrivateFinalReport).not.toHaveBeenCalled();
  });
  it("denies non-roster students and principals without submission permission", async () => {
    repo.roster.mockResolvedValue(null);
    await expect(service.preflight("user", "proposal")).rejects.toMatchObject({
      status: 404,
    });
    principal.userRoles = [];
    await expect(service.detail("user", "proposal")).rejects.toMatchObject({
      status: 403,
    });
  });
  it.each(["expired", "locked"])(
    "keeps download available when the upload window is %s",
    async (state) => {
      await service.put("user", "proposal", 0, upload());
      if (state === "expired") at = new Date("2026-12-01Z");
      else proposal.term.finalReportSubmissionWindow!.isLocked = true;
      await expect(service.preflight("user", "proposal")).rejects.toMatchObject(
        { status: 409 },
      );
      expect(await service.download("user", "proposal")).toEqual({
        bytes: pdf,
        name: "Đồ án.pdf",
      });
      expect((await service.context("user", "proposal")).canSubmit).toBe(false);
    },
  );
  it("detects missing file and checksum corruption on download", async () => {
    await service.put("user", "proposal", 0, upload());
    const key = [...bytesByKey.keys()][0];
    bytesByKey.set(key, Buffer.alloc(pdf.length, 1));
    await expect(service.download("user", "proposal")).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "FINAL_REPORT_FILE_CORRUPTED" } },
    });
    bytesByKey.delete(key);
    await expect(service.download("user", "proposal")).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "FINAL_REPORT_FILE_UNAVAILABLE" } },
    });
  });
  it("does not use legacy filePath as a download path or expose it", async () => {
    current = {
      id: "legacy",
      proposalId: "proposal",
      filePath: "C:/legacy/private.pdf",
      fileAssetId: null,
      revision: 0,
      submittedAt: at,
      createdAt: at,
    };
    const result = await service.detail("user", "proposal");
    expect(result.state).toBe("LEGACY_REQUIRES_RECONCILIATION");
    expect(JSON.stringify(result)).not.toContain("C:/legacy");
    await expect(service.download("user", "proposal")).rejects.toMatchObject({
      status: 404,
    });
    await service.put("user", "proposal", 0, upload());
    expect(current?.filePath).toBe("C:/legacy/private.pdf");
    expect(entries[0]).toMatchObject({ action: "REPLACE_FINAL_REPORT" });
  });
});

describe("Safe orphan reconciliation", () => {
  it("never unlinks bytes if deleting metadata is refused by a foreign-key reference", async () => {
    const key = "final-reports/11111111-1111-4111-8111-111111111111";
    bytesByKey.set(key, pdf);
    assets.set("orphan", {
      id: "orphan",
      storageKey: key,
      kind: "REPORT",
    } as FileAsset);
    repo.deleteAsset.mockRejectedValue(
      new Error("foreign key prevents deletion"),
    );
    await expect(service.cleanupKey(key)).rejects.toThrow(
      "foreign key prevents deletion",
    );
    expect(bytesByKey.has(key)).toBe(true);
    expect(assets.has("orphan")).toBe(true);
    expect(storage.deletePrivateFinalReport).not.toHaveBeenCalled();
  });
  it("reads committed references only after acquiring the cleanup lock", async () => {
    const key = "final-reports/11111111-1111-4111-8111-111111111111";
    bytesByKey.set(key, pdf);
    let acquired = false;
    repo.lockKey.mockImplementation(async () => {
      acquired = true;
    });
    repo.assetForCleanup.mockImplementation(async () => {
      expect(acquired).toBe(true);
      // Simulate a writer that committed while cleanup was waiting for the key.
      return { kind: "REPORT", finalReport: { id: "just-committed" } };
    });
    await service.cleanupKey(key);
    expect(bytesByKey.has(key)).toBe(true);
    expect(storage.deletePrivateFinalReport).not.toHaveBeenCalled();
  });
  it("never deletes the current asset, including after an ambiguous commit acknowledgement", async () => {
    await service.put("user", "proposal", 0, upload());
    const key = [...bytesByKey.keys()][0];
    await service.cleanupKey(key);
    await service.cleanup();
    expect(bytesByKey.has(key)).toBe(true);
    expect(assets.size).toBe(1);
    expect(storage.deletePrivateFinalReport).not.toHaveBeenCalled();
    expect(repo.lockKey).toHaveBeenCalledWith(key, tx);
  });
  it("removes old unreferenced files without metadata but leaves recent staging untouched", async () => {
    const old = "final-reports/11111111-1111-4111-8111-111111111111",
      recent = "final-reports/22222222-2222-4222-8222-222222222222";
    bytesByKey.set(old, pdf);
    bytesByKey.set(recent, pdf);
    storage.listPrivateFinalReports.mockResolvedValue({
      entries: [
        { key: old, modifiedAt: new Date(0) },
        { key: recent, modifiedAt: new Date() },
      ],
      cursor: "",
    });
    await service.cleanup();
    expect(bytesByKey.has(old)).toBe(false);
    expect(bytesByKey.has(recent)).toBe(true);
  });
  it("defers failed deletion after a successful replacement without failing the upload", async () => {
    await service.put("user", "proposal", 0, upload());
    const old = [...bytesByKey.keys()][0];
    storage.deletePrivateFinalReport.mockRejectedValueOnce(
      new Error("temporarily busy"),
    );
    expect((await service.put("user", "proposal", 1, upload())).revision).toBe(
      2,
    );
    expect(bytesByKey.has(old)).toBe(true);
    await service.cleanup();
    expect(bytesByKey.has(old)).toBe(false);
    expect(bytesByKey.size).toBe(1);
  });
  it("refuses foreign namespaces and assets linked by another module", async () => {
    await service.cleanupKey("guidance/11111111-1111-4111-8111-111111111111");
    expect(repo.lockKey).not.toHaveBeenCalled();
    repo.assetForCleanup.mockResolvedValue({
      kind: "REPORT",
      finalReport: null,
      guidanceUpload: { id: "protected" },
    });
    await service.cleanupKey(
      "final-reports/11111111-1111-4111-8111-111111111111",
    );
    expect(storage.deletePrivateFinalReport).not.toHaveBeenCalled();
  });
  it("retries unreferenced metadata even when bytes are already absent", async () => {
    const key = "final-reports/11111111-1111-4111-8111-111111111111";
    assets.set("orphan", {
      id: "orphan",
      storageKey: key,
      kind: "REPORT",
    } as FileAsset);
    repo.cleanupCandidates.mockResolvedValue([{ storageKey: key }]);
    await service.cleanup();
    expect(assets.has("orphan")).toBe(false);
  });
});
