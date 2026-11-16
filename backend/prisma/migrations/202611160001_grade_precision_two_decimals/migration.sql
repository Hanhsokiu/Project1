-- Widen grade storage without changing any stored value or immutable source snapshot.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE public."PHASE_EVALUATION" ALTER COLUMN score TYPE NUMERIC(5,2);
ALTER TABLE public."RUBRIC_CRITERIA" ALTER COLUMN max_score TYPE NUMERIC(5,2);
ALTER TABLE public."SCORE_ENTRY" ALTER COLUMN total_score TYPE NUMERIC(5,2);
ALTER TABLE public."SCORE_DETAIL" ALTER COLUMN score TYPE NUMERIC(5,2);
ALTER TABLE public."FINAL_RESULT"
  ALTER COLUMN advisor_score TYPE NUMERIC(5,2),
  ALTER COLUMN reviewer_score TYPE NUMERIC(5,2),
  ALTER COLUMN final_score TYPE NUMERIC(5,2);
COMMIT;
