-- Prepared for psql only; NOT EXECUTED. Metadata SELECTs in READ ONLY.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT (current_database()=:'expected_database' AND current_user=:'expected_role' AND current_setting('server_version_num')::integer/10000=:'expected_pg_major'::integer AND current_setting('standard_conforming_strings')='on') AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_target_identity_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT current_database(),current_user,current_setting('server_version'),current_setting('transaction_read_only');
SELECT (NOT EXISTS(SELECT 1 FROM (VALUES ('0_init','533ffb3d89181a690ee6afbb15b9673d4f34dd5c75ecf542c596571cd1687504'),
('202610210001_empty_baseline_bridge','892d68d8e13c2c863e8786a841d3cbafa7603f3853ebbec35e979b919feec993'),
('202610210002_expand_workflow','933a053c2af980cb78d182d2a9b5fa915385374ea97a7948fae9de5d34b95503'),
('202610210003_review_group_management','924e394bf9ae7f69629abc698e9fa7d0073a2462ec9d4a7ca08905ce8389525b'),
('202610220001_proposal_review_assignment','1a77a25e8dca6baacefaf69ae8ee67b0b96a8b97ee0d4b30a17eb22eba39dc37'),
('202610220002_proposal_version_snapshots','69edd06f7a2aa15c5b18c19c741f0b4d52605e80286ef0ec10503d39f8712b39'),
('202610220003_dossier_finalization','c6d8b146d02dc25374bb06e38bdf73f4213e6e66cca4b5d812aee493ef4e26a3'),
('202610220004_guidance_task_management','505b31121767a48d7a33c06b86229f5583717d86c118fa770a78c4f10b47fed8'),
('202610220005_guidance_submissions','c13cd1ca97e453cf765e9d861b1e08ead088dd5456dbb5a91f42a88743e1d3ae'),
('202610230001_guidance_reviews','684722701d412f58e6dd2c824344bd74eb98f5e284ac2d97945eedc24d179b9e'),
('202610260001_step1_3_enum_values','d5cda509149bac10a8377f41d6a8f7f6ef703c92ebb3800c77e54984d14034de'),
('202610260002_integrate_step1_3','a2a965ad2e81460304e9e1d5bc298696528229c4ce592785f54ab299465762fc'),
('202610280001_proposal_lifecycle','4313b7c8e390560977e3fc419054b99e6f3c4c3181ef4c9f173775ba37548880'),
('202610290001_student_major_name','681b1af0d5fc20f580e53560747f51f3ee5aa3eb00b584fad1716349c3ff82cb'),
('202610290002_term_creator_academic_scope','f1e0d7bb9a41ec9aa9db6ad0d3e68b209bf89bd8ff5366156769275cf4fd2e10'),
('202611040001_lecturer_quota_policy','43e798278dad1823e855c1a22f06d5c8b7bcb428c53148b06cd37dd5527306a9'),
('202611040002_weekly_progress','43ec562bbe9e73c762a9dc36ba220e376924a6ec190ad9dcd0cff3973b0b775f'),
('202611090001_uc17_final_defense','75cd92d5f97acf26f3fe6a3eadbbcadfc54f9c81432beef4735e8bd8a51e092f'),
('202611090002_uc18_defense_eligibility','5d6165cbd16902d64619e871d42d85519fa4c8cbb0db3be4a33f8c9c737df389')) e(name,sha)
 LEFT JOIN public."_prisma_migrations" m ON m.migration_name=e.name
 WHERE m.migration_name IS NULL OR m.checksum IS DISTINCT FROM e.sha OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL)
 AND (SELECT count(*) FROM public."_prisma_migrations")=19) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_history_checksum_or_prefix_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_REPORT' AND column_name='revision')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_CONFIRMATION' AND column_name='revision')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_CONFIRMATION' AND column_name='report_version_id')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_CONFIRMATION' AND column_name='context')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='SCORE_ENTRY' AND column_name='revision')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='SCORE_ENTRY' AND column_name='report_version_id')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='SCORE_ENTRY' AND column_name='comment')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='SCORE_ENTRY' AND column_name='context')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_CONFIRMATION"') AND conname='final_confirmation_version_fk' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."SCORE_ENTRY"') AND conname='advisor_score_version_fk' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."FINAL_REPORT"') AND conname='final_report_revision_nonnegative' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_CONFIRMATION"') AND conname='final_confirmation_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."SCORE_ENTRY"') AND conname='final_advisor_score_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='final_pdf_immutable' AND NOT p.prosecdef AND p.provolatile='v' AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
