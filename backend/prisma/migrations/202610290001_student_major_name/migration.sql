-- Add an explicit student-provided source for the confirmed dossier major.
-- Existing accounts remain valid; no major is inferred or backfilled.
ALTER TABLE public."STUDENT" ADD COLUMN "major_name" TEXT NOT NULL DEFAULT '';
