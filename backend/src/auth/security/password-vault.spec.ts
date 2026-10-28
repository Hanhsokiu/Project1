import { afterEach, describe, expect, it, vi } from "vitest";
import { openAccountPassword, sealAccountPassword } from "./password-vault";

afterEach(() => vi.unstubAllEnvs());

describe("admin password vault", () => {
  it("round-trips unicode passwords with a unique authenticated ciphertext each time", () => {
    vi.stubEnv("ACCOUNT_PASSWORD_ENCRYPTION_KEY", "a1".repeat(32));
    const password = "MậtKhẩu@2026";
    const first = sealAccountPassword(password)!;
    const second = sealAccountPassword(password)!;
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(openAccountPassword(first)).toBe(password);
    expect(openAccountPassword(second)).toBe(password);
  });
  it("rejects tampering and a different encryption key", () => {
    vi.stubEnv("ACCOUNT_PASSWORD_ENCRYPTION_KEY", "a1".repeat(32));
    const encrypted = sealAccountPassword("Example@2026")!;
    const parts = encrypted.split(".");
    parts[2] = (parts[2][0] === "0" ? "1" : "0") + parts[2].slice(1);
    expect(() => openAccountPassword(parts.join("."))).toThrow("Không mở được");
    vi.stubEnv("ACCOUNT_PASSWORD_ENCRYPTION_KEY", "b2".repeat(32));
    expect(() => openAccountPassword(encrypted)).toThrow("Không mở được");
    expect(() => openAccountPassword("invalid")).toThrow("Không mở được");
  });
  it("leaves the vault unavailable when disabled and rejects malformed keys", () => {
    vi.stubEnv("ACCOUNT_PASSWORD_ENCRYPTION_KEY", "");
    expect(sealAccountPassword("Example@2026")).toBeNull();
    expect(() => openAccountPassword("anything")).toThrow("chưa được cấu hình");
    vi.stubEnv("ACCOUNT_PASSWORD_ENCRYPTION_KEY", "wrong-key");
    expect(() => sealAccountPassword("Example@2026")).toThrow(
      "khóa hex 32 byte",
    );
  });
});
