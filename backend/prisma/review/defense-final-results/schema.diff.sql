-- DIAGNOSTIC ONLY: generated offline from adjacent datamodel snapshots.
-- NOT the reviewed deploy script; omits custom CHECK/functions/triggers/RBAC/RLS.
-- AlterTable
ALTER TABLE "FINAL_RESULT" ADD COLUMN     "context" JSONB,
ADD COLUMN     "finalized_at" TIMESTAMPTZ(6),
ADD COLUMN     "finalized_by" VARCHAR(36),
ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published_by" VARCHAR(36),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'LEGACY_UNVERIFIED';

