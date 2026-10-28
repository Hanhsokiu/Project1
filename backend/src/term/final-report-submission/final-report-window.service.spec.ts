import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinalReportSubmissionWindow } from "@prisma/client";
import { AuditService } from "../../common/audit/audit.service";
import { FinalReportWindowService } from "./final-report-window.service";
import {
  FinalReportWindowRepository,
  WindowTransaction,
} from "./final-report-window.repository";
import { FinalReportWindowValidator } from "./final-report-window.validator";

const input = {
  opensAt: "2026-12-01T00:00:00Z",
  closesAt: "2026-12-20T00:00:00Z",
  locked: false,
  expectedRevision: 0,
};
const tx = { marker: "same transaction" } as unknown as WindowTransaction;
let row: FinalReportSubmissionWindow | null;
let auditEntries: unknown[];
let repository: Record<string, ReturnType<typeof vi.fn>>;
let audit: { log: ReturnType<typeof vi.fn> };
let service: FinalReportWindowService;

beforeEach(() => {
  row = null;
  auditEntries = [];
  let queue = Promise.resolve();
  repository = {
    // Simulate serialized transactions and rollback; real PostgreSQL is not used.
    transaction: vi.fn(
      (operation: (transaction: WindowTransaction) => Promise<unknown>) => {
        const run = queue.then(async () => {
          const before = row ? { ...row } : null,
            beforeAudit = [...auditEntries];
          try {
            return await operation(tx);
          } catch (e) {
            row = before;
            auditEntries = beforeAudit;
            throw e;
          }
        });
        queue = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      },
    ),
    principal: vi.fn(async () => ({
      id: "manager",
      status: "ACTIVE",
      userRoles: [
        {
          role: {
            rolePermissions: [
              { permission: { resource: "term", action: "read" } },
              { permission: { resource: "term", action: "plan" } },
            ],
          },
        },
      ],
    })),
    grant: vi.fn(async () => ({
      userId: "manager",
      termId: "term-1",
      allDepartments: true,
    })),
    lockTerm: vi.fn(async () => undefined),
    term: vi.fn(async () => ({
      id: "term-1",
      startDate: new Date("2026-10-01Z"),
      endDate: new Date("2027-02-01Z"),
      status: "IN_PROGRESS",
      isLocked: false,
    })),
    window: vi.fn(async () => row),
    create: vi.fn(async (termId, values) => {
      row = {
        termId,
        ...values,
        revision: 1,
        createdAt: new Date("2026-10-26Z"),
        updatedAt: new Date("2026-10-26Z"),
      };
      return row;
    }),
    update: vi.fn(async (_termId, revision, values) => {
      if (!row || row.revision !== revision) return { count: 0 };
      row = {
        ...row,
        ...values,
        revision: revision + 1,
        updatedAt: new Date("2026-10-27Z"),
      };
      return { count: 1 };
    }),
  };
  audit = {
    log: vi.fn(async (entry) => {
      auditEntries.push(entry);
    }),
  };
  service = new FinalReportWindowService(
    repository as unknown as FinalReportWindowRepository,
    new FinalReportWindowValidator(),
    audit as unknown as AuditService,
  );
});

