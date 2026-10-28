# UC17 isolated PostgreSQL integration suite

Current environment verification (2026-10-27): Docker CLI installed; daemon pipe
`docker_engine` unavailable, Docker service stopped; no PostgreSQL executable on
PATH or installation at the checked standard locations. PostgreSQL cases are
**TEST WRITTEN — NOT RUN**. This is not a PostgreSQL PASS report.

Written PostgreSQL cases: 31. Local checks: 27/27 safety harness tests and 864/864
backend unit tests PASS; TypeScript and Prisma validate PASS. None of these is
evidence that PostgreSQL constraints or concurrency cases have run.

Run from `backend` in PowerShell when the local Docker daemon is available:

```powershell
$env:UC17_TEST_DOCKER = '1'
pnpm.cmd run test:uc17:postgres
```

There is deliberately no option accepting a development/shared URL. The runner
creates `postgres:16-alpine` with a unique container, generated database/user and
random password, ephemeral tmpfs data, and a random port bound to 127.0.0.1. It
checks the local Docker context, exact container ID/image/labels/mounts/binding,
then `current_database`, `current_user`, server port/version and an ownership
marker. Passwords/URLs are never command arguments or unredacted output. Missing
test config fails before Prisma construction; nothing falls back to DATABASE_URL.

Before either migration deploy the runner re-verifies ownership/identity. It
requires an empty DB, replays the unchanged migration prefix, inserts a synthetic
legacy decision BEFORE the UC17 extension, then replays the remaining unchanged
migrations and checks every source checksum. No seed script is invoked. Fixture
helpers refuse clients not previously verified by the guard. Backend .env files
are not loaded by the test Nest applications; Prisma CLI receives explicitly
overridden DATABASE_URL and DIRECT_URL pointing only to the owned test DB.

Four independent one-connection Prisma clients are used (two application clients,
one lock holder, one observer). Real JWT/RBAC guards, HTTP controllers, services,
repositories, validators, audits and private storage are used. Storage barriers
delay REAL I/O; SQL repositories are never mocked. `pg_blocking_pids` proves the
requests actually overlap at PostgreSQL row locks, rather than merely launching
Promise.all against a serialized fake client.

Cases:

- A01–A08: migration/checksums, real legacy upgrade, FK/CHECK/unique revisions,
  history append-only INSERT/UPDATE/DELETE/TRUNCATE, finalization append-only
  including CASCADE, composite term/revision pointer and state/version/hash guards.
- B01–B08 (B03 has two cases): JWT GET-context/download/PUT/decision/history,
  independent concurrent PUTs, database-trigger history/audit fault rollback,
  stale expectations and no-op gates, confirmedAt, reassignment and old history.
- C01–C04: same-checksum/new-revision, both upload/decision race orders, real lock
  hold measurement during controlled slow I/O, referenced-file cleanup safety.
- D01–D05: deadline while waiting/reading, PostgreSQL lock_timeout 55P03, Prisma
  interactive timeout rollback P2028, and a deliberately reversed-order SQL
  deadlock. This last case tests PostgreSQL detection, not a UC17 deadlock claim.
- E01–E05: UNKNOWN/DRAFT/OPEN HTTP API, JSONB/canonical SHA-256 round-trip,
  FINALIZED remains sealed after PDF changes, wrong hash fails closed, both
  finalization-lock race orders.

FINALIZED is inserted by a clearly marked SQL fixture transaction under the same
parent lock. **No UC18 FINALIZE API or academic eligibility producer is tested or
implemented.** The snapshot includes the full synthetic two-student roster,
including one student without a Proposal. No defense eligibility is inferred.

The suite prints `MEASUREMENT` records only after real PostgreSQL observations.
The PDF hold-time measurement includes an explicitly reported artificial 250 ms
I/O delay and a small genuine PDF; it is not a production/100 MiB benchmark.
No timings have been measured in the unavailable current environment.

Cleanup disconnects clients, removes only the exact container ID created by that
invocation after checking ownership labels, then deletes only its generated temp
directory after checking the absolute parent/name. It never uses DB reset/drop,
Docker prune, shared volumes, or deletion of production histories. Do not run this
suite via an unrelated integration prelude or substitute another database.

Safety harness checks need no Docker/database:

```powershell
pnpm.cmd run test:uc17:harness
```

These guard checks and ordinary backend unit tests must be reported separately
from PostgreSQL test results. Runner exit 2 means NOT RUN (Docker unavailable);
exit 1 means refusal/failure; only a complete database suite may exit 0.
