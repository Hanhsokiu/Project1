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
('202611090002_uc18_defense_eligibility','5d6165cbd16902d64619e871d42d85519fa4c8cbb0db3be4a33f8c9c737df389'),
('202611090003_uc19_defense_committee','d3d20df62e6b18c31197a0c7c441653b5ddaf65b6530732cf4e8a75f5b9970b4'),
('202611090004_uc20_defense_reviewers','0b2908058248ee8c3e066d57871e03050a98d84e2aa382284f55b585eab91c53')) e(name,sha)
 LEFT JOIN public."_prisma_migrations" m ON m.migration_name=e.name
 WHERE m.migration_name IS NULL OR m.checksum IS DISTINCT FROM e.sha OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL)
 AND (SELECT count(*) FROM public."_prisma_migrations")=21) AS uc_ok \gset
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
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='code')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='department_id')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='revision')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='state')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='context')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='created_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='updated_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='updated_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='finalized_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_COMMITTEE' AND column_name='finalized_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_COMMITTEE"') AND conname='cc_provenance_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND conname='cca_provenance_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cc_check_student' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE tid TEXT; advisor TEXT; assignment_id TEXT; assignment_revision INTEGER; n INTEGER;
BEGIN
 SELECT term_id INTO tid FROM public."DEFENSE_COMMITTEE" WHERE id=cid AND revision>0;
 IF tid IS NULL THEN RAISE EXCEPTION ''UC19 requires a verified committee''; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=tid FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public."TERM_STUDENT" s JOIN public."PROPOSAL" p ON p.student_id=s.student_id AND p.term_id=s.term_id
   JOIN public."TOPIC_WORKFLOW" w ON w."topicId"=p.topic_id AND w."termStudentId"=s.id AND w."termId"=s.term_id
   WHERE s.id=tsid AND s.term_id=tid AND p.id=pid)
 THEN RAISE EXCEPTION ''UC19 student/proposal/term mismatch''; END IF;
 SELECT count(*),min(a.advisor_id),min(a.id) INTO n,advisor,assignment_id
 FROM public."PROPOSAL" p JOIN public."REGISTRATION" r ON r.student_id=p.student_id AND r.term_id=p.term_id
 JOIN public."TERM_WORKFLOW" tw ON tw."termId"=p.term_id
 JOIN public."ASSIGNMENT_PLAN" ap ON ap.id=tw."officialAssignmentPlanId" AND ap.status=''FINALIZED''
 JOIN public."ASSIGNMENT_PLAN_WORKFLOW" pw ON pw."planId"=ap.id AND pw."finalizedAt"<=now() AND pw."finalizedByUserId" IS NOT NULL
 JOIN public."ADVISOR_ASSIGNMENT" a ON a.assignment_plan_id=ap.id AND a.registration_id=r.id
 WHERE p.id=pid;
 IF n<>1 OR advisor IS NULL THEN RAISE EXCEPTION ''UC19 official advisor unavailable''; END IF;
 SELECT COALESCE(max("assignmentRevision"),0) INTO assignment_revision FROM public."ASSIGNMENT_CHANGE" WHERE "assignmentId"=assignment_id;
 IF EXISTS(SELECT 1 FROM public."ASSIGNMENT_CHANGE" WHERE "assignmentId"=assignment_id AND "assignmentRevision"=assignment_revision AND ("effectiveAt">now() OR "newAdvisorId"<>advisor))
 THEN RAISE EXCEPTION ''UC19 handover not effective''; END IF;
 IF EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" WHERE committee_id=cid AND lecturer_id=advisor)
 THEN RAISE EXCEPTION ''UC19 advisor conflicts with a committee member''; END IF;
 IF advisor IS DISTINCT FROM binding->>''advisorId'' OR NOT EXISTS(
   SELECT 1 FROM public."DEFENSE_ELIGIBILITY" e WHERE e.proposal_id=pid AND e.revision>0 AND e.status=''ELIGIBLE'' AND e.finalized_at IS NOT NULL AND e.finalized_by IS NOT NULL
   AND e.context->>''termId''=tid AND e.context->>''termStudentId''=tsid
   AND e.revision::text=binding#>>''{eligibility,revision}''
   AND e.context->>''evidenceHash''=binding#>>''{eligibility,evidenceHash}''
   AND e.context->>''policyHash''=binding#>>''{eligibility,policyHash}''
   AND e.context#>>''{evidence,binding,assignmentId}''=assignment_id
   AND e.context#>>''{evidence,binding,assignmentRevision}''=assignment_revision::text)
 THEN RAISE EXCEPTION ''UC19 requires current finalized UC18 binding''; END IF;
 IF EXISTS(SELECT 1 FROM public."COMMITTEE_STUDENT" WHERE proposal_id=pid)
 THEN RAISE EXCEPTION ''Legacy session assignment requires reconciliation''; END IF;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cc_transition_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
BEGIN
 IF TG_OP=''DELETE'' THEN
  IF OLD.revision>0 THEN RAISE EXCEPTION ''UC19 committee deletion is not supported''; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP=''UPDATE'' THEN
  IF OLD.revision>0 AND (OLD.state=''FINALIZED'' OR NEW.revision<>OLD.revision+1 OR NEW.term_id<>OLD.term_id OR NEW.created_by IS DISTINCT FROM OLD.created_by)
  THEN RAISE EXCEPTION ''UC19 committee locked or revision conflict''; END IF;
  IF OLD.revision=0 AND NEW.revision>0 THEN RAISE EXCEPTION ''Legacy committee requires explicit reconciliation''; END IF;
 ELSIF NEW.revision<>1 THEN RAISE EXCEPTION ''UC19 committee starts at revision one'';
 END IF;
 IF NEW.revision>0 THEN
  PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.term_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public."DEPARTMENT" WHERE id=NEW.department_id)
   OR NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.created_by)
   OR NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.updated_by)
   OR (NEW.finalized_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.finalized_by))
  THEN RAISE EXCEPTION ''UC19 actor/department missing''; END IF;
 END IF;
 RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cc_member_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE cid TEXT; lid TEXT; c RECORD; a RECORD;
