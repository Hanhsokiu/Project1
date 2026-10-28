-- Additive data backfill and constraints. Existing ambiguous training-system values stay NULL
-- and must be explicitly selected before a legacy term can be opened.
BEGIN;
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
COMMIT;
