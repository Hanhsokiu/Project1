# Source migration history from aec892f

These six SQL files are preserved unchanged for reference. They target the source branch's baseline and must not run after the existing PR2B enum bridge: both histories create the same enum types.

The active history is in ../../migrations: unchanged 0_init, the enum bridge, the workflow expansion, then 202610260001_step1_3_enum_values and 202610260002_integrate_step1_3.

The integration migrations preserve workflow tables and legacy physical column types, backfill proposal term ownership from Topic, and add the constraints and outbox needed by steps 1-3. A database that has already applied the source history needs its own reviewed migration-history reconciliation; do not reset it or replay this chain over it.
