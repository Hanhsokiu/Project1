-- Synthetic data ONLY for an isolated btl_pr2b_* rehearsal database.
-- Not a production seed and never a legacy backfill source.
INSERT INTO "TRAINING_SYSTEM"(id,code,name) VALUES ('fx-system','FX','Synthetic');
INSERT INTO "DEPARTMENT"(id,code,name) VALUES ('fx-dept','FX','Synthetic');
INSERT INTO "USER_ACCOUNT"(id,username,email,password_hash,status) VALUES
 ('fx-us1','fx-us1','fx-us1@example.invalid','not-a-login-hash','ACTIVE'),
 ('fx-us2','fx-us2','fx-us2@example.invalid','not-a-login-hash','ACTIVE'),
 ('fx-ua','fx-ua','fx-ua@example.invalid','not-a-login-hash','ACTIVE'),
 ('fx-ur','fx-ur','fx-ur@example.invalid','not-a-login-hash','ACTIVE');
INSERT INTO "STUDENT"(id,user_id,student_code,full_name,training_system_id) VALUES
 ('fx-s1','fx-us1','FX1','Synthetic One','fx-system'),('fx-s2','fx-us2','FX2','Synthetic Two','fx-system');
INSERT INTO "LECTURER"(id,user_id,lecturer_code,full_name,department_id) VALUES
 ('fx-la','fx-ua','FXA','Synthetic Advisor','fx-dept'),('fx-lr','fx-ur','FXR','Synthetic Reviewer','fx-dept');
INSERT INTO "THESIS_TERM"(id,code,name,academic_year,semester,status,start_date,end_date) VALUES
 ('fx-t1','FX1','Synthetic One','2026',1,'IN_PROGRESS','2026-01-01T00:00:00Z','2026-12-31T00:00:00Z'),
 ('fx-t2','FX2','Synthetic Two','2026',2,'IN_PROGRESS','2026-01-01T00:00:00Z','2026-12-31T00:00:00Z');
INSERT INTO "TERM_STUDENT"(id,term_id,student_id) VALUES ('fx-ts1','fx-t1','fx-s1'),('fx-ts2','fx-t2','fx-s2');
INSERT INTO "TERM_LECTURER"(term_id,lecturer_id) VALUES ('fx-t1','fx-la'),('fx-t1','fx-lr'),('fx-t2','fx-la');
INSERT INTO "REGISTRATION"(id,term_id,student_id,status) VALUES ('fx-reg1','fx-t1','fx-s1','PENDING');
INSERT INTO "ASSIGNMENT_PLAN"(id,term_id,status) VALUES ('fx-ap1','fx-t1','FINALIZED');
INSERT INTO "ADVISOR_ASSIGNMENT"(id,assignment_plan_id,registration_id,advisor_id) VALUES ('fx-aa1','fx-ap1','fx-reg1','fx-la');
INSERT INTO "TOPIC"(id,term_id,title) VALUES ('fx-topic1','fx-t1','Synthetic One'),('fx-topic2','fx-t2','Synthetic Two');
INSERT INTO "PROPOSAL"(id,topic_id,student_id) VALUES ('fx-p1','fx-topic1','fx-s1'),('fx-p2','fx-topic2','fx-s2');
INSERT INTO "PROPOSAL_VERSION"(id,proposal_id,version,content) VALUES ('fx-v1','fx-p1',1,'{"fixture":true}'),('fx-v2','fx-p2',1,'{"fixture":true}');
INSERT INTO "REVIEW_GROUP"(id,term_id,name) VALUES ('fx-g1','fx-t1','Synthetic');
INSERT INTO "REVIEW_GROUP_MEMBER"(review_group_id,lecturer_id) VALUES ('fx-g1','fx-lr');
INSERT INTO "PROPOSAL_REVIEW"(id,proposal_id,review_group_id) VALUES ('fx-r1','fx-p1','fx-g1'),('fx-r2','fx-p1','fx-g1');
INSERT INTO "GUIDANCE_PLAN"(id,proposal_id,advisor_id) VALUES ('fx-gp1','fx-p1','fx-la');
INSERT INTO "TASK"(id,guidance_plan_id,title,deadline) VALUES ('fx-task1','fx-gp1','Synthetic task','2026-01-07T00:00:00Z');
INSERT INTO "TASK_SUBMISSION"(id,task_id,content) VALUES ('fx-sub1','fx-task1','Synthetic legacy submission');
INSERT INTO "TASK_REVIEW"(id,submission_id,reviewer_id,comment,is_passed) VALUES ('fx-old-review','fx-sub1','fx-la','Synthetic legacy ambiguity',false);
-- Simulate accidental Data API/public exposure in this isolated fixture only.
GRANT SELECT ON "TOPIC" TO PUBLIC;
