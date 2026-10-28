import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { CommonModule } from "../../common/common.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { PERMISSION_KEY } from "../../common/security/require-permission.decorator";
import type { RbacService } from "../../auth/service/rbac.service";
import type { CurrentUserPayload } from "../../common/security/current-user.decorator";
import { DefenseConfirmationModule } from "./defense-confirmation.module";
import { DefenseConfirmationReportController } from "./defense-confirmation-report.controller";
import { DefenseConfirmationReadController } from "./defense-confirmation-read.controller";
import { DefenseConfirmationReportService } from "./defense-confirmation-report.service";
import { reportFixture } from "./defense-confirmation-report.test-fixtures";
import { bytes, key } from "./defense-confirmation.test-fixtures";
import {
  reportIdentity,
  type ReportRequest,
} from "../final-reports/final-report.controller";

const user = { userId: "advisor-user" } as CurrentUserPayload;
const response = () => {
  const raw = { set: vi.fn(), send: vi.fn() };
  return { raw, res: raw as unknown as Response };
};

describe("UC17 advisor PDF route and safe response", () => {
  it("registers the dedicated GET route and existing UC17 read permission", () => {
    const controller = DefenseConfirmationReportController,
      handler = controller.prototype.download;
    expect(Reflect.getMetadata("path", controller)).toBe(
      "proposals/:proposalId/defense-confirmation/report",
    );
    expect(Reflect.getMetadata("path", handler)).toBe("download");
    expect(Reflect.getMetadata("method", handler)).toBe(0);
    expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toEqual({
      resource: "defense-confirmation",
      action: "read",
    });
  });

  it("existing RBAC guard denies the route without permission even for lecturer/admin roles", async () => {
    const rbac = { hasPermission: vi.fn().mockResolvedValue(false) };
    const guard = new PermissionsGuard(
      new Reflector(),
      rbac as unknown as RbacService,
    );
    const context = {
      getHandler: () => DefenseConfirmationReportController.prototype.download,
      getClass: () => DefenseConfirmationReportController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: "advisor-user", roles: ["ADMIN", "LECTURER"] },
        }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(rbac.hasPermission).toHaveBeenCalledWith(
      "advisor-user",
      "defense-confirmation",
      "read",
    );
  });

  it("real Nest wiring accepts identity directly from GET context and serves encoded attachment headers", async () => {
    const f = reportFixture();
    f.state.report!.fileAsset!.originalName = "Đồ án (bản cuối)' 2026.pdf";
    const module = await Test.createTestingModule({
      imports: [PrismaModule, CommonModule, DefenseConfirmationModule],
    })
      .overrideProvider(PrismaService)
      .useValue(f.prisma)
      .overrideProvider(FileStorageService)
      .useValue(f.storage)
      .compile();
    try {
      const read = module.get(DefenseConfirmationReadController),
        download = module.get(DefenseConfirmationReportController),
        { raw, res } = response();
      const context = await read.context({ proposalId: "proposal" }, user);
      await download.download(
        { proposalId: "proposal" },
        context.data.expectedContext!.pdf!,
        user,
        res,
      );
      expect(raw.send).toHaveBeenCalledTimes(1);
      expect(raw.send).toHaveBeenCalledWith(bytes);
      const headers = raw.set.mock.calls[0][0] as Record<string, string>;
      expect(headers).toMatchObject({
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      });
      expect(headers["Content-Disposition"]).toBe(
        "attachment; filename=\"final-report.pdf\"; filename*=UTF-8''%C4%90%E1%BB%93%20%C3%A1n%20%28b%E1%BA%A3n%20cu%E1%BB%91i%29%27%202026.pdf",
      );
      expect(JSON.stringify(headers)).not.toMatch(/storageKey|filePath/);
      expect(JSON.stringify(headers)).not.toContain(key);
      expect(f.state.decision).toBeNull();
      expect(f.state.audits).toEqual([]);
    } finally {
      await module.close();
    }
  });

  it("sends no headers or bytes if permission, identity or file verification fails", async () => {
    const service = {
      download: vi.fn().mockRejectedValue(new Error("denied")),
    };
    const controller = new DefenseConfirmationReportController(
      service as unknown as DefenseConfirmationReportService,
    );
    const f = reportFixture(),
      { raw, res } = response();
    await expect(
      controller.download({ proposalId: "proposal" }, f.identity, user, res),
    ).rejects.toThrow("denied");
    expect(service.download).toHaveBeenCalledWith(
      "advisor-user",
      "proposal",
      f.identity,
    );
    expect(raw.set).not.toHaveBeenCalled();
    expect(raw.send).not.toHaveBeenCalled();
  });

  it("preserves the student endpoint's ownership policy instead of broadening it for lecturers", () => {
    const req = {
      user: {
        userId: "advisor-user",
        sub: "advisor-user",
        roles: ["LECTURER"],
        permissions: ["submission:download", "defense-confirmation:read"],
        locked: false,
        mustChangePassword: false,
      },
    } as unknown as ReportRequest;
    expect(() => reportIdentity(req, "download")).toThrow();
  });
});
