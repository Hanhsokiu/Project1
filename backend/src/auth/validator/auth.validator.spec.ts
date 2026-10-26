import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { AuthValidator } from "./auth.validator";
import { LoginSchema } from "../dto/auth.dto";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import type { UserAccountRepository } from "../repository/user-account.repository";
import type { Identity } from "../mapper/account.mapper";
import { accountDto } from "../mapper/account.mapper";
function fixture() {
  return {
    id: "user",
    username: "sv",
    displayName: "Sinh viên thử",
    email: null,
    phone: null,
    passwordHash: "must-never-return",
    status: "ACTIVE",
    mustChangePassword: false,
    student: null,
    lecturer: null,
    userRoles: [
      {
        role: {
          name: "STUDENT",
          rolePermissions: [
            { permission: { resource: "term", action: "read" } },
          ],
        },
      },
    ],
  };
}
function guard(
  user: ReturnType<typeof fixture>,
  session: { id: string; userId: string; revokedAt: Date | null; expiresAt: Date } = {
    id: "session",
    userId: "user",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60000),
  },
) {
  const req: { headers: { authorization: string }; user?: { roles: string[]; sub: string } } = { headers: { authorization: "Bearer signed-token" } };
  const reflector = { getAllAndOverride: vi.fn(() => false) };
  const jwt = {
    verifyAsync: vi.fn(async () => ({
      sub: "user",
      sid: "session",
      roles: ["ADMIN"],
    })),
  };
  const users = {
    findById: vi.fn(async () => user),
    session: vi.fn(async () => session),
  };
  const instance = new JwtAuthGuard(reflector as unknown as Reflector, jwt as unknown as JwtService, users as unknown as UserAccountRepository);
  const ctx = {
    getHandler: () => function () {},
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  };
  return { instance, ctx: ctx as unknown as ExecutionContext, req };
}
describe("Authentication foundation", () => {
  it("accepts a strong replacement and rejects weak or unchanged passwords", () => {
    expect(() => AuthValidator.password("old", "ValidPass@2026")).not.toThrow();
    expect(() => AuthValidator.password("old", "weak")).toThrow();
    expect(() =>
      AuthValidator.password("ValidPass@2026", "ValidPass@2026"),
    ).toThrow();
  });
  it("requires credential fields and rejects injected account roles", () => {
    expect(
      LoginSchema.safeParse({ username: "giaovu", password: "Demo@2026" })
        .success,
    ).toBe(true);
    expect(LoginSchema.safeParse({ username: "giaovu" }).success).toBe(false);
    expect(
      LoginSchema.safeParse({
        username: "giaovu",
        password: "x",
        roles: ["ADMIN"],
      }).success,
    ).toBe(false);
  });
  it("maps a nullable-email account without passwordHash", () => {
    const value = accountDto(fixture() as unknown as Identity);
    expect(value.email).toBeNull();
    expect(value.roles).toEqual(["STUDENT"]);
    expect(value.permissions).toEqual(["term:read"]);
    expect(JSON.stringify(value)).not.toContain("passwordHash");
    expect(JSON.stringify(value)).not.toContain("must-never-return");
  });
  it("uses current database roles instead of trusting roles inside JWT", async () => {
    const { instance, ctx, req } = guard(fixture());
    await expect(instance.canActivate(ctx)).resolves.toBe(true);
    expect(req.user?.roles).toEqual(["STUDENT"]);
    expect(req.user?.sub).toBe("user");
  });
  it("rejects a locked account and a revoked or foreign session", async () => {
    const locked = guard({ ...fixture(), status: "LOCKED" });
    await expect(locked.instance.canActivate(locked.ctx)).rejects.toThrow();
    const revoked = guard(fixture(), {
      id: "session",
      userId: "user",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    await expect(revoked.instance.canActivate(revoked.ctx)).rejects.toThrow();
    const foreign = guard(fixture(), {
      id: "session",
      userId: "other",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    await expect(foreign.instance.canActivate(foreign.ctx)).rejects.toThrow();
  });
  it("blocks first-password accounts from business endpoints", async () => {
    const value = guard({ ...fixture(), mustChangePassword: true });
    await expect(value.instance.canActivate(value.ctx)).rejects.toMatchObject({
      status: 403,
    });
  });
});
