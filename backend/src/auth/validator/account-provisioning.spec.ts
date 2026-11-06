import { describe, expect, it, vi } from "vitest";
import { AccountProvisioningValidator } from "./account-provisioning.validator";
import { AccountService } from "../service/account.service";

describe("only Admin may provision accounts", () => {
  it("accepts the Admin role", () => {
    expect(() => AccountProvisioningValidator.admin(["ADMIN"])).not.toThrow();
  });
  it.each([[], ["FACULTY"], ["LECTURER"], ["STUDENT"], ["COMMITTEE"]])(
    "rejects roles %j",
    (...roles) => {
      expect(() => AccountProvisioningValidator.admin(roles)).toThrow(
        "Chỉ Admin",
      );
    },
  );
  it("checks the actor's current roles before attempting account creation", async () => {
    const users = {
      findById: vi
        .fn()
        .mockResolvedValue({ userRoles: [{ role: { name: "FACULTY" } }] }),
      findByUsername: vi.fn(),
      createAccount: vi.fn(),
    };
    await expect(
      new AccountService(users as never).create(
        { username: "newuser", name: "Tài khoản mới", roles: ["STUDENT"] },
        "faculty",
      ),
    ).rejects.toThrow("Chỉ Admin");
    expect(users.findByUsername).not.toHaveBeenCalled();
    expect(users.createAccount).not.toHaveBeenCalled();
  });
  it("allows Admin to create an account through account management", async () => {
    const users = {
      findById: vi
        .fn()
        .mockResolvedValue({ userRoles: [{ role: { name: "ADMIN" } }] }),
      findByUsername: vi.fn().mockResolvedValue(null),
      createAccount: vi
        .fn()
        .mockResolvedValue({
          id: "created",
          username: "newuser",
          status: "ACTIVE",
          userRoles: [],
          mustChangePassword: true,
        }),
    };
    await expect(
      new AccountService(users as never).create(
        { username: "newuser", name: "Tài khoản mới", roles: ["FACULTY"] },
        "admin",
      ),
    ).resolves.toMatchObject({ id: "created" });
    expect(users.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ username: "newuser", actorId: "admin" }),
    );
  });
});
