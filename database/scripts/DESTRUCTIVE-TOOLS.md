# Legacy cleanup/reset safety

`clean-data.mjs` and `reset-dev.sh` refuse normal development/shared database
configuration. No fallback to backend `.env`, `DATABASE_URL` or `DIRECT_URL` is
allowed. Read-only inspection tools retain their existing behavior.

These tools require **all** of `GPMS_TEST_ALLOW_DESTRUCTIVE=1`, a 16-hex
`GPMS_TEST_RUN_ID`, a 48-hex `GPMS_TEST_OWNERSHIP_TOKEN` and an explicit
`GPMS_TEST_DATABASE_URL`. The database and user must both be named
`gpms_disposable_<runId>`, use literal `127.0.0.1` and a non-default port.

Before any destructive operation, a read-only server identity check must match
database/user/owner/host/port and the database comment
`project1-disposable-test:<runId>:<ownershipToken>`. Superuser/CREATEDB/CREATEROLE
roles are refused. Names and localhost alone are never sufficient proof.
An already-owned disposable test provisioner must establish this identity;
these tools never create a database, role, marker or configuration file.
Do not mark an existing development/shared database as disposable to bypass
this protection. No such provisioner or database is created by this change.

Reset supplies both Prisma datasource URLs only to the verified child process;
it does not change environment files. Credentials and subprocess output are
not printed. SQL/append-only compatibility of legacy cleanup is not guaranteed;
an approved fresh-test replay harness is preferred over cleanup of old data.

Safe checks (no PostgreSQL, Docker, or destructive script execution):

```powershell
node --test database/scripts/disposable-test-target.check.mjs
```

The checks inject fake clients and a fake process launcher and inspect the
legacy entrypoints as text. A passing simulation is not a PostgreSQL test.
