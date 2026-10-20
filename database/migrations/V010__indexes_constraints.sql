-- V010: Indexes & Constraints bổ sung

-- Index for searching and performance
CREATE INDEX idx_user_account_username ON "USER_ACCOUNT"(username);
CREATE INDEX idx_user_account_email ON "USER_ACCOUNT"(email);
CREATE INDEX idx_student_code ON "STUDENT"(student_code);
CREATE INDEX idx_lecturer_code ON "LECTURER"(lecturer_code);
CREATE INDEX idx_thesis_term_code ON "THESIS_TERM"(code);
CREATE INDEX idx_proposal_topic_id ON "PROPOSAL"(topic_id);
CREATE INDEX idx_task_deadline ON "TASK"(deadline);
CREATE INDEX idx_notification_user_id ON "NOTIFICATION"(user_id, status);
CREATE INDEX idx_score_entry_proposal ON "SCORE_ENTRY"(proposal_id);

-- Constraint kiểm tra điểm từ 0 đến 10
ALTER TABLE "SCORE_DETAIL" ADD CONSTRAINT chk_score_range CHECK (score >= 0.0 AND score <= 10.0);
ALTER TABLE "FINAL_RESULT" ADD CONSTRAINT chk_final_score CHECK (final_score >= 0.0 AND final_score <= 10.0);
