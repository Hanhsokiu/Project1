-- Additive migration. Existing quotas and academic titles remain unchanged.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "LECTURER"
  ADD COLUMN "academic_degree" TEXT,
  ADD COLUMN "academic_rank" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "LECTURER" ADD CONSTRAINT "lecturer_academic_degree_check"
  CHECK ("academic_degree" IS NULL OR "academic_degree" IN ('MASTER', 'DOCTOR'));
ALTER TABLE "LECTURER" ADD CONSTRAINT "lecturer_academic_rank_check"
  CHECK ("academic_rank" IN ('NONE', 'ASSOCIATE_PROFESSOR', 'PROFESSOR'));
-- Credentials are deliberately not inferred from names or legacy title labels.
-- A versioned, validated policy snapshot preserves term-specific rules and approval.
ALTER TABLE "THESIS_TERM" ADD COLUMN "quota_policy" JSONB;
COMMIT;
