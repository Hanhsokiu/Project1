-- DIAGNOSTIC ONLY: generated offline from adjacent datamodel snapshots.
-- NOT the reviewed deploy script; omits custom CHECK/functions/triggers/RBAC/RLS.
-- AlterTable
ALTER TABLE "DEFENSE_SESSION" ADD COLUMN     "context" JSONB,
ADD COLUMN     "created_by" VARCHAR(36),
ADD COLUMN     "ends_at" TIMESTAMPTZ(6),
ADD COLUMN     "finalized_at" TIMESTAMPTZ(6),
ADD COLUMN     "finalized_by" VARCHAR(36),
ADD COLUMN     "local_date" VARCHAR(10),
ADD COLUMN     "published_at" TIMESTAMPTZ(6),
ADD COLUMN     "published_by" VARCHAR(36),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "session_type" VARCHAR(20),
ADD COLUMN     "state" VARCHAR(20),
ADD COLUMN     "timezone" VARCHAR(50),
ADD COLUMN     "updated_at" TIMESTAMPTZ(6),
ADD COLUMN     "updated_by" VARCHAR(36);

