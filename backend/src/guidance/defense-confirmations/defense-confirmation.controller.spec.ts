import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { CommonModule } from "../../common/common.module";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { PERMISSION_KEY } from "../../common/security/require-permission.decorator";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import type { RbacService } from "../../auth/service/rbac.service";
import type { CurrentUserPayload } from "../../common/security/current-user.decorator";
import { DefenseConfirmationController } from "./defense-confirmation.controller";
import { DefenseConfirmationCommandService } from "./defense-confirmation-command.service";
import { DefenseConfirmationModule } from "./defense-confirmation.module";
import { commandFixture } from "./defense-confirmation-command.test-fixtures";

describe("UC17 decision PUT controller", () => {
  it("declares only PUT and explicit defense-confirmation:decide permission", () => {
    expect(Reflect.getMetadata("path", DefenseConfirmationController)).toBe(
      "proposals/:proposalId/defense-confirmation",
    );
    expect(
      Reflect.getMetadata(
        PERMISSION_KEY,
        DefenseConfirmationController.prototype.put,
      ),
    ).toEqual({ resource: "defense-confirmation", action: "decide" });
    expect(
      Reflect.getMetadata(
        "method",
        DefenseConfirmationController.prototype.put,
      ),
    ).toBe(2);
  });
  it("forwards only the JWT actor and validated request, returning ApiResponse", async () => {
    const f = commandFixture(),
      service = { put: vi.fn().mockResolvedValue({ changed: true }) };
    const controller = new DefenseConfirmationController(
      service as unknown as DefenseConfirmationCommandService,
    );
    const input = f.input();
    expect(
      await controller.put({ proposalId: "proposal" }, input, {
        userId: "jwt-actor",
      } as CurrentUserPayload),
    ).toMatchObject({ success: true, data: { changed: true } });
    expect(service.put).toHaveBeenCalledWith("jwt-actor", "proposal", input);
  });
  it("the existing permission guard denies LECTURER without the new permission", async () => {
    const rbac = { hasPermission: vi.fn().mockResolvedValue(false) };
    const guard = new PermissionsGuard(
      new Reflector(),
      rbac as unknown as RbacService,
    );
    const context = {
      getClass: () => DefenseConfirmationController,
      getHandler: () => DefenseConfirmationController.prototype.put,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: "lecturer", roles: ["LECTURER"] },
        }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(rbac.hasPermission).toHaveBeenCalledWith(
      "lecturer",
      "defense-confirmation",
      "decide",
    );
  });
  it("wires controller, real context/reader and command with a mocked database only", async () => {
    const f = commandFixture();
    const module = await Test.createTestingModule({
      imports: [PrismaModule, CommonModule, DefenseConfirmationModule],
    })
      .overrideProvider(PrismaService)
      .useValue(f.prisma)
      .overrideProvider(FileStorageService)
      .useValue(f.storage)
      .compile();
    try {
      const controller = module.get(DefenseConfirmationController);
      const result = await controller.put(
        { proposalId: "proposal" },
        f.input(),
        { userId: "advisor-user" } as CurrentUserPayload,
      );
      expect(result).toMatchObject({
        success: true,
        data: { changed: true, decision: { status: "CONFIRMED", revision: 1 } },
      });
      expect(f.state.history).toHaveLength(1);
      expect(f.state.audits).toHaveLength(1);
      expect(f.prisma.$transaction).toHaveBeenCalledOnce();
    } finally {
      await module.close();
    }
  });
});