describe("FinalReportWindowService", () => {
  it("returns an explicit unconfigured response without creating a window", async () => {
    expect(await service.get("manager", "term-1")).toEqual({
      code: "FINAL_REPORT_SUBMISSION",
      termId: "term-1",
      configured: false,
      revision: 0,
      window: null,
    });
    expect(repository.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it("creates revision one and audits before/after with the same transaction", async () => {
    const result = await service.put("manager", "term-1", input);
    expect(result).toMatchObject({
      configured: true,
      revision: 1,
      window: { opensAt: "2026-12-01T00:00:00.000Z", locked: false },
    });
    expect(repository.lockTerm).toHaveBeenCalledWith("term-1", tx);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "manager",
        resourceId: "term-1",
        action: "CREATE_FINAL_REPORT_SUBMISSION_WINDOW",
        oldValue: expect.objectContaining({ configured: false }),
        newValue: result,
      }),
      tx,
    );
  });
  it("reads configured data without changing revision or creating audit entries", async () => {
    await service.put("manager", "term-1", input);
    audit.log.mockClear();
    expect(await service.get("manager", "term-1")).toMatchObject({
      configured: true,
      revision: 1,
    });
    expect(audit.log).not.toHaveBeenCalled();
  });
  it("extends an existing deadline and increments revision with audit", async () => {
    const original = await service.put("manager", "term-1", input);
    const result = await service.put("manager", "term-1", {
      ...input,
      closesAt: "2027-01-20T00:00:00Z",
      expectedRevision: 1,
    });
    expect(result.revision).toBe(2);
    expect(audit.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "UPDATE_FINAL_REPORT_SUBMISSION_WINDOW",
        oldValue: original,
        newValue: result,
      }),
      tx,
    );
  });
  it("can change a locked window without confusing it with a locked parent term", async () => {
    await service.put("manager", "term-1", { ...input, locked: true });
    expect(
      (
        await service.put("manager", "term-1", {
          ...input,
          expectedRevision: 1,
        })
      ).window?.locked,
    ).toBe(false);
  });
  it("leaves unchanged data at the same revision without a duplicate audit", async () => {
    const first = await service.put("manager", "term-1", input);
    audit.log.mockClear();
    expect(
      await service.put("manager", "term-1", { ...input, expectedRevision: 1 }),
    ).toEqual(first);
    expect(repository.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it("rejects stale revision even for unchanged data", async () => {
    await service.put("manager", "term-1", input);
    await expect(service.put("manager", "term-1", input)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(auditEntries).toHaveLength(1);
  });
  it("rejects an unexpected nonzero revision for first creation", async () => {
    await expect(
      service.put("manager", "term-1", { ...input, expectedRevision: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(row).toBeNull();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it("only one of two concurrent creates with revision zero succeeds", async () => {
    const results = await Promise.allSettled([
      service.put("manager", "term-1", input),
      service.put("manager", "term-1", { ...input, locked: true }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { status: 409 },
    });
    expect(row?.revision).toBe(1);
    expect(auditEntries).toHaveLength(1);
  });
  it("only one of two updates based on the same revision succeeds", async () => {
    await service.put("manager", "term-1", input);
    const results = await Promise.allSettled([
      service.put("manager", "term-1", {
        ...input,
        locked: true,
        expectedRevision: 1,
      }),
      service.put("manager", "term-1", {
        ...input,
        closesAt: "2027-01-01T00:00:00Z",
        expectedRevision: 1,
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { status: 409 },
    });
    expect(row?.revision).toBe(2);
    expect(auditEntries).toHaveLength(2);
  });
  it("rejects a failed compare-and-swap without writing audit", async () => {
    await service.put("manager", "term-1", input);
    audit.log.mockClear();
    repository.update.mockResolvedValue({ count: 0 });
    await expect(
      service.put("manager", "term-1", {
        ...input,
        locked: true,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(row?.revision).toBe(1);
    expect(audit.log).not.toHaveBeenCalled();
  });
  it("rolls back creation when audit fails", async () => {
    audit.log.mockRejectedValue(new Error("audit unavailable"));
    await expect(service.put("manager", "term-1", input)).rejects.toThrow(
      "audit unavailable",
    );
    expect(row).toBeNull();
    expect(auditEntries).toHaveLength(0);
  });
  it("rolls back an update when audit fails", async () => {
    await service.put("manager", "term-1", input);
    const before = { ...row };
    audit.log.mockRejectedValue(new Error("audit unavailable"));
    await expect(
      service.put("manager", "term-1", {
        ...input,
        locked: true,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("audit unavailable");
    expect(row).toEqual(before);
    expect(auditEntries).toHaveLength(1);
  });
  it.each(["get", "put"] as const)(
    "denies %s without a full-term grant, without reading configuration",
    async (method) => {
      repository.grant.mockResolvedValue({
        userId: "manager",
        termId: "term-1",
        allDepartments: false,
      });
      await expect(
        method === "get"
          ? service.get("manager", "term-1")
          : service.put("manager", "term-1", input),
      ).rejects.toMatchObject({ status: 403 });
      expect(repository.window).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    },
  );
  it("denies an out-of-term window before writing or auditing", async () => {
    await expect(
      service.put("manager", "term-1", {
        ...input,
        closesAt: "2027-03-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(repository.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it("returns 404 for a missing term after checking access", async () => {
    repository.term.mockResolvedValue(null);
    await expect(service.get("manager", "term-1")).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.put("manager", "term-1", input)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
  it("allows reading but denies changes when the parent term is locked", async () => {
    repository.term.mockResolvedValue({
      id: "term-1",
      status: "IN_PROGRESS",
      isLocked: true,
    });
    expect((await service.get("manager", "term-1")).configured).toBe(false);
    await expect(service.put("manager", "term-1", input)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
});
