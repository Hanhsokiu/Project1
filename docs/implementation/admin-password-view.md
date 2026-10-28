# Admin password viewing

The admin can reveal a current password through the eye button on Accounts.
Authentication still uses bcrypt. An additional AES-256-GCM ciphertext supports
the explicitly requested admin viewing feature.

- Set `ACCOUNT_PASSWORD_ENCRYPTION_KEY` to a random 32-byte key, encoded as 64 hex characters, in the server environment only. Keep the key stable and back it up separately from database backups. Losing or replacing it makes existing ciphertext unreadable.
- Apply migration `202610280001_admin_password_vault` and regenerate Prisma Client before starting the updated backend.
- Account creation/editing, password reset, self-service password change, student/lecturer catalog creation, and student import write the hash and ciphertext together.
- Existing accounts have a null ciphertext. They remain usable and become viewable after their next password change/reset. Viewing does not reset a password or recover a bcrypt hash.
- `POST /api/accounts/:id/reveal-password` requires a valid session, `account:read`, and a current ADMIN role checked on the server. Its response uses `Cache-Control: no-store` and `Pragma: no-cache`.
- Every successful lookup writes `ACCOUNT_PASSWORD_VIEWED` with actor, account ID and availability only. An audit failure prevents the password response. Plaintext and ciphertext are excluded from ordinary account/login/profile responses and audit payloads.
- The UI requests one password at a time, keeps it only in component memory, clears it when the dialog closes, and automatically hides it after 60 seconds. It is not included in account snapshots or exports.
- Without a key the optional vault is disabled; password writes clear any prior ciphertext to avoid showing a stale password. Authentication remains available.

## Existing populated databases with legacy migration history

If the database has a legacy history that predates the empty baseline bridge,
do not replay that bridge against populated application tables. After reviewing
and verifying the local target, apply only the new additive SQL and record it:

```powershell
pnpm --filter @doan/backend prisma db execute --file prisma/migrations/202610280001_admin_password_vault/migration.sql --schema prisma/schema.prisma
pnpm --filter @doan/backend prisma migrate resolve --applied 202610280001_admin_password_vault
pnpm --filter @doan/backend prisma generate
```

This does not reconcile other legacy migrations or reset application data.