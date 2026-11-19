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
('202611040002_weekly_progress','43ec562bbe9e73c762a9dc36ba220e376924a6ec190ad9dcd0cff3973b0b775f')) e(name,sha)
 LEFT JOIN public."_prisma_migrations" m ON m.migration_name=e.name
 WHERE m.migration_name IS NULL OR m.checksum IS DISTINCT FROM e.sha OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL)
 AND (SELECT count(*) FROM public."_prisma_migrations")=17) AS uc_ok \gset
\if :uc_ok
\else
\echo STOP_history_checksum_or_prefix_mismatch
SELECT 1/0 AS uc_checkpoint_failed;
\endif
COMMIT;
\echo PASS_metadata_checkpoint_only_behavioral_rehearsal_still_required
