-- Additive migration: keep legacy status, timestamps and preferences verbatim.
-- Legacy registrations have no known direction or valid submission timestamp.
BEGIN;
ALTER TABLE "RESEARCH_AREA" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "REGISTRATION" ADD COLUMN "direction_id" TEXT;
ALTER TABLE "REGISTRATION" ADD COLUMN "submitted_at" TIMESTAMPTZ(6);
ALTER TABLE "REGISTRATION" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "REGISTRATION" ADD CONSTRAINT "REGISTRATION_direction_id_fkey"
  FOREIGN KEY ("direction_id") REFERENCES "RESEARCH_AREA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Fail atomically on invalid legacy preferences, without deleting or guessing data.
CREATE UNIQUE INDEX "REGISTRATION_PREF_registration_id_lecturer_id_key"
  ON "REGISTRATION_PREF"("registration_id", "lecturer_id");
ALTER TABLE "REGISTRATION_PREF" ADD CONSTRAINT "REGISTRATION_PREF_lecturer_id_fkey"
  FOREIGN KEY ("lecturer_id") REFERENCES "LECTURER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "REGISTRATION_PREF" ADD CONSTRAINT "registration_pref_order_1_3"
  CHECK ("preference_order" BETWEEN 1 AND 3);

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
COMMIT;
