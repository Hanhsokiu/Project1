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
('202611090004_uc20_defense_reviewers','0b2908058248ee8c3e066d57871e03050a98d84e2aa382284f55b585eab91c53'),
('202611090005_uc21_defense_scheduling','08dfa2d05bd8f8ba28d18637b5e832e04e1410f6c5af7c68777838ed9a41054d'),
('202611090006_uc22_defense_reviewer_grading','252d4a363ba93d761a89ba267e3f4f0946d94fae8f78b859805681569879ddb4'),
('202611090007_uc23_defense_committee_grading','27c00f73f17b05e08a71d586a6e64f33ce6b6aec5337b1448fc79dd52ce10e84'),
('202611090008_uc24_defense_final_results','6a1f8328747a2780dd9d9bb25a542980113c01c1577eb7cb6d493d626d8e3f70')) e(name,sha)
 LEFT JOIN public."_prisma_migrations" m ON m.migration_name=e.name
 WHERE m.migration_name IS NULL OR m.checksum IS DISTINCT FROM e.sha OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL)
 AND (SELECT count(*) FROM public."_prisma_migrations")=25) AS uc_ok \gset
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
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='revision')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='state')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='local_date')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='session_type')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='timezone')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='ends_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='context')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='created_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='updated_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='updated_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='finalized_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='finalized_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='published_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='published_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_SESSION"') AND conname='sc_provenance_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sc_booking_mutex_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
BEGIN
 IF current_setting(''transaction_isolation'') IS DISTINCT FROM ''read committed''
 THEN RAISE EXCEPTION ''DEFENSE_SESSION writers require ReadCommitted before DML''; END IF;
 PERFORM pg_advisory_xact_lock(2117,21);
 RETURN NULL;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sc_transition_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
