-- Existing bcrypt hashes remain valid. Only future password writes populate the vault.
ALTER TABLE "USER_ACCOUNT" ADD COLUMN "password_ciphertext" TEXT;
