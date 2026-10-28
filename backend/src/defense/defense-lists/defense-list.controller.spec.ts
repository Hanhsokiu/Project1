import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { PERMISSION_KEY } from "../../common/security/require-permission.decorator";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import type { RbacService } from "../../auth/service/rbac.service";
import type { CurrentUserPayload } from "../../common/security/current-user.decorator";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { CommonModule } from "../../common/common.module";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";
import { PrismaUc18FinalizationReader } from "../../common/uc18-finalization/prisma-uc18-finalization.reader";
import { DefenseListController } from "./defense-list.controller";
import { DefenseListModule } from "./defense-list.module";
import { DefenseListService } from "./defense-list.service";
import { defenseListFixture } from "./defense-list.test-fixtures";

describe("UC18 defense list HTTP contract and wiring", () => {
  it("declares term-scoped routes and distinct UC18 permissions", () => {
    expect(Reflect.getMetadata("path", DefenseListController)).toBe(
      "terms/:termId/defense-list",
    );
    for (const [method, action] of [
      ["get", "read"],
      ["create", "manage"],
      ["open", "manage"],
    ] as const)
      expect(
        Reflect.getMetadata(
          PERMISSION_KEY,
          DefenseListController.prototype[method],
        ),
      ).toEqual({ resource: "defense-list", action });
    expect(
      Reflect.getMetadata("path", DefenseListController.prototype.open),
    ).toBe("open");
    expect(
      Reflect.getMetadata("__httpCode__", DefenseListController.prototype.open),
    ).toBe(200);
  });
  it("uses JWT actor identity and ApiResponse envelopes for every endpoint", async () => {
    const data = { state: "DRAFT", revision: 0 };
    const service = {
      get: vi.fn().mockResolvedValue(data),
      create: vi.fn().mockResolvedValue(data),
      open: vi.fn().mockResolvedValue(data),
    };
    const controller = new DefenseListController(
      service as unknown as DefenseListService,
    );
    const user = { userId: "verified-actor" } as CurrentUserPayload,
      params = { termId: "term" };
    expect(await controller.get(params, user)).toMatchObject({
      success: true,
      data,
    });
    expect(await controller.create(params, {}, user)).toMatchObject({
      success: true,
      data,
    });
    expect(
      await controller.open(params, { expectedRevision: 0 }, user),
    ).toMatchObject({ success: true, data });
    expect(service.get).toHaveBeenCalledWith("verified-actor", "term");
    expect(service.create).toHaveBeenCalledWith("verified-actor", "term");
    expect(service.open).toHaveBeenCalledWith("verified-actor", "term", {
      expectedRevision: 0,
    });
  });
  it("the existing permission guard rejects old defense permission without the new UC18 permission", async () => {
    const rbac = { hasPermission: vi.fn().mockResolvedValue(false) };
    const guard = new PermissionsGuard(
      new Reflector(),
      rbac as unknown as RbacService,
    );
    const context = {
      getHandler: () => DefenseListController.prototype.open,
      getClass: () => DefenseListController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: "manager", roles: ["ADMIN", "FACULTY"] },
        }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(rbac.hasPermission).toHaveBeenCalledWith(
      "manager",
      "defense-list",
      "manage",
    );
    rbac.hasPermission.mockResolvedValue(true);
    expect(await guard.canActivate(context)).toBe(true);
  });
  it("wires the real reader/service/repository without instantiating or connecting a real database", async () => {
    const f = defenseListFixture();
    const module = await Test.createTestingModule({
      imports: [PrismaModule, CommonModule, DefenseListModule],
    })
      .overrideProvider(PrismaService)
      .useValue(f.prisma)
      .overrideProvider(FileStorageService)
      .useValue({})
      .compile();
    try {
      expect(module.get(Uc18FinalizationReader)).toBeInstanceOf(
        PrismaUc18FinalizationReader,
      );
      const controller = module.get(DefenseListController),
        user = { userId: "manager" } as CurrentUserPayload;
      expect(
        await controller.create({ termId: "term" }, {}, user),
      ).toMatchObject({ data: { state: "DRAFT", revision: 0 } });
      f.state.row = f.draft(); // Policy was explicitly configured before opening.
      expect(
        await controller.open(
          { termId: "term" },
          { expectedRevision: 0 },
          user,
        ),
      ).toMatchObject({ data: { state: "OPEN", uc18: { state: "OPEN" } } });
    } finally {
      await module.close();
    }
  });
});