BEGIN
 IF TG_OP=''DELETE'' THEN cid:=OLD.committee_id; lid:=OLD.lecturer_id; ELSE cid:=NEW.committee_id; lid:=NEW.lecturer_id; END IF;
 IF TG_OP=''UPDATE'' AND NEW.committee_id<>OLD.committee_id THEN RAISE EXCEPTION ''Remove/add membership explicitly''; END IF;
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=cid;
 IF NOT FOUND THEN
  -- A normal legacy parent DELETE cascades after the parent row disappears.
  -- New committees cannot be deleted by cc_transition_guard; RLS filtering
  -- errors before this branch because row_security=off, never becomes NOT FOUND.
  IF TG_OP=''DELETE'' AND pg_trigger_depth()>1 AND NOT EXISTS(
    SELECT 1 FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=cid)
  THEN RETURN OLD; END IF;
  RAISE EXCEPTION ''UC19 parent committee is not verifiable'' USING ERRCODE=''23514'';
 END IF;
 IF c.revision>0 THEN
  PERFORM id FROM public."THESIS_TERM" WHERE id=c.term_id FOR UPDATE;
  IF c.state IS DISTINCT FROM ''DRAFT'' THEN RAISE EXCEPTION ''UC19 committee is locked''; END IF;
  IF TG_OP<>''DELETE'' THEN
   IF NEW.role IS NULL OR NEW.role NOT IN (''CHAIR'',''SECRETARY'',''MEMBER'') OR NOT EXISTS(
    SELECT 1 FROM public."LECTURER" l JOIN public."TERM_LECTURER" r ON r.lecturer_id=l.id AND r.term_id=c.term_id
    JOIN public."USER_ACCOUNT" u ON u.id=l.user_id AND u.status=''ACTIVE'' WHERE l.id=lid AND l.is_active)
   THEN RAISE EXCEPTION ''UC19 member must be active in the term roster''; END IF;
   -- The new member is checked against EVERY currently assigned student''s advisor.
   IF EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" ca
    JOIN public."PROPOSAL" p ON p.id=ca.proposal_id
    JOIN public."REGISTRATION" r ON r.term_id=p.term_id AND r.student_id=p.student_id
    JOIN public."TERM_WORKFLOW" w ON w."termId"=r.term_id
    JOIN public."ADVISOR_ASSIGNMENT" aa ON aa.assignment_plan_id=w."officialAssignmentPlanId" AND aa.registration_id=r.id
    WHERE ca.committee_id=cid AND ca.state=''ACTIVE'' AND aa.advisor_id=lid)
   THEN RAISE EXCEPTION ''UC19 new member advises a student already assigned here''; END IF;
  END IF;
 END IF;
 IF TG_OP=''DELETE'' THEN RETURN OLD; END IF; RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cca_transition_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE c RECORD;
