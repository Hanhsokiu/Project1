BEGIN READ ONLY;
DO $$ BEGIN
 IF (WITH expected(resource,action) AS (VALUES ('defense-result','read'),('defense-report','read'),('defense-report','templates-read'),('defense-report','statistics')) SELECT count(*) FROM expected e JOIN public."PERMISSION" p USING(resource,action) JOIN public."ROLE_PERMISSION" rp ON rp.permission_id=p.id JOIN public."ROLE" r ON r.id=rp.role_id WHERE r.name='FACULTY')<>4 THEN RAISE EXCEPTION 'Four FACULTY read grants required'; END IF;
 IF (WITH baseline AS (SELECT b.role_id,b.permission_id FROM datn_rbac_faculty_read.run r CROSS JOIN LATERAL jsonb_to_recordset(r.grants_before) AS b(role_id text,permission_id text)),
 desired AS (SELECT * FROM baseline UNION SELECT role_id,permission_id FROM datn_rbac_faculty_read.created_grant),
 delta AS ((SELECT role_id,permission_id FROM public."ROLE_PERMISSION" EXCEPT SELECT * FROM desired) UNION ALL (SELECT * FROM desired EXCEPT SELECT role_id,permission_id FROM public."ROLE_PERMISSION")) SELECT count(*) FROM delta)<>0 THEN RAISE EXCEPTION 'Unexpected other role/grant changes'; END IF;
END; $$;
SELECT 'PASS_EXACT_FACULTY_READ_GRANTS';
COMMIT;