BEGIN RAISE EXCEPTION ''Final PDF versions are append only''; END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='final_pdf_asset_immutable' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
BEGIN
  IF EXISTS (SELECT 1 FROM public."FINAL_REPORT_VERSION" WHERE file_asset_id=OLD.id) THEN
    IF TG_OP=''DELETE'' THEN
      RAISE EXCEPTION ''Final PDF asset cannot be deleted'' USING ERRCODE=''23514'';
    END IF;
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION ''Final PDF asset metadata is immutable'' USING ERRCODE=''23514'';
    END IF;
  END IF;
  IF TG_OP=''DELETE'' THEN RETURN OLD; END IF;
  RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='final_pdf_asset_check' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
BEGIN
  -- Both final and weekly claims actually UPDATE the same FILE_ASSET row.
  -- A lock alone does not invalidate a waiting Repeatable Read snapshot.
  -- This SQL no-op creates a row version without changing id/updatedAt/content.
  UPDATE public."FILE_ASSET" SET id=id WHERE id=NEW.file_asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION ''Final PDF asset claim requires an updated asset row'' USING ERRCODE=''23514'';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."FILE_ASSET" a
    JOIN public."FINAL_REPORT" r ON r.id=NEW.report_id
    JOIN public."PROPOSAL" p ON p.id=r.proposal_id
    JOIN public."STUDENT" s ON s.id=p.student_id
    WHERE a.id=NEW.file_asset_id AND a."createdByUserId"=s.user_id
    AND a.kind=''REPORT'' AND a.state=''READY'' AND a."mimeType"=''application/pdf''
    AND a."sizeBytes">0 AND a.checksum ~ ''^[0-9a-f]{64}$''
    AND a."storageKey" ~ ''^guidance/[0-9a-f-]{36}$''
    AND a."storageKey"=''guidance/'' || a.id) THEN
    RAISE EXCEPTION ''Final report requires a private ready PDF asset'' USING ERRCODE=''23514'';
  END IF;
  IF EXISTS (SELECT 1 FROM public."SUBMISSION_ASSET" WHERE "fileId"=NEW.file_asset_id) THEN
    RAISE EXCEPTION ''Weekly submission assets cannot be final reports'';
  END IF;
  IF EXISTS (SELECT 1 FROM public."GUIDANCE_SUBMISSION_UPLOAD" WHERE "assetId"=NEW.file_asset_id) THEN
    RAISE EXCEPTION ''Weekly upload assets cannot be final reports'';
  END IF;
  RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='final_decision_owner_check' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
BEGIN
  IF NEW.report_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."FINAL_REPORT_VERSION" v JOIN public."FINAL_REPORT" r ON r.id=v.report_id
    WHERE v.id=NEW.report_version_id AND r.proposal_id=NEW.proposal_id
  ) THEN RAISE EXCEPTION ''Final PDF belongs to a different proposal''; END IF;
  RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='final_pdf_no_weekly_reuse' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE asset_id TEXT := to_jsonb(NEW)->>TG_ARGV[0];
