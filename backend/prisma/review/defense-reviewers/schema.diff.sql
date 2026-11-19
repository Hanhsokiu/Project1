-- DIAGNOSTIC ONLY: generated offline from adjacent datamodel snapshots.
-- NOT the reviewed deploy script; omits custom CHECK/functions/triggers/RBAC/RLS.
-- AlterTable
ALTER TABLE "REVIEWER_ASSIGNMENT" ADD COLUMN     "committee_id" VARCHAR(36),
ADD COLUMN     "context" JSONB,
ADD COLUMN     "created_by" VARCHAR(36),
ADD COLUMN     "finalized_at" TIMESTAMPTZ(6),
ADD COLUMN     "finalized_by" VARCHAR(36),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "selected" BOOLEAN,
ADD COLUMN     "state" VARCHAR(20),
ADD COLUMN     "term_id" VARCHAR(36),
ADD COLUMN     "term_student_id" VARCHAR(36),
ADD COLUMN     "updated_at" TIMESTAMPTZ(6),
ADD COLUMN     "updated_by" VARCHAR(36);

-- CreateIndex
CREATE INDEX "REVIEWER_ASSIGNMENT_term_id_term_student_id_idx" ON "REVIEWER_ASSIGNMENT"("term_id", "term_student_id");

