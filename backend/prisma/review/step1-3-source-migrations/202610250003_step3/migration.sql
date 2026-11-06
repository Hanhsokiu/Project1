BEGIN;
ALTER TABLE "ASSIGNMENT_PLAN" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "input_snapshot" JSONB, ADD COLUMN "outcome" JSONB,
 ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ASSIGNMENT_PLAN" ADD CONSTRAINT "ASSIGNMENT_PLAN_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "THESIS_TERM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ASSIGNMENT_PLAN_one_draft" ON "ASSIGNMENT_PLAN"("term_id") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "ASSIGNMENT_PLAN_one_official" ON "ASSIGNMENT_PLAN"("term_id") WHERE "status" IN ('PUBLISHED', 'FINALIZED');
ALTER TABLE "ADVISOR_ASSIGNMENT" DROP CONSTRAINT IF EXISTS "ADVISOR_ASSIGNMENT_registration_id_key";
DROP INDEX IF EXISTS "ADVISOR_ASSIGNMENT_registration_id_key";
CREATE UNIQUE INDEX "ADVISOR_ASSIGNMENT_assignment_plan_id_registration_id_key" ON "ADVISOR_ASSIGNMENT"("assignment_plan_id", "registration_id");
ALTER TABLE "TOPIC" ADD COLUMN "advisor_agreed" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "student_agreed" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "agreed_at" TIMESTAMPTZ(6);
ALTER TABLE "PROPOSAL" ADD COLUMN "term_id" TEXT;
UPDATE "PROPOSAL" p SET "term_id" = t."term_id" FROM "TOPIC" t WHERE p."topic_id" = t."id";
ALTER TABLE "PROPOSAL" ALTER COLUMN "term_id" SET NOT NULL;
ALTER TABLE "PROPOSAL" ADD CONSTRAINT "PROPOSAL_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "THESIS_TERM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PROPOSAL" DROP CONSTRAINT IF EXISTS "PROPOSAL_student_id_key";
DROP INDEX IF EXISTS "PROPOSAL_student_id_key";
CREATE UNIQUE INDEX "PROPOSAL_term_id_student_id_key" ON "PROPOSAL"("term_id", "student_id");
ALTER TABLE "PROPOSAL_VERSION" ADD COLUMN "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
 ADD COLUMN "created_by" TEXT, ADD COLUMN "submitted_at" TIMESTAMPTZ(6);
CREATE TABLE "EMAIL_OUTBOX" (
 "id" TEXT PRIMARY KEY, "event_key" TEXT NOT NULL, "term_id" TEXT NOT NULL, "user_id" TEXT NOT NULL,
 "recipient" TEXT, "subject" TEXT NOT NULL, "payload" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','PROCESSING','SENT','FAILED')),
 "attempts" INTEGER NOT NULL DEFAULT 0, "last_error" TEXT,
 "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "locked_at" TIMESTAMPTZ(6),
 "lease_token" TEXT, "sent_at" TIMESTAMPTZ(6), "message_id" TEXT,
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "EMAIL_OUTBOX_event_key_key" ON "EMAIL_OUTBOX"("event_key");
CREATE INDEX "EMAIL_OUTBOX_status_available_at_idx" ON "EMAIL_OUTBOX"("status", "available_at");
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
