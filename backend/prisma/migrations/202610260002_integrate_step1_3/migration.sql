-- Integrate steps 1-3 after the existing baseline bridge and workflow expansion.
-- Preserve workflow data, existing FK policies and legacy physical column types.
BEGIN;
-- DropIndex
ALTER TABLE "ADVISOR_ASSIGNMENT" DROP CONSTRAINT "ADVISOR_ASSIGNMENT_registration_id_key";

-- DropIndex
ALTER TABLE "PROPOSAL" DROP CONSTRAINT "PROPOSAL_student_id_key";

-- AlterTable
ALTER TABLE "USER_ACCOUNT" ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "NOTIFICATION" ADD COLUMN     "term_id" TEXT;

-- AlterTable
ALTER TABLE "STUDENT" ADD COLUMN     "academic_eligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "class_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cohort" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "RESEARCH_AREA" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "IMPORT_JOB" ADD COLUMN     "confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "file_hash" TEXT,
ADD COLUMN     "mode" TEXT,
ADD COLUMN     "rows" JSONB,
ADD COLUMN     "term_id" TEXT;

-- AlterTable
ALTER TABLE "THESIS_TERM" ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "semester_id" TEXT,
ADD COLUMN     "training_system_id" TEXT;

-- AlterTable
ALTER TABLE "TERM_PHASE" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "REGISTRATION" ADD COLUMN     "direction_id" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMPTZ(6),
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "ASSIGNMENT_PLAN" ADD COLUMN     "input_snapshot" JSONB,
ADD COLUMN     "outcome" JSONB,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TOPIC" ADD COLUMN     "advisor_agreed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "agreed_at" TIMESTAMPTZ(6),
ADD COLUMN     "student_agreed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PROPOSAL" ADD COLUMN     "term_id" TEXT;

