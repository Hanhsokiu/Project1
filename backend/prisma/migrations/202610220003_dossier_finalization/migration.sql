-- Step 7 expand-only. No inferred ownership, academic profile, approval or receipt.
BEGIN;
SET LOCAL lock_timeout='10s';
ALTER TABLE public."DOSSIER_FINALIZATION" ADD COLUMN "printSnapshot" JSONB,
 ADD COLUMN "approvalDecisionId" VARCHAR(36);
ALTER TABLE public."DOSSIER_FINALIZATION" ADD CONSTRAINT step7_approval_reference
 FOREIGN KEY ("approvalDecisionId") REFERENCES public."PROPOSAL_REVIEW_DECISION"(id) ON DELETE RESTRICT;
CREATE TABLE public."DOSSIER_STUDENT_PROFILE" (
 "termStudentId" TEXT PRIMARY KEY REFERENCES public."TERM_STUDENT"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "className" TEXT NOT NULL CHECK (length(btrim("className"))>0),
 "majorName" TEXT NOT NULL CHECK (length(btrim("majorName"))>0),
 revision INTEGER NOT NULL DEFAULT 0 CHECK (revision>=0)
);
CREATE TABLE public."DOSSIER_PDF_CONTENT" (
 "assetId" VARCHAR(36) PRIMARY KEY REFERENCES public."FILE_ASSET"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 bytes BYTEA NOT NULL CHECK (octet_length(bytes)>0)
);
-- Protect new, evidenced finalizations; unresolved legacy rows stay untouched.
CREATE FUNCTION public.step7_finalization_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."printSnapshot" IS NOT NULL THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Official finalization cannot be deleted' USING ERRCODE='23514'; END IF;
  IF (to_jsonb(NEW)-'updatedAt'-'pdfAssetId'-'supersededAt'-'reason') IS DISTINCT FROM
     (to_jsonb(OLD)-'updatedAt'-'pdfAssetId'-'supersededAt'-'reason')
     OR (OLD."pdfAssetId" IS NOT NULL AND NEW."pdfAssetId" IS DISTINCT FROM OLD."pdfAssetId")
     OR (OLD."supersededAt" IS NOT NULL AND NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt") THEN
   RAISE EXCEPTION 'Finalization snapshot is immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER step7_finalization_immutable BEFORE UPDATE OR DELETE ON public."DOSSIER_FINALIZATION"
 FOR EACH ROW EXECUTE FUNCTION public.step7_finalization_immutable();
CREATE TRIGGER step7_receipt_immutable BEFORE UPDATE OR DELETE ON public."DOSSIER_RECEIPT"
 FOR EACH ROW EXECUTE FUNCTION public.pr2b_append_only();
CREATE TRIGGER step7_pdf_immutable BEFORE UPDATE OR DELETE ON public."DOSSIER_PDF_CONTENT"
 FOR EACH ROW EXECUTE FUNCTION public.pr2b_append_only();
INSERT INTO public."PERMISSION" (id,resource,action,description) VALUES
 ('perm-proposal-finalize','proposal','finalize','Finalize an approved proposal within faculty scope'),
 ('perm-proposal-export','proposal','export','Download authorized finalized proposal PDF'),
 ('perm-dossier-receive','dossier','receive','Record physical dossier receipt within faculty scope')
 ON CONFLICT (resource,action) DO NOTHING;
INSERT INTO public."ROLE_PERMISSION" (role_id,permission_id)
 SELECT r.id,p.id FROM public."ROLE" r CROSS JOIN public."PERMISSION" p
 WHERE (r.name='FACULTY' AND ((p.resource='proposal' AND p.action IN ('read','finalize','export')) OR (p.resource='dossier' AND p.action='receive')))
 OR (r.name IN ('STUDENT','LECTURER') AND p.resource='proposal' AND p.action='export')
 ON CONFLICT DO NOTHING;
REVOKE ALL ON public."DOSSIER_STUDENT_PROFILE",public."DOSSIER_PDF_CONTENT" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON public."DOSSIER_STUDENT_PROFILE",public."DOSSIER_PDF_CONTENT" FROM %I',r);
  END IF;
 END LOOP;
END $$;
COMMIT;