BEGIN
 IF TG_OP=''DELETE'' THEN RAISE EXCEPTION ''UC19 assignment removal must retain revision/history''; END IF;
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=NEW.committee_id;
 IF NOT FOUND THEN RAISE EXCEPTION ''UC19 assignment parent is not verifiable'' USING ERRCODE=''23514''; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.term_id FOR UPDATE;
 IF c.revision IS NULL OR c.revision=0 OR c.state IS DISTINCT FROM ''DRAFT'' OR c.term_id IS DISTINCT FROM NEW.term_id THEN RAISE EXCEPTION ''UC19 target committee unavailable''; END IF;
 IF TG_OP=''UPDATE'' THEN
  IF NEW.revision<>OLD.revision+1 OR NEW.term_id<>OLD.term_id OR NEW.term_student_id<>OLD.term_student_id OR NEW.proposal_id<>OLD.proposal_id
   OR (OLD.state=''ACTIVE'' AND EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE" WHERE id=OLD.committee_id AND state=''FINALIZED''))
  THEN RAISE EXCEPTION ''UC19 assignment locked/owner/revision mismatch''; END IF;
 ELSIF NEW.revision<>1 THEN RAISE EXCEPTION ''UC19 assignment starts at revision one''; END IF;
 IF NEW.state=''ACTIVE'' THEN PERFORM public.cc_check_student(NEW.committee_id,NEW.proposal_id,NEW.term_student_id,NEW.context); END IF;
 RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cc_final_structure_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE c RECORD; a RECORD; n INTEGER; policy JSONB;
BEGIN
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.revision=0 THEN RETURN NULL; END IF; -- only legacy may be deleted in the same transaction
  RAISE EXCEPTION ''UC19 deferred committee is not verifiable'' USING ERRCODE=''23514'';
 END IF;
 IF c.revision>0 AND c.state=''FINALIZED'' THEN
  SELECT count(*) INTO n FROM public."COMMITTEE_MEMBER" WHERE committee_id=c.id;
  IF n<3 OR n>5 THEN RAISE EXCEPTION ''UC19 finalized committee requires 3 to 5 members''; END IF;
  IF EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" m LEFT JOIN public."LECTURER" l ON l.id=m.lecturer_id
    LEFT JOIN public."USER_ACCOUNT" u ON u.id=l.user_id
    WHERE m.committee_id=c.id AND (l.id IS NULL OR NOT l.is_active OR u.status IS DISTINCT FROM ''ACTIVE''
      OR NOT EXISTS(SELECT 1 FROM public."TERM_LECTURER" r WHERE r.lecturer_id=l.id AND r.term_id=c.term_id)))
  THEN RAISE EXCEPTION ''UC19 finalized members must remain active in the term roster''; END IF;
  SELECT value::jsonb INTO policy FROM public."TERM_PARAMETER" WHERE term_id=c.term_id AND key=''UC19_POLICY'';
  -- JSON null is not an approved value. Validate shape before any casts;
  -- counts remain policy values, not assumptions about academic roles.
  IF (policy->>''status''=''APPROVED''
    AND jsonb_typeof(policy->''approvedAt'')=''string''
    AND jsonb_typeof(policy->''chairCount'')=''number'' AND policy->>''chairCount'' ~ ''^[0-9]+$''
    AND jsonb_typeof(policy->''secretaryCount'')=''number'' AND policy->>''secretaryCount'' ~ ''^[0-9]+$''
    AND jsonb_typeof(policy->''allowEmptyFinalization'')=''boolean'') IS NOT TRUE
  THEN RAISE EXCEPTION ''UC19 approved role policy shape required''; END IF;
  IF ((policy->>''approvedAt'')::timestamptz<=now()
   AND (SELECT count(*) FROM public."COMMITTEE_MEMBER" WHERE committee_id=c.id AND role=''CHAIR'')=(policy->>''chairCount'')::integer
   AND (SELECT count(*) FROM public."COMMITTEE_MEMBER" WHERE committee_id=c.id AND role=''SECRETARY'')=(policy->>''secretaryCount'')::integer) IS NOT TRUE
  THEN RAISE EXCEPTION ''UC19 approved role policy required''; END IF;
  IF NOT (policy->>''allowEmptyFinalization'')::boolean AND NOT EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=c.id AND state=''ACTIVE'')
  THEN RAISE EXCEPTION ''UC19 policy requires students before finalization''; END IF;
  FOR a IN SELECT * FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=c.id AND state=''ACTIVE'' LOOP
   PERFORM public.cc_check_student(c.id,a.proposal_id,a.term_student_id,a.context);
  END LOOP;
 END IF;
 RETURN NULL;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."DEFENSE_COMMITTEE"') AND t.tgname='cc_transition_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='cc_transition_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."COMMITTEE_MEMBER"') AND t.tgname='cc_member_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='cc_member_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND t.tgname='cca_transition_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='cca_transition_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."DEFENSE_COMMITTEE"') AND t.tgname='cc_final_structure_guard' AND t.tgtype::integer=21 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='cc_final_structure_guard' AND t.tgdeferrable=true AND t.tginitdeferred=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass('public."DEFENSE_COMMITTEE"') AND indexrelid=to_regclass('public."DEFENSE_COMMITTEE_term_id_code_key"') AND indisvalid AND indisready AND indisunique=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_index_invalid
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND indexrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT_term_student_id_key"') AND indisvalid AND indisready AND indisunique=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_index_invalid
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND indexrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT_proposal_id_key"') AND indisvalid AND indisready AND indisunique=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_index_invalid
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND indexrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT_term_id_committee_id_state_idx"') AND indisvalid AND indisready AND indisunique=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_index_invalid
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='term_id')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='term_student_id')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='committee_id')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='revision')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='state')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='selected')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='context')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='created_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='updated_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='updated_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='finalized_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='REVIEWER_ASSIGNMENT' AND column_name='finalized_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."REVIEWER_ASSIGNMENT"') AND conname='rw_provenance_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rw_check_binding' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE advisor TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."TERM_STUDENT" s JOIN public."PROPOSAL" p ON p.student_id=s.student_id AND p.term_id=s.term_id
   JOIN public."TOPIC_WORKFLOW" w ON w."topicId"=p.topic_id AND w."termStudentId"=s.id AND w."termId"=s.term_id
   WHERE s.id=r.term_student_id AND s.term_id=r.term_id AND p.id=r.proposal_id)
 THEN RAISE EXCEPTION ''UC20 proposal/term/student mismatch''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE" c JOIN public."DEFENSE_COMMITTEE_ASSIGNMENT" a ON a.committee_id=c.id
   WHERE c.id=r.committee_id AND c.term_id=r.term_id AND c.state=''FINALIZED'' AND c.finalized_at<=now() AND c.finalized_by IS NOT NULL
   AND c.revision::text=r.context#>>''{committee,revision}'' AND c.context->>''contentHash''=r.context#>>''{committee,evidenceHash}''
   AND a.term_student_id=r.term_student_id AND a.proposal_id=r.proposal_id AND a.state=''ACTIVE''
   AND a.revision::text=r.context->>''committeeAssignmentRevision'' AND a.context->>''advisorHash''=r.context->>''advisorHash'')
 THEN RAISE EXCEPTION ''UC20 requires current finalized UC19 binding''; END IF;
 -- Reuses UC19 official-plan/latest-handover and ALL-member advisor conflict checks.
 PERFORM public.cc_check_student(r.committee_id,r.proposal_id,r.term_student_id,r.context);
 advisor:=r.context->>''advisorId'';
 IF r.selected AND r.reviewer_id=advisor THEN RAISE EXCEPTION ''UC20 reviewer cannot be current official advisor''; END IF;
 IF r.selected AND NOT EXISTS(SELECT 1 FROM public."LECTURER" l JOIN public."TERM_LECTURER" t ON t.lecturer_id=l.id
   WHERE l.id=r.reviewer_id AND l.is_active AND t.term_id=r.term_id)
 THEN RAISE EXCEPTION ''UC20 reviewer not active in term roster''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=r.created_by)
  OR NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=r.updated_by)
  OR (r.finalized_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=r.finalized_by))
 THEN RAISE EXCEPTION ''UC20 actor missing''; END IF;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rw_transition_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