BEGIN
 -- The statement guard already holds the mutex; do not acquire it after a tuple.
 IF TG_OP=''DELETE'' THEN
  IF OLD.revision>0 THEN RAISE EXCEPTION ''UC21 keeps history; cancel draft explicitly''; END IF; RETURN OLD;
 END IF;
 IF TG_OP=''UPDATE'' THEN
  IF OLD.revision=0 AND NEW.revision>0 THEN RAISE EXCEPTION ''Legacy schedule requires reconciliation''; END IF;
  IF OLD.revision>0 THEN
   IF NEW.id<>OLD.id OR NEW.revision<>OLD.revision+1 OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.state=''CANCELLED''
   THEN RAISE EXCEPTION ''UC21 owner/revision/immutable cancellation''; END IF;
   IF OLD.state=''FINALIZED'' AND NOT (
     NEW.state=''FINALIZED'' AND OLD.published_at IS NULL AND OLD.published_by IS NULL AND NEW.published_at IS NOT NULL AND NEW.published_by IS NOT NULL
     AND NEW.finalized_at=OLD.finalized_at AND NEW.finalized_by=OLD.finalized_by AND NEW.committee_id=OLD.committee_id AND NEW.room_id=OLD.room_id
     AND NEW.scheduled_at=OLD.scheduled_at AND NEW.ends_at=OLD.ends_at AND NEW.duration_min=OLD.duration_min AND NEW.local_date=OLD.local_date
     AND NEW.session_type=OLD.session_type AND NEW.timezone=OLD.timezone AND NEW.context=OLD.context)
   THEN RAISE EXCEPTION ''UC21 finalized schedule only permits explicit publication''; END IF;
  END IF;
 END IF;
 IF NEW.revision=0 THEN RETURN NEW; END IF;
 IF current_setting(''transaction_isolation'')<>''read committed'' THEN RAISE EXCEPTION ''UC21 requires ReadCommitted under the global booking mutex''; END IF;
 IF TG_OP=''INSERT'' AND (NEW.revision<>1 OR NEW.state<>''DRAFT'') THEN RAISE EXCEPTION ''UC21 starts at draft revision one''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.created_by) OR NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.updated_by)
   OR (NEW.finalized_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.finalized_by))
   OR (NEW.published_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" WHERE id=NEW.published_by))
 THEN RAISE EXCEPTION ''UC21 actor missing''; END IF;
 RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sc_conflict_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE r public."DEFENSE_SESSION"; other public."DEFENSE_SESSION"; c public."DEFENSE_COMMITTEE"; policy JSONB; slot JSONB; a public."DEFENSE_COMMITTEE_ASSIGNMENT"; tid TEXT; n INTEGER;
BEGIN
 SELECT * INTO r FROM public."DEFENSE_SESSION" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.revision=0 THEN RETURN NULL; END IF;
  RAISE EXCEPTION ''UC21 deferred schedule is not verifiable'' USING ERRCODE=''23514'';
 END IF;
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=r.committee_id;
 IF NOT FOUND THEN RAISE EXCEPTION ''UC21 parent committee is not verifiable'' USING ERRCODE=''23514''; END IF;
 IF r.revision>0 AND r.state=''CANCELLED'' THEN RETURN NULL; END IF;
 IF r.revision>0 THEN
  IF c.state IS DISTINCT FROM ''FINALIZED'' OR c.revision::text IS DISTINCT FROM r.context#>>''{source,committeeRevision}''
    OR c.context->>''contentHash'' IS DISTINCT FROM r.context#>>''{source,committeeEvidenceHash}''
    OR c.id IS DISTINCT FROM r.context#>>''{source,committeeId}''
  THEN RAISE EXCEPTION ''UC21 needs current finalized committee binding''; END IF;
  tid:=c.term_id;
  SELECT value::jsonb INTO policy FROM public."TERM_PARAMETER" WHERE term_id=tid AND key=''UC21_POLICY'';
  IF policy IS NULL OR policy->>''status'' IS DISTINCT FROM ''APPROVED'' OR policy->>''version'' IS DISTINCT FROM r.context->>''policyVersion''
    OR NOT COALESCE((policy->>''approvedAt'')::timestamptz<=now(),false) OR policy->>''timezone'' IS DISTINCT FROM ''Asia/Ho_Chi_Minh''
    OR COALESCE(policy->>''reviewerAttendance'',''PENDING_APPROVAL'')=''PENDING_APPROVAL''
  THEN RAISE EXCEPTION ''UC21 approved policy required''; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(policy->''allowedDates'') d WHERE d=r.local_date)
    OR (r.scheduled_at AT TIME ZONE ''Asia/Ho_Chi_Minh'')::date::text<>r.local_date
    OR (r.ends_at AT TIME ZONE ''Asia/Ho_Chi_Minh'')::date::text<>r.local_date
  THEN RAISE EXCEPTION ''UC21 date/time mismatch''; END IF;
  IF NOT COALESCE((r.scheduled_at AT TIME ZONE ''Asia/Ho_Chi_Minh'')::time >= (policy#>>ARRAY[''periods'',r.session_type,''start''])::time,false)
    OR NOT COALESCE(r.ends_at+(policy->>''sessionBufferMin'')::integer*interval ''1 minute'' <=
       ((r.local_date||'' ''||(policy#>>ARRAY[''periods'',r.session_type,''end'']))::timestamp AT TIME ZONE ''Asia/Ho_Chi_Minh''),false)
  THEN RAISE EXCEPTION ''UC21 session outside approved morning/afternoon window''; END IF;
  IF NOT EXISTS(SELECT 1 FROM public."ROOM" room JOIN jsonb_array_elements(policy->''roomAccess'') access ON access->>''roomId''=room.id
    WHERE room.id=r.room_id AND room.capacity>=(policy->>''minRoomCapacity'')::integer AND (access->''departmentIds'') ? c.department_id)
  THEN RAISE EXCEPTION ''UC21 room not approved for department''; END IF;
  IF NOT EXISTS(SELECT 1 FROM public."THESIS_TERM" t JOIN public."TERM_PHASE" p ON p.term_id=t.id AND p.code=''DEFENSE''
    WHERE t.id=tid AND r.scheduled_at>=GREATEST(t.start_date,p.start_date) AND r.ends_at+(policy->>''sessionBufferMin'')::integer*interval ''1 minute''<=LEAST(t.end_date,p.end_date) AND NOT t.is_locked AND NOT p.is_locked)
  THEN RAISE EXCEPTION ''UC21 outside defense/term bounds''; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(r.context->''slots'');
  IF NOT COALESCE(jsonb_typeof(r.context#>''{booking,lecturers}'')=''array'',false)
    OR NOT COALESCE(jsonb_typeof(r.context#>''{booking,students}'')=''array'',false)
    OR r.context#>>''{booking,id}'' IS DISTINCT FROM r.id OR r.context#>>''{booking,roomId}'' IS DISTINCT FROM r.room_id
    OR r.context#>>''{booking,committeeId}'' IS DISTINCT FROM r.committee_id
    OR (r.context#>>''{booking,start}'')::numeric IS DISTINCT FROM extract(epoch FROM r.scheduled_at)*1000
    OR NOT COALESCE((r.context#>>''{booking,end}'')::numeric=extract(epoch FROM r.ends_at)*1000+(policy->>''sessionBufferMin'')::numeric*60000,false)
    OR n IS DISTINCT FROM jsonb_array_length(r.context#>''{booking,students}'')
  THEN RAISE EXCEPTION ''UC21 booking resources incomplete''; END IF;
  IF EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" m WHERE m.committee_id=c.id AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(r.context#>''{booking,lecturers}'') l WHERE l->>''lecturerId''=m.lecturer_id
      AND (l->>''start'')::numeric<=extract(epoch FROM r.scheduled_at)*1000 AND (l->>''end'')::numeric>=(r.context#>>''{booking,end}'')::numeric))
  THEN RAISE EXCEPTION ''UC21 must reserve every committee member''; END IF;
  IF n>(policy->>''maxStudentsPerSession'')::integer OR n<>(SELECT count(DISTINCT x->>''proposalId'') FROM jsonb_array_elements(r.context->''slots'') x)
    OR n<>(SELECT count(DISTINCT x->>''order'') FROM jsonb_array_elements(r.context->''slots'') x)
  THEN RAISE EXCEPTION ''UC21 student capacity/order/duplicate''; END IF;
  FOR slot IN SELECT * FROM jsonb_array_elements(r.context->''slots'') LOOP
    SELECT * INTO a FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=c.id AND term_student_id=slot->>''termStudentId'' AND proposal_id=slot->>''proposalId'' AND state=''ACTIVE'';
    IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public."TERM_STUDENT" ts WHERE ts.id=a.term_student_id AND ts.student_id=slot->>''studentId'' AND ts.term_id=tid)
    THEN RAISE EXCEPTION ''UC21 requires an owned active UC19 student assignment''; END IF;
    PERFORM public.cc_check_student(c.id,a.proposal_id,a.term_student_id,a.context);
    IF (slot->>''startAt'')::timestamptz<r.scheduled_at OR (slot->>''endAt'')::timestamptz>r.ends_at OR (slot->>''startAt'')::timestamptz>=(slot->>''endAt'')::timestamptz
    THEN RAISE EXCEPTION ''UC21 invalid slot range''; END IF;
    IF extract(epoch FROM ((slot->>''endAt'')::timestamptz-(slot->>''startAt'')::timestamptz)) IS DISTINCT FROM (policy->>''durationMin'')::numeric*60
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(policy#>ARRAY[''periods'',r.session_type,''breaks'']) br WHERE
        ((slot->>''startAt'')::timestamptz AT TIME ZONE ''Asia/Ho_Chi_Minh'')::time < (br->>''end'')::time
        AND (br->>''start'')::time < (((slot->>''endAt'')::timestamptz + (policy->>''bufferMin'')::integer*interval ''1 minute'') AT TIME ZONE ''Asia/Ho_Chi_Minh'')::time)
    THEN RAISE EXCEPTION ''UC21 slot duration/break policy mismatch''; END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.context#>''{booking,students}'') b WHERE b->>''proposalId''=slot->>''proposalId'' AND b->>''studentId''=slot->>''studentId''
      AND (b->>''start'')::numeric=extract(epoch FROM (slot->>''startAt'')::timestamptz)*1000
      AND (b->>''end'')::numeric=extract(epoch FROM (slot->>''endAt'')::timestamptz)*1000+(policy->>''bufferMin'')::numeric*60000)
    THEN RAISE EXCEPTION ''UC21 student booking missing''; END IF;
  END LOOP;
  IF r.published_at IS NOT NULL AND (r.state<>''FINALIZED'' OR r.published_at<(policy->>''publishNotBefore'')::timestamptz)
  THEN RAISE EXCEPTION ''UC21 publication not permitted yet''; END IF;
 END IF;
 -- Includes ALL terms, and stale/draft reservations. Legacy durations are not guessed.
 FOR other IN SELECT * FROM public."DEFENSE_SESSION" WHERE id<>r.id AND (revision=0 OR state<>''CANCELLED'') LOOP
  IF r.revision=0 OR other.revision=0 THEN
   IF r.room_id=other.room_id OR r.committee_id=other.committee_id OR EXISTS(
     SELECT 1 FROM public."COMMITTEE_MEMBER" m JOIN public."COMMITTEE_MEMBER" x ON x.lecturer_id=m.lecturer_id WHERE m.committee_id=r.committee_id AND x.committee_id=other.committee_id)
   THEN RAISE EXCEPTION ''Legacy shared room/committee/member schedule requires reconciliation''; END IF;
   IF other.revision=0 AND r.revision>0 AND EXISTS(SELECT 1 FROM public."COMMITTEE_STUDENT" cs JOIN public."PROPOSAL" p ON p.id=cs.proposal_id
     JOIN jsonb_array_elements(r.context->''slots'') s ON s->>''proposalId''=p.id OR s->>''studentId''=p.student_id WHERE cs.session_id=other.id)
   THEN RAISE EXCEPTION ''Legacy student schedule requires reconciliation''; END IF;
   CONTINUE;
  END IF;
  IF (r.context#>>''{booking,start}'')::numeric<(other.context#>>''{booking,end}'')::numeric AND (other.context#>>''{booking,start}'')::numeric<(r.context#>>''{booking,end}'')::numeric
    AND (r.room_id=other.room_id OR r.committee_id=other.committee_id)
  THEN RAISE EXCEPTION ''UC21 overlapping room/committee''; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.context#>''{booking,lecturers}'') l CROSS JOIN jsonb_array_elements(other.context#>''{booking,lecturers}'') m
    WHERE l->>''lecturerId''=m->>''lecturerId'' AND (l->>''start'')::numeric<(m->>''end'')::numeric AND (m->>''start'')::numeric<(l->>''end'')::numeric)
  THEN RAISE EXCEPTION ''UC21 overlapping lecturer/reviewer''; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.context#>''{booking,students}'') s CROSS JOIN jsonb_array_elements(other.context#>''{booking,students}'') t
    WHERE s->>''proposalId''=t->>''proposalId'' OR (s->>''studentId''=t->>''studentId'' AND (s->>''start'')::numeric<(t->>''end'')::numeric AND (t->>''start'')::numeric<(s->>''end'')::numeric))
  THEN RAISE EXCEPTION ''UC21 duplicate proposal/overlapping student''; END IF;
 END LOOP;
 RETURN NULL;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."DEFENSE_SESSION"') AND t.tgname='sc_booking_mutex_guard' AND t.tgtype::integer=30 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='sc_booking_mutex_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."DEFENSE_SESSION"') AND t.tgname='sc_transition_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='sc_transition_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."DEFENSE_SESSION"') AND t.tgname='sc_conflict_guard' AND t.tgtype::integer=21 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='sc_conflict_guard' AND t.tgdeferrable=true AND t.tginitdeferred=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."SCORE_ENTRY"') AND conname='final_advisor_score_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."SCORE_ENTRY"') AND conname='rg_record_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rg_score_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE a public."REVIEWER_ASSIGNMENT"; actor TEXT;
BEGIN
 -- Existing legacy rows retain baseline maintenance, never become UC22.
 IF OLD.revision=0 AND OLD.report_version_id IS NULL AND OLD.context IS NULL AND TG_OP IN (''UPDATE'',''DELETE'') THEN
  IF TG_OP=''DELETE'' THEN RETURN OLD; END IF;
  IF NEW.revision=0 AND NEW.report_version_id IS NULL AND NEW.context IS NULL AND NEW.comment IS NULL
    AND NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.proposal_id IS NOT DISTINCT FROM OLD.proposal_id
    AND NEW.scorer_id IS NOT DISTINCT FROM OLD.scorer_id AND NEW.role IS NOT DISTINCT FROM OLD.role
  THEN RETURN NEW; END IF;
  IF OLD.role=''REVIEWER'' THEN RAISE EXCEPTION ''Cannot adopt a legacy reviewer grade''; END IF;
 END IF;
 IF TG_OP=''DELETE'' THEN
  IF OLD.role=''REVIEWER'' THEN RAISE EXCEPTION ''Retain reviewer grade/history, including legacy''; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP=''UPDATE'' AND OLD.role=''REVIEWER'' THEN
  IF OLD.context->>''kind'' IS DISTINCT FROM ''UC22'' OR OLD.is_locked OR NEW.id<>OLD.id OR NEW.proposal_id<>OLD.proposal_id OR NEW.scorer_id<>OLD.scorer_id OR NEW.role<>OLD.role
  THEN RAISE EXCEPTION ''Legacy/finalized reviewer grade or owner is immutable''; END IF;
  IF NOT (NEW.revision=OLD.revision+1 OR (NEW.revision=OLD.revision AND NEW.is_locked AND NOT OLD.is_locked
   AND (to_jsonb(NEW)-''is_locked''-''updated_at'')=(to_jsonb(OLD)-''is_locked''-''updated_at'')))
  THEN RAISE EXCEPTION ''Reviewer grade CAS/lock revision invalid''; END IF;
 END IF;
 IF NEW.role<>''REVIEWER'' THEN RETURN NEW; END IF;
 IF NEW.context->>''kind'' IS DISTINCT FROM ''UC22'' THEN RAISE EXCEPTION ''No new legacy reviewer grades''; END IF;
 IF TG_OP=''UPDATE'' AND OLD.role<>''REVIEWER'' THEN RAISE EXCEPTION ''Cannot turn another score role into REVIEWER''; END IF;
 IF TG_OP=''INSERT'' AND NEW.revision<>1 THEN RAISE EXCEPTION ''Reviewer grade starts at revision 1''; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.context->>''termId'' FOR UPDATE;
 SELECT * INTO a FROM public."REVIEWER_ASSIGNMENT" WHERE id=NEW.context#>>''{command,assignmentId}'' FOR UPDATE;
 IF NOT FOUND OR a.proposal_id<>NEW.proposal_id OR a.reviewer_id<>NEW.scorer_id OR a.term_id IS DISTINCT FROM NEW.context->>''termId''
  OR a.term_student_id IS DISTINCT FROM NEW.context->>''termStudentId'' OR a.state IS DISTINCT FROM ''FINALIZED'' OR a.selected IS DISTINCT FROM true
  OR a.revision::text IS DISTINCT FROM NEW.context#>>''{command,assignmentRevision}''
  OR a.context->>''evidenceHash'' IS DISTINCT FROM NEW.context#>>''{command,assignmentEvidenceHash}''
 THEN RAISE EXCEPTION ''Reviewer grade requires finalized matching assignment''; END IF;
 PERFORM public.rw_check_binding(a);
 actor:=NEW.context->>''updatedBy'';
 IF NOT EXISTS(SELECT 1 FROM public."LECTURER" l JOIN public."USER_ACCOUNT" u ON u.id=l.user_id JOIN public."USER_ROLE" ur ON ur.user_id=u.id JOIN public."ROLE" r ON r.id=ur.role_id
  WHERE l.id=NEW.scorer_id AND l.is_active AND u.id=actor AND u.status=''ACTIVE'' AND r.name=''LECTURER'')
 THEN RAISE EXCEPTION ''Reviewer grade actor must be active actual lecturer''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION" v JOIN public."FINAL_REPORT" f ON f.id=v.report_id JOIN public."FILE_ASSET" b ON b.id=v.file_asset_id
  WHERE v.id=NEW.report_version_id AND f.proposal_id=NEW.proposal_id AND b.state=''READY'' AND b.kind=''REPORT'' AND b."mimeType"=''application/pdf''
  AND b.checksum=NEW.context#>>''{command,reportChecksum}'' AND v.sequence=(SELECT max(v2.sequence) FROM public."FINAL_REPORT_VERSION" v2 WHERE v2.report_id=f.id))
 THEN RAISE EXCEPTION ''Reviewer PDF version/checksum not current''; END IF;
 RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rg_commit_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE s public."SCORE_ENTRY";
BEGIN
 SELECT * INTO s FROM public."SCORE_ENTRY" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.role=''REVIEWER'' AND NEW.context->>''kind''=''UC22'' THEN
   RAISE EXCEPTION ''Reviewer deferred score is not verifiable'' USING ERRCODE=''23514'';
  END IF;
  RETURN NULL; -- unrelated baseline row deleted in the same transaction
 END IF;
 IF s.role=''REVIEWER'' AND s.context->>''kind''=''UC22'' THEN
  IF s.is_locked IS DISTINCT FROM (s.context->>''finalizedAt'' IS NOT NULL)
   OR (s.is_locked AND (s.total_score IS NULL OR s.context->>''finalizedBy'' IS DISTINCT FROM s.context->>''updatedBy''
    OR (s.context->>''finalizedAt'')::timestamptz>clock_timestamp()))
   OR NOT EXISTS(SELECT 1 FROM public."AUDIT_LOG" e WHERE e.resource=''defense-reviewer-grade'' AND e.resource_id=s.id
      AND e.user_id=s.context->>''updatedBy'' AND e.new_value->>''revision''=s.revision::text
      AND e.action=CASE WHEN s.is_locked THEN ''REVIEWER_GRADE_FINALIZED'' ELSE ''REVIEWER_GRADE_SAVED'' END)
  THEN RAISE EXCEPTION ''Reviewer grade committed state/audit invalid''; END IF;
 END IF;
 RETURN NULL;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rg_detail_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE p public."SCORE_ENTRY"; previous public."SCORE_ENTRY";
BEGIN
 IF TG_OP=''UPDATE'' AND NEW.score_entry_id<>OLD.score_entry_id THEN
  SELECT * INTO previous FROM public."SCORE_ENTRY" WHERE id=OLD.score_entry_id FOR UPDATE;
  IF previous.role=''REVIEWER'' THEN RAISE EXCEPTION ''Cannot transfer reviewer details''; END IF;
 END IF;
 SELECT * INTO p FROM public."SCORE_ENTRY" WHERE id=CASE WHEN TG_OP=''DELETE'' THEN OLD.score_entry_id ELSE NEW.score_entry_id END FOR UPDATE;
 IF NOT FOUND THEN
  IF TG_OP=''DELETE'' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF; -- parent legacy FK cascade only
  RAISE EXCEPTION ''Reviewer detail parent is not verifiable'' USING ERRCODE=''23514'';
 END IF;
 IF p.role=''REVIEWER'' THEN
  IF p.revision=0 AND p.report_version_id IS NULL AND p.context IS NULL THEN
   IF TG_OP=''DELETE'' THEN RETURN OLD; END IF;
   RETURN NEW; -- baseline constraints/FKs still apply; no conversion to official grade
  END IF;
  IF p.is_locked OR p.context->>''kind'' IS DISTINCT FROM ''UC22'' THEN RAISE EXCEPTION ''Reviewer details finalized/legacy''; END IF;
  IF TG_OP=''UPDATE'' AND NEW.score_entry_id<>OLD.score_entry_id THEN RAISE EXCEPTION ''Cannot transfer details to reviewer grade''; END IF;
  IF TG_OP<>''DELETE'' AND (NEW.score<0 OR NEW.score>10 OR NOT EXISTS(SELECT 1 FROM public."RUBRIC_CRITERIA" r WHERE r.id=NEW.rubric_criteria_id AND r.term_id=p.context->>''termId'' AND NEW.score<=r.max_score)) THEN RAISE EXCEPTION ''Reviewer criterion mismatch''; END IF;
 END IF;
 IF TG_OP=''DELETE'' THEN RETURN OLD; END IF; RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."SCORE_ENTRY"') AND t.tgname='rg_score_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='rg_score_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."SCORE_ENTRY"') AND t.tgname='rg_commit_guard' AND t.tgtype::integer=21 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='rg_commit_guard' AND t.tgdeferrable=true AND t.tginitdeferred=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."SCORE_DETAIL"') AND t.tgname='rg_detail_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='rg_detail_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."SCORE_ENTRY"') AND conname='final_advisor_score_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."SCORE_ENTRY"') AND conname='cg_record_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cg_score_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE c public."DEFENSE_COMMITTEE"; a public."DEFENSE_COMMITTEE_ASSIGNMENT"; d public."DEFENSE_SESSION";
BEGIN
 -- Preserve maintenance of existing genuine legacy rows without adopting them.
 IF OLD.revision=0 AND OLD.report_version_id IS NULL AND OLD.context IS NULL AND TG_OP IN (''UPDATE'',''DELETE'') THEN
  IF TG_OP=''DELETE'' THEN RETURN OLD; END IF;
  IF NEW.revision=0 AND NEW.report_version_id IS NULL AND NEW.context IS NULL AND NEW.comment IS NULL
    AND NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.proposal_id IS NOT DISTINCT FROM OLD.proposal_id
    AND NEW.scorer_id IS NOT DISTINCT FROM OLD.scorer_id AND NEW.role IS NOT DISTINCT FROM OLD.role
  THEN RETURN NEW; END IF;
  IF OLD.role IN (''COMMITTEE_MEMBER'',''COMMITTEE_CHAIR'') THEN RAISE EXCEPTION ''Cannot adopt a legacy committee grade''; END IF;
 END IF;
 IF TG_OP=''DELETE'' THEN
  IF OLD.role IN (''COMMITTEE_MEMBER'',''COMMITTEE_CHAIR'') THEN RAISE EXCEPTION ''Retain committee scores/history, including legacy''; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP=''UPDATE'' AND OLD.role IN (''COMMITTEE_MEMBER'',''COMMITTEE_CHAIR'') THEN
  IF OLD.context->>''kind'' IS DISTINCT FROM ''UC23'' OR OLD.is_locked OR NEW.id<>OLD.id OR NEW.proposal_id<>OLD.proposal_id OR NEW.scorer_id<>OLD.scorer_id OR NEW.role<>OLD.role
   OR NEW.context->>''bindingHash'' IS DISTINCT FROM OLD.context->>''bindingHash''
  THEN RAISE EXCEPTION ''Committee grade owner/final/legacy/binding immutable''; END IF;
  IF NOT(NEW.revision=OLD.revision+1 OR (NEW.revision=OLD.revision AND NEW.is_locked AND NOT OLD.is_locked
   AND (to_jsonb(NEW)-''is_locked''-''updated_at'')=(to_jsonb(OLD)-''is_locked''-''updated_at'')))
  THEN RAISE EXCEPTION ''Committee grade CAS revision invalid''; END IF;
 END IF;
 IF NEW.role NOT IN (''COMMITTEE_MEMBER'',''COMMITTEE_CHAIR'') THEN RETURN NEW; END IF;
 IF NEW.role<>''COMMITTEE_MEMBER'' OR NEW.context->>''kind'' IS DISTINCT FROM ''UC23'' THEN RAISE EXCEPTION ''No new legacy committee scores''; END IF;
 IF TG_OP=''UPDATE'' AND OLD.role NOT IN (''COMMITTEE_MEMBER'',''COMMITTEE_CHAIR'') THEN RAISE EXCEPTION ''Cannot convert ADVISOR/REVIEWER score''; END IF;
 IF TG_OP=''INSERT'' AND NEW.revision<>1 THEN RAISE EXCEPTION ''Committee score starts at revision 1''; END IF;
 IF EXISTS(SELECT 1 FROM public."SCORE_ENTRY" e WHERE e.proposal_id=NEW.proposal_id AND e.scorer_id=NEW.scorer_id AND e.role IN (''COMMITTEE_MEMBER'',''COMMITTEE_CHAIR'') AND e.id<>NEW.id)
 THEN RAISE EXCEPTION ''Existing committee sheet requires reconciliation, not role duplication''; END IF;
 PERFORM id FROM public."THESIS_TERM" WHERE id=NEW.context->>''termId'' FOR UPDATE;
 SELECT * INTO c FROM public."DEFENSE_COMMITTEE" WHERE id=NEW.context->>''committeeId'' FOR UPDATE;
 IF NOT FOUND OR c.term_id IS DISTINCT FROM NEW.context->>''termId'' OR c.state IS DISTINCT FROM ''FINALIZED''
  OR c.revision::text IS DISTINCT FROM NEW.context#>>''{command,committeeRevision}''
  OR c.context->>''contentHash'' IS DISTINCT FROM NEW.context#>>''{command,committeeEvidenceHash}''
 THEN RAISE EXCEPTION ''Committee grade requires finalized committee binding''; END IF;
 SELECT * INTO a FROM public."DEFENSE_COMMITTEE_ASSIGNMENT" WHERE committee_id=c.id AND proposal_id=NEW.proposal_id AND term_student_id=NEW.context->>''termStudentId'' AND state=''ACTIVE'' FOR UPDATE;
 IF NOT FOUND OR a.revision::text IS DISTINCT FROM NEW.context#>>''{command,assignmentRevision}'' THEN RAISE EXCEPTION ''Student not currently assigned to committee''; END IF;
 PERFORM public.cc_check_student(c.id,NEW.proposal_id,a.term_student_id,a.context);
 IF NOT EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" m JOIN public."LECTURER" l ON l.id=m.lecturer_id JOIN public."USER_ACCOUNT" u ON u.id=l.user_id
  JOIN public."USER_ROLE" ur ON ur.user_id=u.id JOIN public."ROLE" r ON r.id=ur.role_id
  WHERE m.committee_id=c.id AND m.lecturer_id=NEW.scorer_id AND m.role=NEW.context->>''memberRole'' AND l.is_active
   AND u.status=''ACTIVE'' AND u.id=NEW.context->>''updatedBy'' AND r.name=''LECTURER'')
 THEN RAISE EXCEPTION ''Committee actor must be the actual active member''; END IF;
 SELECT * INTO d FROM public."DEFENSE_SESSION" WHERE id=NEW.context#>>''{schedule,sessionId}'' FOR UPDATE;
 IF NOT FOUND OR d.committee_id<>c.id OR d.state IS DISTINCT FROM ''FINALIZED''
  OR d.revision::text IS DISTINCT FROM NEW.context#>>''{schedule,revision}''
  OR d.context->>''evidenceHash'' IS DISTINCT FROM NEW.context#>>''{schedule,evidenceHash}''
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.context->''slots'') x WHERE x->>''termStudentId''=a.term_student_id AND x->>''proposalId''=NEW.proposal_id)
 THEN RAISE EXCEPTION ''Committee grade schedule binding not current''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION" v JOIN public."FINAL_REPORT" f ON f.id=v.report_id JOIN public."FILE_ASSET" b ON b.id=v.file_asset_id
  WHERE v.id=NEW.report_version_id AND f.proposal_id=NEW.proposal_id AND b.kind=''REPORT'' AND b.state=''READY'' AND b."mimeType"=''application/pdf''
   AND b.checksum=NEW.context#>>''{command,reportChecksum}'' AND v.sequence=(SELECT max(v2.sequence) FROM public."FINAL_REPORT_VERSION" v2 WHERE v2.report_id=f.id))
 THEN RAISE EXCEPTION ''Committee grade PDF binding not current''; END IF;
 RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cg_detail_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE p public."SCORE_ENTRY"; previous public."SCORE_ENTRY";
BEGIN
 IF TG_OP=''UPDATE'' AND NEW.score_entry_id<>OLD.score_entry_id THEN
  SELECT * INTO previous FROM public."SCORE_ENTRY" WHERE id=OLD.score_entry_id FOR UPDATE;
  IF previous.role IN (''COMMITTEE_MEMBER'',''COMMITTEE_CHAIR'') THEN RAISE EXCEPTION ''Cannot transfer committee detail''; END IF;
 END IF;
 SELECT * INTO p FROM public."SCORE_ENTRY" WHERE id=CASE WHEN TG_OP=''DELETE'' THEN OLD.score_entry_id ELSE NEW.score_entry_id END FOR UPDATE;
 IF NOT FOUND THEN
  IF TG_OP=''DELETE'' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
  RAISE EXCEPTION ''Committee detail parent is not verifiable'' USING ERRCODE=''23514'';
 END IF;
 IF p.role IN (''COMMITTEE_MEMBER'',''COMMITTEE_CHAIR'') THEN
  IF p.revision=0 AND p.report_version_id IS NULL AND p.context IS NULL THEN
   IF TG_OP=''DELETE'' THEN RETURN OLD; END IF;
   RETURN NEW;
  END IF;
  IF p.is_locked OR p.context->>''kind'' IS DISTINCT FROM ''UC23'' THEN RAISE EXCEPTION ''Committee details immutable for legacy/finalized''; END IF;
  IF TG_OP=''UPDATE'' AND NEW.score_entry_id<>OLD.score_entry_id THEN RAISE EXCEPTION ''Cannot move other details into committee sheet''; END IF;
  IF TG_OP<>''DELETE'' AND (NEW.score<0 OR NEW.score>10 OR NOT EXISTS(SELECT 1 FROM public."RUBRIC_CRITERIA" r WHERE r.id=NEW.rubric_criteria_id AND r.term_id=p.context->>''termId'' AND NEW.score<=r.max_score))
  THEN RAISE EXCEPTION ''Committee criterion mismatch''; END IF;
 END IF;
 IF TG_OP=''DELETE'' THEN RETURN OLD; END IF; RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cg_commit_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE s public."SCORE_ENTRY";
BEGIN
 SELECT * INTO s FROM public."SCORE_ENTRY" WHERE id=NEW.id;
 IF NOT FOUND THEN
  IF NEW.role=''COMMITTEE_MEMBER'' AND NEW.context->>''kind''=''UC23'' THEN
   RAISE EXCEPTION ''Committee deferred score is not verifiable'' USING ERRCODE=''23514'';
  END IF;
  RETURN NULL; -- unrelated baseline row deleted in the same transaction
 END IF;
 IF s.role=''COMMITTEE_MEMBER'' AND s.context->>''kind''=''UC23'' THEN
  IF s.is_locked IS DISTINCT FROM (s.context->>''finalizedAt'' IS NOT NULL)
   OR (s.is_locked AND (s.total_score IS NULL OR s.context->>''finalizedBy'' IS DISTINCT FROM s.context->>''updatedBy'' OR (s.context->>''finalizedAt'')::timestamptz>clock_timestamp()))
   OR NOT EXISTS(SELECT 1 FROM public."AUDIT_LOG" e WHERE e.resource=''defense-committee-grade'' AND e.resource_id=s.id AND e.user_id=s.context->>''updatedBy''
     AND e.new_value->>''revision''=s.revision::text AND e.action=CASE WHEN s.is_locked THEN ''COMMITTEE_GRADE_FINALIZED'' ELSE ''COMMITTEE_GRADE_SAVED'' END)
  THEN RAISE EXCEPTION ''Committee committed state/audit invalid''; END IF;
 END IF;
 RETURN NULL;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."SCORE_ENTRY"') AND t.tgname='cg_score_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='cg_score_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."SCORE_DETAIL"') AND t.tgname='cg_detail_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='cg_detail_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."SCORE_ENTRY"') AND t.tgname='cg_commit_guard' AND t.tgtype::integer=21 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='cg_commit_guard' AND t.tgdeferrable=true AND t.tginitdeferred=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT' AND column_name='revision')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT' AND column_name='state')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT' AND column_name='context')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT' AND column_name='is_locked')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT' AND column_name='finalized_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT' AND column_name='finalized_at')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='FINAL_RESULT' AND column_name='published_by')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_column_missing
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."FINAL_RESULT"') AND conname='fr_record_valid' AND convalidated)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_constraint_missing_or_unvalidated
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='fr_guard' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE src jsonb; c jsonb; role_name text; actor text;
BEGIN
 -- Preserve ordinary maintenance of actual baseline results, never adopt them.
 IF TG_OP IN (''UPDATE'',''DELETE'') AND OLD.revision=0 THEN
  IF TG_OP=''DELETE'' THEN RETURN OLD; END IF;
  IF NEW.revision=0 AND NEW.state=''LEGACY_UNVERIFIED'' AND NEW.context IS NULL AND NOT NEW.is_locked
    AND NEW.finalized_by IS NULL AND NEW.finalized_at IS NULL AND NEW.published_by IS NULL
    AND NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.proposal_id IS NOT DISTINCT FROM OLD.proposal_id
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION ''UC24 legacy results require separate reconciliation, not adoption'';
 END IF;
 IF TG_OP=''DELETE'' THEN RAISE EXCEPTION ''UC24 history immutable''; END IF;
 IF TG_OP=''UPDATE'' THEN
  IF OLD.revision=0 OR OLD.state=''PUBLISHED'' OR NEW.revision<>OLD.revision+1 OR NEW.proposal_id<>OLD.proposal_id OR NEW.id<>OLD.id THEN RAISE EXCEPTION ''UC24 legacy/identity/revision/immutable conflict''; END IF;
  IF OLD.state=''FINALIZED'' AND (NEW.state<>''PUBLISHED'' OR
   (to_jsonb(NEW)-ARRAY[''revision'',''state'',''is_published'',''published_by'',''published_at'',''updated_at'']) IS DISTINCT FROM
   (to_jsonb(OLD)-ARRAY[''revision'',''state'',''is_published'',''published_by'',''published_at'',''updated_at''])) THEN RAISE EXCEPTION ''UC24 finalized snapshot immutable''; END IF;
  IF OLD.state=''CONFIRMING'' AND (NEW.state NOT IN (''CONFIRMING'',''FINALIZED'') OR NEW.context->>''evidenceHash''<>OLD.context->>''evidenceHash''
    OR NEW.context->''policy'' IS DISTINCT FROM OLD.context->''policy'' OR NEW.context->''calculation'' IS DISTINCT FROM OLD.context->''calculation''
    OR NEW.context->''evidence'' IS DISTINCT FROM OLD.context->''evidence'') THEN RAISE EXCEPTION ''UC24 cannot rebind source''; END IF;
 ELSE
  IF NEW.revision<>1 OR NEW.state NOT IN (''CONFIRMING'',''FINALIZED'') THEN RAISE EXCEPTION ''UC24 first transition invalid''; END IF;
 END IF;
 IF jsonb_typeof(NEW.context->''evidence''->''sources'') IS DISTINCT FROM ''array''
   OR jsonb_typeof(NEW.context->''policy''->''confirmation''->''roles'') IS DISTINCT FROM ''array''
   OR jsonb_typeof(NEW.context->''confirmations'') IS DISTINCT FROM ''array''
 THEN RAISE EXCEPTION ''UC24 source/confirmation provenance arrays required''; END IF;
 IF (NEW.context#>>''{policy,confirmation,scope}''=''STUDENT''
   AND NEW.context#>>''{policy,confirmation,rule}''=''ONE_PER_ROLE''
   AND jsonb_typeof(NEW.context#>''{policy,confirmation,distinctActors}'')=''boolean''
   AND jsonb_typeof(NEW.context#>''{policy,confirmation,reasonRequired}'')=''boolean''
   AND jsonb_typeof(NEW.context#>''{policy,separation,finalizerNotConfirmer}'')=''boolean''
   AND jsonb_typeof(NEW.context#>''{policy,separation,publisherNotFinalizer}'')=''boolean'') IS NOT TRUE
 THEN RAISE EXCEPTION ''UC24 explicit confirmation/separation policy required''; END IF;
 -- An explicitly empty role list is valid in the shared contract. Missing,
 -- duplicate or unsupported roles are not equivalent to that policy choice.
 IF jsonb_array_length(NEW.context#>''{policy,confirmation,roles}'')>3
   OR jsonb_array_length(NEW.context#>''{policy,confirmation,roles}'')<>(
     SELECT count(DISTINCT r) FROM jsonb_array_elements_text(NEW.context#>''{policy,confirmation,roles}'') r)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.context#>''{policy,confirmation,roles}'') r
     WHERE r IS NULL OR r NOT IN (''CHAIR'',''SECRETARY'',''MEMBER''))
 THEN RAISE EXCEPTION ''UC24 invalid confirmation roles''; END IF;
 IF jsonb_array_length(NEW.context->''evidence''->''sources'')=0
   OR jsonb_array_length(NEW.context->''evidence''->''sources'')<>(SELECT count(DISTINCT x->>''scoreEntryId'') FROM jsonb_array_elements(NEW.context->''evidence''->''sources'') x)
   OR jsonb_array_length(NEW.context->''confirmations'')<>(SELECT count(DISTINCT x->>''role'') FROM jsonb_array_elements(NEW.context->''confirmations'') x)
 THEN RAISE EXCEPTION ''UC24 missing/duplicate source or confirmation provenance''; END IF;
 IF (NEW.context#>>''{policy,confirmation,distinctActors}'')::boolean
   AND jsonb_array_length(NEW.context->''confirmations'')<>(SELECT count(DISTINCT x->>''actor'') FROM jsonb_array_elements(NEW.context->''confirmations'') x)
 THEN RAISE EXCEPTION ''UC24 confirmation actors must be distinct''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."TERM_PARAMETER" p WHERE p.term_id=NEW.context->>''termId'' AND p.key=''UC24_POLICY'' AND p.value::jsonb=NEW.context->''policy'') THEN RAISE EXCEPTION ''UC24 current approved policy required''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."PROPOSAL" p JOIN public."TERM_STUDENT" ts ON ts.student_id=p.student_id AND ts.term_id=p.term_id
  WHERE p.id=NEW.proposal_id AND ts.id=NEW.context->>''termStudentId'' AND p.term_id=NEW.context->>''termId'') THEN RAISE EXCEPTION ''UC24 owner mismatch''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."DEFENSE_COMMITTEE" dc WHERE dc.id=NEW.context->''evidence''->''committee''->>''committeeId''
  AND dc.term_id=NEW.context->>''termId'' AND dc.state=''FINALIZED'' AND dc.revision=(NEW.context->''evidence''->''committee''->>''revision'')::integer) THEN RAISE EXCEPTION ''UC24 committee not current''; END IF;
 FOR src IN SELECT * FROM jsonb_array_elements(NEW.context->''evidence''->''sources'') LOOP
  role_name=CASE src->>''source'' WHEN ''ADVISOR_UC17'' THEN ''ADVISOR'' WHEN ''REVIEWER'' THEN ''REVIEWER'' WHEN ''COMMITTEE'' THEN ''COMMITTEE_MEMBER'' ELSE NULL END;
  IF role_name IS NULL OR NOT EXISTS(SELECT 1 FROM public."SCORE_ENTRY" se JOIN public."FINAL_REPORT_VERSION" v ON v.id=se.report_version_id
   JOIN public."FILE_ASSET" fa ON fa.id=v.file_asset_id JOIN public."FINAL_REPORT" fr ON fr.id=v.report_id
   WHERE se.id=src->>''scoreEntryId'' AND se.proposal_id=NEW.proposal_id AND se.scorer_id=src->>''lecturerId'' AND se.role=role_name
    AND se.revision=(src->>''revision'')::integer AND se.total_score=(src->>''totalScore'')::numeric
    AND se.report_version_id=src->>''reportVersionId'' AND fa.checksum=src->>''reportChecksum'' AND fa.state=''READY''
    AND (role_name=''ADVISOR'' OR se.is_locked) AND fr.proposal_id=NEW.proposal_id
    AND NOT EXISTS(SELECT 1 FROM public."FINAL_REPORT_VERSION" later WHERE later.report_id=v.report_id AND later.sequence>v.sequence)) THEN RAISE EXCEPTION ''UC24 source changed''; END IF;
 END LOOP;
 FOR c IN SELECT * FROM jsonb_array_elements(NEW.context->''confirmations'') LOOP
  IF (NEW.context#>>''{policy,confirmation,reasonRequired}'')::boolean
    AND COALESCE(length(btrim(c->>''reason'')),0)=0
  THEN RAISE EXCEPTION ''UC24 confirmation reason required by policy''; END IF;
  IF c->>''evidenceHash'' IS DISTINCT FROM NEW.context->>''evidenceHash''
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.context->''policy''->''confirmation''->''roles'') r WHERE r=c->>''role'')
    OR NOT EXISTS(SELECT 1 FROM public."COMMITTEE_MEMBER" cm JOIN public."LECTURER" l ON l.id=cm.lecturer_id
      JOIN public."USER_ACCOUNT" u ON u.id=l.user_id
    WHERE cm.committee_id=NEW.context->''evidence''->''committee''->>''committeeId'' AND cm.lecturer_id=c->>''lecturerId''
      AND cm.role::text=c->>''role'' AND l.user_id=c->>''actor'' AND l.is_active AND u.status=''ACTIVE'')
  THEN RAISE EXCEPTION ''UC24 confirmation owner mismatch''; END IF;
 END LOOP;
 IF NEW.state IN (''FINALIZED'',''PUBLISHED'') AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.context->''policy''->''confirmation''->''roles'') role
  WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.context->''confirmations'') c WHERE c->>''role''=role)) THEN RAISE EXCEPTION ''UC24 incomplete confirmation''; END IF;
 RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='fr_commit_check' AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig @> ARRAY['row_security=off'] AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\r\n',E'\n')='
