import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountService } from "./account.service";
import { UserAccountRepository } from "../repository/user-account.repository";
import { sealAccountPassword } from "../security/password-vault";

afterEach(() => vi.unstubAllEnvs());

function setup(roles: string[] = ["ADMIN"], ciphertext: string | null = null) {
  const repository = {
    findById: vi.fn(async (id: string) =>
      id === "actor"
        ? { id, userRoles: roles.map((name) => ({ role: { name } })) }
        : { id, passwordCiphertext: ciphertext },
    ),
    recordPasswordView: vi.fn().mockResolvedValue({}),
  };
  return {
    repository,
    service: new AccountService(repository as unknown as UserAccountRepository),
  };
}

describe("admin-only password viewing", () => {
  it("returns the decrypted password only to an admin after an audit event succeeds", async () => {
    vi.stubEnv("ACCOUNT_PASSWORD_ENCRYPTION_KEY", "ab".repeat(32));
    const { repository, service } = setup(
      ["ADMIN"],
      sealAccountPassword("Changed@2026"),
    );
    await expect(service.revealPassword("target", "actor")).resolves.toEqual({
      available: true,
      password: "Changed@2026",
      message: "",
    });
    expect(repository.recordPasswordView).toHaveBeenCalledWith(
      "target",
      "actor",
      true,
    );
    expect(
      JSON.stringify(repository.recordPasswordView.mock.calls),
    ).not.toContain("Changed@2026");
  });
  it.each([[], ["FACULTY"], ["LECTURER"], ["STUDENT"], ["COMMITTEE"]])(
    "rejects non-admin roles before reading the target credential: %j",
    async (...roles) => {
      const { repository, service } = setup(roles as string[]);
      await expect(service.revealPassword("target", "actor")).rejects.toThrow(
        "Chỉ quản trị viên",
      );
      expect(repository.findById).toHaveBeenCalledTimes(1);
      expect(repository.recordPasswordView).not.toHaveBeenCalled();
    },
  );
  it("reports legacy hashes as unavailable without changing the target account", async () => {
    const { repository, service } = setup();
    const result = await service.revealPassword("target", "actor");
    expect(result).toMatchObject({ available: false, password: null });
    expect(repository.recordPasswordView).toHaveBeenCalledWith(
      "target",
      "actor",
      false,
    );
  });
  it("does not release a credential when auditing or decryption fails", async () => {
    vi.stubEnv("ACCOUNT_PASSWORD_ENCRYPTION_KEY", "ab".repeat(32));
    const { repository, service } = setup(
      ["ADMIN"],
      sealAccountPassword("Changed@2026"),
    );
    repository.recordPasswordView.mockRejectedValueOnce(
      new Error("Audit unavailable"),
    );
    await expect(service.revealPassword("target", "actor")).rejects.toThrow(
      "Audit unavailable",
    );
    vi.stubEnv("ACCOUNT_PASSWORD_ENCRYPTION_KEY", "cd".repeat(32));
    await expect(service.revealPassword("target", "actor")).rejects.toThrow(
      "Không mở được kho mật khẩu",
    );
    expect(repository.recordPasswordView).toHaveBeenCalledTimes(1);
  });
});