BEGIN
 IF TG_OP=''DELETE'' THEN
  IF OLD.revision>0 THEN RAISE EXCEPTION ''UC20 retains rows/history; use explicit deselection''; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP=''UPDATE'' THEN
  IF OLD.revision=0 AND NEW.revision>0 THEN RAISE EXCEPTION ''UC20 legacy requires explicit reconciliation''; END IF;
  IF OLD.revision>0 AND (OLD.state=''FINALIZED'' OR NEW.revision<>OLD.revision+1 OR NEW.id<>OLD.id
   OR NEW.proposal_id<>OLD.proposal_id OR NEW.reviewer_id<>OLD.reviewer_id OR NEW.term_id IS DISTINCT FROM OLD.term_id
   OR NEW.term_student_id IS DISTINCT FROM OLD.term_student_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at)
  THEN RAISE EXCEPTION ''UC20 immutable owner/finalized group/revision''; END IF;
 END IF;
 IF TG_OP=''INSERT'' AND (NEW.revision<1 OR NEW.state IS DISTINCT FROM ''DRAFT'')
 THEN RAISE EXCEPTION ''UC20 new rows require positive revision and DRAFT''; END IF;
 IF NEW.revision=0 THEN RETURN NEW; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.term_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public."REVIEWER_ASSIGNMENT" WHERE proposal_id=NEW.proposal_id AND id<>NEW.id AND
   (revision=0 OR (state=''FINALIZED'' AND (TG_OP=''INSERT'' OR revision<>NEW.revision OR NEW.state<>''FINALIZED''
     OR updated_by IS DISTINCT FROM NEW.updated_by OR updated_at IS DISTINCT FROM NEW.updated_at))))
 THEN RAISE EXCEPTION ''UC20 cannot modify a legacy or finalized group''; END IF;
 IF TG_OP=''INSERT'' AND NEW.state IS DISTINCT FROM ''DRAFT'' THEN RAISE EXCEPTION ''UC20 starts as draft''; END IF;
 PERFORM public.rw_check_binding(NEW);
 RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rw_group_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE r public."REVIEWER_ASSIGNMENT"; v public."REVIEWER_ASSIGNMENT"; policy JSONB; n INTEGER; wanted INTEGER;
