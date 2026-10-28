import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { NotificationService } from "./notification.service";
import {
  NotificationRepository,
  outboxStatusSelect,
} from "../repository/notification.repository";
import { NotificationController } from "../controller/notification.controller";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { AuditService } from "../../common/audit/audit.service";

function fixture() {
  const actor = {
    id: "actor",
    status: "ACTIVE",
    mustChangePassword: false,
    userRoles: [
      {
        role: {
          name: "FACULTY",
          rolePermissions: [
            { permission: { resource: "assignment", action: "manage" } },
          ],
        },
      },
    ],
  };
  const row = {
    id: "email",
    termId: "term",
    status: "FAILED",
    attempts: 4,
    payload: { students: "private" },
    leaseToken: "private-lease",
  };
  const audits: unknown[] = [];
  const tx = {
    userAccount: { findUnique: vi.fn().mockResolvedValue(actor) },
    academicTermGrant: {
      findMany: vi.fn().mockResolvedValue([
        {
          userId: "actor",
          termId: "term",
          allDepartments: true,
          pr2bGrantDepartmentGrantId: [],
        },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    emailOutbox: {
      findUnique: vi.fn().mockImplementation(async () => ({ ...row })),
      findMany: vi.fn().mockImplementation(async () => [
        Object.fromEntries(
          Object.keys(outboxStatusSelect)
            .filter((k) => k in row)
            .map((k) => [k, row[k as keyof typeof row]]),
        ),
      ]),
      updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
        if (
          where.termId !== row.termId ||
          where.id !== row.id ||
          where.status !== row.status
        )
          return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    auditLog: {
      create: vi.fn().mockImplementation(async ({ data }) => {
        audits.push(data);
        return data;
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (fn: (client: Prisma.TransactionClient) => Promise<unknown>) => {
        const before = { ...row },
          count = audits.length;
        try {
          return await fn(tx as unknown as Prisma.TransactionClient);
        } catch (error) {
          Object.assign(row, before);
          audits.length = count;
          throw error;
        }
      },
    ),
  };
  const repository = new NotificationRepository(
    prisma as unknown as PrismaService,
  );
  const audit = new AuditService(prisma as unknown as PrismaService);
  const service = new NotificationService(
    repository,
    new ProposalReviewValidator(),
    audit,
  );
  return { actor, row, audits, tx, prisma, repository, audit, service };
}

describe("H02 outbox management scope and retry transaction", () => {
  it("reads only status metadata with a matching whole-term grant", async () => {
    const f = fixture();
    const result = await f.service.outbox("actor", "term");
    expect(result).toMatchObject([{ id: "email", status: "FAILED" }]);
    expect(result[0]).not.toHaveProperty("payload");
    expect(result[0]).not.toHaveProperty("leaseToken");
    expect(f.tx.emailOutbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { termId: "term" },
        select: outboxStatusSelect,
      }),
    );
    expect(f.tx.emailOutbox.updateMany).not.toHaveBeenCalled();
    expect(f.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(["FACULTY", "ADMIN"])(
    "does not let %s bypass missing grants",
    async (role) => {
      const f = fixture();
      f.actor.userRoles[0].role.name = role;
      f.tx.academicTermGrant.findMany.mockResolvedValue([]);
      await expect(f.service.outbox("actor", "term")).rejects.toMatchObject({
        status: 403,
      });
      await expect(f.service.retry("actor", "email")).rejects.toMatchObject({
        status: 403,
      });
      expect(f.tx.emailOutbox.findMany).not.toHaveBeenCalled();
      expect(f.tx.emailOutbox.updateMany).not.toHaveBeenCalled();
    },
  );
  it("denies a term or actor mismatch in the grant", async () => {
    const f = fixture();
    for (const grant of [
      {
        userId: "actor",
        termId: "other-term",
        allDepartments: true,
        pr2bGrantDepartmentGrantId: [],
      },
      {
        userId: "other-user",
        termId: "term",
        allDepartments: true,
        pr2bGrantDepartmentGrantId: [],
      },
    ]) {
      f.tx.academicTermGrant.findMany.mockResolvedValue([grant]);
      await expect(f.service.outbox("actor", "term")).rejects.toMatchObject({
        status: 403,
      });
      await expect(f.service.retry("actor", "email")).rejects.toMatchObject({
        status: 403,
      });
    }
    expect(f.tx.emailOutbox.updateMany).not.toHaveBeenCalled();
  });
  it("does not expose a multi-department payload to a department-only grant", async () => {
    const f = fixture();
    f.tx.academicTermGrant.findMany.mockResolvedValue([
      {
        userId: "actor",
        termId: "term",
        allDepartments: false,
        pr2bGrantDepartmentGrantId: [],
      },
    ]);
    await expect(f.service.outbox("actor", "term")).rejects.toMatchObject({
      status: 403,
    });
    await expect(f.service.retry("actor", "email")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("rejects missing permission in the service before reading outbox records", async () => {
    const f = fixture();
    f.actor.userRoles[0].role.rolePermissions = [];
    await expect(f.service.outbox("actor", "term")).rejects.toMatchObject({
      status: 403,
    });
    await expect(f.service.retry("actor", "email")).rejects.toMatchObject({
      status: 403,
    });
    expect(f.tx.emailOutbox.findUnique).not.toHaveBeenCalled();
    expect(f.tx.emailOutbox.findMany).not.toHaveBeenCalled();
  });
  it("rejects inactive and password-change-required actors", async () => {
    const f = fixture();
    f.actor.status = "LOCKED";
    await expect(f.service.retry("actor", "email")).rejects.toMatchObject({
      status: 403,
    });
    f.actor.status = "ACTIVE";
    f.actor.mustChangePassword = true;
    await expect(f.service.outbox("actor", "term")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("derives the term from the server record and audits the retry in the same transaction", async () => {
    const f = fixture();
    expect(await f.service.retry("actor", "email")).toEqual({
      id: "email",
      status: "PENDING",
    });
    expect(f.tx.academicTermGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "actor", termId: "term" } }),
    );
    expect(f.tx.emailOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "email", termId: "term", status: "FAILED" },
      }),
    );
    expect(f.row.attempts).toBe(0);
    expect(f.audits).toMatchObject([
      { userId: "actor", action: "RETRY_EMAIL_OUTBOX", resourceId: "email" },
    ]);
    const locks = f.tx.$queryRaw.mock.calls.map(([query]) => query.join(""));
    expect(locks[0]).toContain("THESIS_TERM");
    expect(locks[1]).toContain("EMAIL_OUTBOX");
  });
  it("rolls back retry when audit fails (unit transaction simulation)", async () => {
    const f = fixture();
    f.tx.auditLog.create.mockRejectedValue(new Error("audit failed"));
    await expect(f.service.retry("actor", "email")).rejects.toThrow(
      "audit failed",
    );
    expect(f.row.status).toBe("FAILED");
    expect(f.row.attempts).toBe(4);
    expect(f.audits).toEqual([]);
  });
  it("does not audit a retry lost to a worker/state change", async () => {
    const f = fixture();
    f.tx.emailOutbox.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.service.retry("actor", "email")).rejects.toMatchObject({
      status: 409,
    });
    expect(f.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it("returns 404 for a missing outbox record without mutation", async () => {
    const f = fixture();
    f.tx.emailOutbox.findUnique.mockResolvedValue(null);
    await expect(f.service.retry("actor", "missing")).rejects.toMatchObject({
      status: 404,
    });
    expect(f.tx.emailOutbox.updateMany).not.toHaveBeenCalled();
  });
  it("forwards the authenticated actor through both controller methods", async () => {
    const f = fixture();
    const outbox = vi.spyOn(f.service, "outbox"),
      retry = vi.spyOn(f.service, "retry");
    const controller = new NotificationController(f.service);
    const req = { user: { sub: "actor", userId: "actor" } };
    await controller.outbox("term", req);
    await controller.retry("email", req);
    expect(outbox).toHaveBeenCalledWith("actor", "term");
    expect(retry).toHaveBeenCalledWith("actor", "email");
    await expect(
      controller.retry("email", { user: { sub: "actor", userId: "spoof" } }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
