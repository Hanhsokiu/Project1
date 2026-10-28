import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { ExecutionContext } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { CommonModule } from "../../common/common.module";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { PERMISSION_KEY } from "../../common/security/require-permission.decorator";
import type { RbacService } from "../../auth/service/rbac.service";
import type { CurrentUserPayload } from "../../common/security/current-user.decorator";
import { DefenseConfirmationReadController } from "./defense-confirmation-read.controller";
import { DefenseConfirmationReadService } from "./defense-confirmation-read.service";
import { DefenseConfirmationController } from "./defense-confirmation.controller";
import { DefenseConfirmationModule } from "./defense-confirmation.module";
import { readFixture } from "./defense-confirmation-read.test-fixtures";

describe("UC17 GET routes, permission guard and Nest wiring", () => {
  it("declares three GET routes and the explicit read permission", () => {
    expect(Reflect.getMetadata("path", DefenseConfirmationReadController)).toBe(
      "proposals/:proposalId",
    );
    for (const [method, path] of [
      ["context", "defense-confirmation-context"],
      ["current", "defense-confirmation"],
      ["history", "defense-confirmation/history"],
    ] as const) {
      const handler = DefenseConfirmationReadController.prototype[method];
      expect(Reflect.getMetadata("method", handler)).toBe(0);
      expect(Reflect.getMetadata("path", handler)).toBe(path);
      expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toEqual({
        resource: "defense-confirmation",
        action: "read",
      });
    }
  });
  it("forwards JWT identity, proposal and validated history cursor, wrapping ApiResponse", async () => {
    const data = { configured: false };
    const service = {
      context: vi.fn().mockResolvedValue(data),
      current: vi.fn().mockResolvedValue(data),
      history: vi.fn().mockResolvedValue(data),
    };
    const controller = new DefenseConfirmationReadController(
      service as unknown as DefenseConfirmationReadService,
    );
    const params = { proposalId: "proposal" },
      user = { userId: "jwt-user" } as CurrentUserPayload;
    expect(await controller.context(params, user)).toMatchObject({
      success: true,
      data,
    });
    expect(await controller.current(params, user)).toMatchObject({
      success: true,
      data,
    });
    expect(
      await controller.history(params, { limit: 20, afterRevision: 2 }, user),
    ).toMatchObject({ success: true, data });
    expect(service.context).toHaveBeenCalledWith("jwt-user", "proposal");
    expect(service.current).toHaveBeenCalledWith("jwt-user", "proposal");
    expect(service.history).toHaveBeenCalledWith("jwt-user", "proposal", {
      limit: 20,
      afterRevision: 2,
    });
  });
  it.each(["context", "current", "history"] as const)(
    "existing RBAC guard enforces read permission for %s",
    async (method) => {
      const rbac = { hasPermission: vi.fn().mockResolvedValue(false) };
      const guard = new PermissionsGuard(
        new Reflector(),
        rbac as unknown as RbacService,
      );
      const context = {
        getHandler: () => DefenseConfirmationReadController.prototype[method],
        getClass: () => DefenseConfirmationReadController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: "actor", roles: ["ADMIN", "FACULTY", "LECTURER"] },
          }),
        }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(context)).rejects.toThrow();
      expect(rbac.hasPermission).toHaveBeenCalledWith(
        "actor",
        "defense-confirmation",
        "read",
      );
    },
  );
  it("GET context expectations pass directly to the existing PUT through real Nest providers", async () => {
    const f = readFixture();
    const module = await Test.createTestingModule({
      imports: [PrismaModule, CommonModule, DefenseConfirmationModule],
    })
      .overrideProvider(PrismaService)
      .useValue(f.prisma)
      .overrideProvider(FileStorageService)
      .useValue(f.storage)
      .compile();
    try {
      const get = module.get(DefenseConfirmationReadController),
        put = module.get(DefenseConfirmationController);
      const params = { proposalId: "proposal" },
        user = { userId: "advisor-user" } as CurrentUserPayload;
      const response = await get.context(params, user),
        c = response.data;
      expect(c.expectedRevision).toBe(0);
      const result = await put.put(
        params,
        {
          status: "CONFIRMED",
          expectedRevision: c.expectedRevision!,
          expectedContext: c.expectedContext!,
        },
        user,
      );
      expect(result.data).toMatchObject({
        changed: true,
        decision: { revision: 1 },
      });
      expect((await get.current(params, user)).data.decision.status).toBe(
        "CONFIRMED",
      );
      expect(
        (await get.history(params, { limit: 50 }, user)).data.items,
      ).toHaveLength(1);
      expect(f.state.audits).toHaveLength(1);
    } finally {
      await module.close();
    }
  });
});