BEGIN
 SELECT * INTO r FROM public."REVIEWER_ASSIGNMENT" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.revision=0 THEN RETURN NULL; END IF;
  RAISE EXCEPTION ''UC20 deferred row is not verifiable'' USING ERRCODE=''23514'';
 END IF;
 IF r.revision=0 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public."REVIEWER_ASSIGNMENT" x WHERE x.proposal_id=r.proposal_id AND
   (x.revision<>r.revision OR x.state IS DISTINCT FROM r.state OR x.term_id IS DISTINCT FROM r.term_id
    OR x.term_student_id IS DISTINCT FROM r.term_student_id OR x.committee_id IS DISTINCT FROM r.committee_id
    OR x.context IS DISTINCT FROM r.context OR x.updated_by IS DISTINCT FROM r.updated_by OR x.updated_at IS DISTINCT FROM r.updated_at
    OR x.finalized_by IS DISTINCT FROM r.finalized_by OR x.finalized_at IS DISTINCT FROM r.finalized_at))
 THEN RAISE EXCEPTION ''UC20 group must advance atomically with one source/revision''; END IF;
 SELECT value::jsonb INTO policy FROM public."TERM_PARAMETER" WHERE term_id=r.term_id AND key=''UC20_POLICY'';
 IF policy IS NULL OR policy->>''status'' IS DISTINCT FROM ''APPROVED'' OR policy->>''version'' IS DISTINCT FROM r.context->>''policyVersion''
  OR NOT COALESCE((policy->>''approvedAt'')::timestamptz<=now(),false)
 THEN RAISE EXCEPTION ''UC20 approved policy required''; END IF;
 wanted:=(policy->>''reviewersPerStudent'')::integer;
 SELECT count(*) INTO n FROM public."REVIEWER_ASSIGNMENT" WHERE proposal_id=r.proposal_id AND selected;
 IF wanted IS NULL OR wanted<1 OR n>wanted OR (r.state=''FINALIZED'' AND n<>wanted)
 THEN RAISE EXCEPTION ''UC20 reviewer count violates approved policy''; END IF;
 FOR v IN SELECT * FROM public."REVIEWER_ASSIGNMENT" WHERE proposal_id=r.proposal_id LOOP
  PERFORM public.rw_check_binding(v);
  IF v.selected THEN
   IF EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" WHERE committee_id=r.committee_id AND lecturer_id=v.reviewer_id)
     AND COALESCE(policy->>''committeeMembership'',''PENDING_APPROVAL'')<>''ALLOW''
   THEN RAISE EXCEPTION ''UC20 committee/reviewer dual membership not permitted/approved''; END IF;
   IF COALESCE(policy->>''formerAdvisorRule'',''PENDING_APPROVAL'')<>''ALLOW'' AND EXISTS(
    SELECT 1 FROM public."PROPOSAL" p JOIN public."REGISTRATION" reg ON reg.student_id=p.student_id AND reg.term_id=p.term_id
    JOIN public."ADVISOR_ASSIGNMENT" aa ON aa.registration_id=reg.id
    JOIN public."ASSIGNMENT_PLAN" ap ON ap.id=aa.assignment_plan_id AND ap.status IN (''FINALIZED'',''PUBLISHED'')
    LEFT JOIN public."ASSIGNMENT_CHANGE" ch ON ch."assignmentId"=aa.id
    WHERE p.id=r.proposal_id AND (aa.advisor_id=v.reviewer_id OR ch."oldAdvisorId"=v.reviewer_id OR ch."newAdvisorId"=v.reviewer_id))
   THEN RAISE EXCEPTION ''UC20 former advisor rule not permitted/approved''; END IF;
  END IF;
 END LOOP;
 RETURN NULL;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."REVIEWER_ASSIGNMENT"') AND t.tgname='rw_transition_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='rw_transition_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."REVIEWER_ASSIGNMENT"') AND t.tgname='rw_group_guard' AND t.tgtype::integer=21 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='rw_group_guard' AND t.tgdeferrable=true AND t.tginitdeferred=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass('public."REVIEWER_ASSIGNMENT"') AND indexrelid=to_regclass('public."REVIEWER_ASSIGNMENT_term_id_term_student_id_idx"') AND indisvalid AND indisready AND indisunique=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_index_invalid
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND relrowsecurity)
 AND (SELECT count(*) FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND contype='f' AND convalidated)=6) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_UC19_new_table_RLS_or_FK_mismatch
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
