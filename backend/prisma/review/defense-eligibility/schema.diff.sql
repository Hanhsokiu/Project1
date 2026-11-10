-- DIAGNOSTIC ONLY: generated offline from adjacent datamodel snapshots.
-- NOT the reviewed deploy script; omits custom CHECK/functions/triggers/RBAC/RLS.
-- AlterTable
ALTER TABLE "DEFENSE_ELIGIBILITY" ADD COLUMN     "context" JSONB,
ADD COLUMN     "decided_at" TIMESTAMPTZ(6),
ADD COLUMN     "decided_by" VARCHAR(36),
ADD COLUMN     "finalized_at" TIMESTAMPTZ(6),
ADD COLUMN     "finalized_by" VARCHAR(36),
ADD COLUMN     "reviewed_by" VARCHAR(36),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