BEGIN
  IF asset_id IS NOT NULL THEN
    -- Same row/write fence as the final claim. Never lock a final/weekly child
    -- from FILE_ASSET''s guard: that would reverse the writer''s lock order.
    UPDATE public."FILE_ASSET" SET id=id WHERE id=asset_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION ''Weekly asset claim requires an updated asset row'' USING ERRCODE=''23514'';
    END IF;
    IF EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION" WHERE file_asset_id=asset_id)
    THEN RAISE EXCEPTION ''Final PDF assets cannot be reused by weekly submissions''; END IF;
  END IF;
  RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."FINAL_REPORT_VERSION"') AND t.tgname='final_pdf_immutable' AND t.tgtype::integer=27 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='final_pdf_immutable' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."FILE_ASSET"') AND t.tgname='final_pdf_asset_immutable' AND t.tgtype::integer=27 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='final_pdf_asset_immutable' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."FINAL_REPORT_VERSION"') AND t.tgname='final_pdf_asset_check' AND t.tgtype::integer=7 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='final_pdf_asset_check' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."DEFENSE_CONFIRMATION"') AND t.tgname='final_confirmation_owner' AND t.tgtype::integer=23 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='final_decision_owner_check' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."SCORE_ENTRY"') AND t.tgname='advisor_score_owner' AND t.tgtype::integer=23 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='final_decision_owner_check' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."SUBMISSION_ASSET"') AND t.tgname='final_pdf_no_weekly_submission' AND t.tgtype::integer=23 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='final_pdf_no_weekly_reuse' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."GUIDANCE_SUBMISSION_UPLOAD"') AND t.tgname='final_pdf_no_weekly_upload' AND t.tgtype::integer=23 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='final_pdf_no_weekly_reuse' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_ELIGIBILITY' AND column_name='revision')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_ELIGIBILITY' AND column_name='context')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_ELIGIBILITY' AND column_name='reviewed_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_ELIGIBILITY' AND column_name='decided_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_ELIGIBILITY' AND column_name='decided_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_ELIGIBILITY' AND column_name='finalized_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_ELIGIBILITY' AND column_name='finalized_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_ELIGIBILITY"') AND conname='eligibility_provenance_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='eligibility_transition_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE actor_id TEXT;
BEGIN
  IF TG_OP=''DELETE'' THEN
    IF OLD.revision>0 THEN RAISE EXCEPTION ''UC18 records must retain their audit provenance''; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP=''UPDATE'' THEN
    IF OLD.finalized_at IS NOT NULL THEN RAISE EXCEPTION ''Finalized eligibility is immutable; reopening requires an approved workflow''; END IF;
    IF OLD.revision=0 AND NEW.revision>0 THEN RAISE EXCEPTION ''Legacy eligibility requires a separate approved reconciliation''; END IF;
    IF OLD.revision>0 AND (NEW.revision<>OLD.revision+1 OR NEW.proposal_id<>OLD.proposal_id) THEN
      RAISE EXCEPTION ''Eligibility revision/owner conflict'';
    END IF;
  ELSIF NEW.revision<>1 THEN RAISE EXCEPTION ''UC18 inserts start at revision one'';
  END IF;
  IF NEW.revision>0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public."PROPOSAL" p JOIN public."TOPIC" t ON t.id=p.topic_id
      JOIN public."TOPIC_WORKFLOW" w ON w."topicId"=t.id
      JOIN public."TERM_STUDENT" s ON s.id=w."termStudentId"
      WHERE p.id=NEW.proposal_id AND s.student_id=p.student_id AND s.term_id=p.term_id
      AND t.term_id=p.term_id AND w."termId"=p.term_id
      AND s.id=NEW.context->>''termStudentId'' AND s.term_id=NEW.context->>''termId''
    ) THEN RAISE EXCEPTION ''UC18 context must match the official proposal owner and term''; END IF;
    FOREACH actor_id IN ARRAY ARRAY[NEW.reviewed_by,NEW.decided_by,NEW.finalized_by] LOOP
      IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."USER_ACCOUNT" WHERE id=actor_id) THEN
        RAISE EXCEPTION ''UC18 actor does not exist'';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."DEFENSE_ELIGIBILITY"') AND t.tgname='eligibility_transition_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='eligibility_transition_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public."FINAL_REPORT_VERSION"') AND relrowsecurity)
 AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_CONFIRMATION"') AND conname='final_confirmation_version_fk' AND contype='f' AND convalidated)
 AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."SCORE_ENTRY"') AND conname='advisor_score_version_fk' AND contype='f' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_UC17_RLS_or_FK_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
COMMIT;
\echo PASS_metadata_checkpoint_only_behavioral_rehearsal_still_required