DECLARE latest public."FINAL_RESULT"; event public."AUDIT_LOG"; actor text;
BEGIN
 IF NEW.revision=0 THEN RETURN NULL; END IF; -- legacy never becomes an official UC24 result
 SELECT * INTO latest FROM public."FINAL_RESULT" WHERE id=NEW.id;
 IF NOT FOUND THEN RAISE EXCEPTION ''UC24 deferred result is not verifiable'' USING ERRCODE=''23514''; END IF;
 IF latest.revision<>NEW.revision THEN RETURN NEW; END IF;
 SELECT * INTO event FROM public."AUDIT_LOG" WHERE resource=''defense-result'' AND resource_id=NEW.id
  AND new_value->>''revision''=NEW.revision::text AND new_value->''context''=NEW.context ORDER BY created_at DESC LIMIT 1;
 actor=event.user_id;
 IF actor IS NULL OR event.action IS DISTINCT FROM (CASE NEW.state WHEN ''CONFIRMING'' THEN ''RESULT_CONFIRM'' WHEN ''FINALIZED'' THEN ''RESULT_FINALIZE'' ELSE ''RESULT_PUBLISH'' END)
 OR NOT EXISTS(SELECT 1 FROM public."IDEMPOTENCY_RECORD" k WHERE k."actorId"=actor AND k.method=''POST''
   AND k.route=''/defense-results/''||(NEW.context->>''termStudentId'')||''/''||CASE NEW.state WHEN ''CONFIRMING'' THEN ''confirm'' WHEN ''FINALIZED'' THEN ''finalize'' ELSE ''publish'' END
   AND k."payloadHash" ~ ''^[a-f0-9]{64}$'' AND k.result->>''finalResultId''=NEW.id
   AND k.result->>''revision''=NEW.revision::text AND k.result->>''state''=NEW.state)
 THEN RAISE EXCEPTION ''UC24 atomic audit/idempotency required''; END IF;
 IF NEW.state=''FINALIZED'' AND actor<>NEW.finalized_by OR NEW.state=''PUBLISHED'' AND actor<>NEW.published_by THEN RAISE EXCEPTION ''UC24 actor mismatch''; END IF;
 IF NEW.state=''FINALIZED'' AND (NEW.context#>>''{policy,separation,finalizerNotConfirmer}'')::boolean
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.context->''confirmations'') c WHERE c->>''actor''=actor)
 THEN RAISE EXCEPTION ''UC24 finalizer separation required by policy''; END IF;
 IF NEW.state=''PUBLISHED'' AND (NEW.context#>>''{policy,separation,publisherNotFinalizer}'')::boolean AND actor=NEW.finalized_by
 THEN RAISE EXCEPTION ''UC24 publisher separation required by policy''; END IF;
 RETURN NEW;
END ')) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_function_body_or_config_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."FINAL_RESULT"') AND t.tgname='fr_transition_guard' AND t.tgtype::integer=31 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='fr_guard' AND t.tgdeferrable=false AND t.tginitdeferred=false)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
SELECT (EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass('public."FINAL_RESULT"') AND t.tgname='fr_commit_guard' AND t.tgtype::integer=21 AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='fr_commit_check' AND t.tgdeferrable=true AND t.tginitdeferred=true)) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_trigger_binding_or_timing_mismatch
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
