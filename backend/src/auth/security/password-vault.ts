import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const purpose = Buffer.from("UTC-GPMS/account-password/v1", "utf8");

function encryptionKey(): Buffer | null {
  const value = process.env.ACCOUNT_PASSWORD_ENCRYPTION_KEY;
  if (!value) return null;
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "ACCOUNT_PASSWORD_ENCRYPTION_KEY phải là khóa hex 32 byte.",
    );
  return Buffer.from(value, "hex");
}

/** Keep bcrypt for authentication; this opt-in vault serves the admin reveal action. */
export function sealAccountPassword(password: string): string | null {
  const key = encryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(purpose);
  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(".");
}

export function openAccountPassword(value: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("Kho mật khẩu chưa được cấu hình.");
  try {
    const parts = value.split(".");
    if (
      parts.length !== 4 ||
      parts[0] !== "v1" ||
      !/^[a-f0-9]{24}$/.test(parts[1]) ||
      !/^[a-f0-9]{32}$/.test(parts[2]) ||
      !/^(?:[a-f0-9]{2})+$/.test(parts[3])
    )
      throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(parts[1], "hex"),
    );
    decipher.setAAD(purpose);
    decipher.setAuthTag(Buffer.from(parts[2], "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Không mở được mật khẩu đã mã hóa. Kiểm tra cấu hình khóa trên máy chủ.",
    );
  }
}