-- AlterTable
ALTER TABLE "PROPOSAL_VERSION" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submitted_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "ACADEMIC_SEMESTER" (
    "id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ACADEMIC_SEMESTER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EMAIL_OUTBOX" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recipient" TEXT,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(6),
    "lease_token" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EMAIL_OUTBOX_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ACADEMIC_SEMESTER_academic_year_semester_key" ON "ACADEMIC_SEMESTER"("academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "EMAIL_OUTBOX_event_key_key" ON "EMAIL_OUTBOX"("event_key");

-- CreateIndex
CREATE INDEX "EMAIL_OUTBOX_status_available_at_idx" ON "EMAIL_OUTBOX"("status", "available_at");

-- CreateIndex
CREATE INDEX "IMPORT_JOB_term_id_created_at_idx" ON "IMPORT_JOB"("term_id", "created_at");

-- CreateIndex
CREATE INDEX "THESIS_TERM_training_system_id_semester_id_created_at_idx" ON "THESIS_TERM"("training_system_id", "semester_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "TERM_PHASE_term_id_code_key" ON "TERM_PHASE"("term_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "REGISTRATION_PREF_registration_id_lecturer_id_key" ON "REGISTRATION_PREF"("registration_id", "lecturer_id");

-- CreateIndex
CREATE UNIQUE INDEX "ADVISOR_ASSIGNMENT_assignment_plan_id_registration_id_key" ON "ADVISOR_ASSIGNMENT"("assignment_plan_id", "registration_id");

UPDATE "PROPOSAL" p SET "term_id" = t."term_id" FROM "TOPIC" t WHERE p."topic_id" = t."id";
ALTER TABLE "PROPOSAL" ALTER COLUMN "term_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PROPOSAL_term_id_student_id_key" ON "PROPOSAL"("term_id", "student_id");

-- AddForeignKey
ALTER TABLE "IMPORT_JOB" ADD CONSTRAINT "IMPORT_JOB_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "THESIS_TERM"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "THESIS_TERM" ADD CONSTRAINT "THESIS_TERM_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "ACADEMIC_SEMESTER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "THESIS_TERM" ADD CONSTRAINT "THESIS_TERM_training_system_id_fkey" FOREIGN KEY ("training_system_id") REFERENCES "TRAINING_SYSTEM"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "REGISTRATION" ADD CONSTRAINT "REGISTRATION_direction_id_fkey" FOREIGN KEY ("direction_id") REFERENCES "RESEARCH_AREA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROPOSAL" ADD CONSTRAINT "PROPOSAL_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "THESIS_TERM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additive data backfill and constraints. Existing ambiguous training-system values stay NULL
-- and must be explicitly selected before a legacy term can be opened.
INSERT INTO "ACADEMIC_SEMESTER" ("id","academic_year","semester","name","start_date","end_date","created_at","updated_at")
SELECT uuid_generate_v4()::text,"academic_year","semester","academic_year" || ' / Học kỳ ' || "semester"::text,MIN("start_date"),MAX("end_date"),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM "THESIS_TERM" GROUP BY "academic_year","semester"
ON CONFLICT ("academic_year","semester") DO NOTHING;
UPDATE "THESIS_TERM" t SET "semester_id"=s."id" FROM "ACADEMIC_SEMESTER" s WHERE t."semester_id" IS NULL AND s."academic_year"=t."academic_year" AND s."semester"=t."semester";
UPDATE "THESIS_TERM" t SET "training_system_id"=r.system_id FROM (
 SELECT ts."term_id",MIN(s."training_system_id") AS system_id FROM "TERM_STUDENT" ts JOIN "STUDENT" s ON s."id"=ts."student_id"
 GROUP BY ts."term_id" HAVING COUNT(DISTINCT s."training_system_id")=1
) r WHERE t."id"=r."term_id" AND t."training_system_id" IS NULL;
ALTER TABLE "STUDENT" ADD CONSTRAINT "student_gpa_0_4" CHECK ("gpa" >= 0 AND "gpa" <= 4);
ALTER TABLE "LECTURER" ADD CONSTRAINT "lecturer_max_students_nonnegative" CHECK ("max_students" >= 0);
ALTER TABLE "TERM_LECTURER" ADD CONSTRAINT "term_quota_nonnegative" CHECK ("quota" >= 0);
ALTER TABLE "THESIS_TERM" ADD CONSTRAINT "term_dates_increasing" CHECK ("start_date" < "end_date");
ALTER TABLE "ACADEMIC_SEMESTER" ADD CONSTRAINT "semester_dates_increasing" CHECK ("start_date" < "end_date");
ALTER TABLE "ACADEMIC_SEMESTER" ADD CONSTRAINT "semester_number_valid" CHECK ("semester" BETWEEN 1 AND 3);
ALTER TABLE "TERM_PHASE" ADD CONSTRAINT "phase_dates_increasing" CHECK ("start_date" < "end_date");

ALTER TABLE "REGISTRATION_PREF" ADD CONSTRAINT "registration_pref_order_1_3"
  CHECK ("preference_order" BETWEEN 1 AND 3);
CREATE UNIQUE INDEX "ASSIGNMENT_PLAN_one_draft" ON "ASSIGNMENT_PLAN"("term_id") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "ASSIGNMENT_PLAN_one_official" ON "ASSIGNMENT_PLAN"("term_id") WHERE "status" IN ('PUBLISHED', 'FINALIZED');
ALTER TABLE "EMAIL_OUTBOX" ADD CONSTRAINT "email_outbox_status_valid" CHECK ("status" IN ('PENDING','PROCESSING','SENT','FAILED'));
-- Existing installations get permissions without rerunning seed or changing accounts.
INSERT INTO "PERMISSION" ("id","resource","action")
VALUES (uuid_generate_v4()::text,'registration','read'),
       (uuid_generate_v4()::text,'registration','own')
ON CONFLICT ("resource","action") DO NOTHING;
INSERT INTO "ROLE_PERMISSION" ("role_id","permission_id")
SELECT r."id", p."id" FROM "ROLE" r CROSS JOIN "PERMISSION" p
WHERE p."resource"='registration' AND
 ((p."action"='read' AND r."name" IN ('ADMIN','FACULTY')) OR
  (p."action"='own' AND r."name"='STUDENT'))
ON CONFLICT DO NOTHING;

INSERT INTO "PERMISSION" ("id", "resource", "action")
SELECT 'step3-' || resource || '-' || action, resource, action FROM (VALUES
 ('assignment','manage'),('assignment','read'),('topic','read'),('topic','write'),('topic','agree'),('notification','own')
) p(resource,action) ON CONFLICT ("resource","action") DO NOTHING;
INSERT INTO "ROLE_PERMISSION" ("role_id","permission_id")
SELECT r."id",p."id" FROM "ROLE" r CROSS JOIN "PERMISSION" p
WHERE (r."name" IN ('ADMIN','FACULTY') AND p."resource" IN ('assignment','topic','notification'))
 OR (r."name" IN ('STUDENT','LECTURER') AND ((p."resource"='assignment' AND p."action"='read') OR (p."resource"='topic' AND p."action" IN ('read','write')) OR (p."resource"='notification' AND p."action"='own')))
 OR (r."name"='LECTURER' AND p."resource"='topic' AND p."action"='agree')
ON CONFLICT DO NOTHING;

COMMIT;
