import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { AuditLogController } from "./audit-log.controller";
import { PERMISSION_KEY } from "../../common/security/require-permission.decorator";

describe("server audit log", () => {
  it("requires the audit permission instead of exposing records through the browser store", () => {
    expect(
      Reflect.getMetadata(PERMISSION_KEY, AuditLogController.prototype.list),
    ).toEqual({ resource: "audit", action: "read" });
  });
  it("returns persisted audit metadata while excluding private account payloads", async () => {
    const prisma = {
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
      auditLog: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: "log",
              action: "UPDATE_ACCOUNT",
              resource: "account",
              resourceId: "account",
              createdAt: new Date("2026-11-05T03:00:00Z"),
              user: { username: "operator" },
              newValue: { password: "private" },
            },
          ]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const result = await new AuditLogController(prisma as never).list({
      page: 1,
      limit: 100,
    });
    expect(result.data.items).toEqual([
      {
        id: "log",
        at: "2026-11-05T03:00:00.000Z",
        actor: "operator",
        action: "UPDATE_ACCOUNT",
        detail: "account · account",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
