-- Read-only baseline checks. No data repair, no backfill, no actor inference.
-- check: duplicate_proposal_topic
SELECT count(*)::int AS violations FROM (
  SELECT topic_id FROM "PROPOSAL" GROUP BY topic_id HAVING count(*) > 1
) q;

-- check: orphan_or_unmapped_proposal_owner
SELECT count(*)::int AS violations FROM "PROPOSAL" p
LEFT JOIN "TOPIC" t ON t.id=p.topic_id
LEFT JOIN "STUDENT" s ON s.id=p.student_id
LEFT JOIN "TERM_STUDENT" ts ON ts.term_id=t.term_id AND ts.student_id=p.student_id
WHERE t.id IS NULL OR s.id IS NULL OR ts.id IS NULL;

-- check: topics_without_owner_evidence
SELECT count(*)::int AS violations FROM "TOPIC" t
LEFT JOIN "PROPOSAL" p ON p.topic_id=t.id WHERE p.id IS NULL;

-- check: multiple_topics_per_student_term
SELECT count(*)::int AS violations FROM (
  SELECT t.term_id,p.student_id FROM "TOPIC" t JOIN "PROPOSAL" p ON p.topic_id=t.id
  GROUP BY t.term_id,p.student_id HAVING count(DISTINCT t.id)>1
) q;

-- check: assignment_cross_term_or_roster
SELECT count(*)::int AS violations FROM "ADVISOR_ASSIGNMENT" a
LEFT JOIN "ASSIGNMENT_PLAN" ap ON ap.id=a.assignment_plan_id
LEFT JOIN "REGISTRATION" r ON r.id=a.registration_id
LEFT JOIN "TERM_LECTURER" tl ON tl.term_id=ap.term_id AND tl.lecturer_id=a.advisor_id
LEFT JOIN "TERM_STUDENT" ts ON ts.term_id=r.term_id AND ts.student_id=r.student_id
WHERE ap.id IS NULL OR r.id IS NULL OR ap.term_id<>r.term_id
   OR tl.lecturer_id IS NULL OR ts.id IS NULL;

-- check: multiple_finalized_plans
SELECT count(*)::int AS violations FROM (
  SELECT term_id FROM "ASSIGNMENT_PLAN" WHERE status='FINALIZED'
  GROUP BY term_id HAVING count(*)>1
) q;

-- check: review_cross_term
SELECT count(*)::int AS violations FROM "PROPOSAL_REVIEW" rv
LEFT JOIN "REVIEW_GROUP" g ON g.id=rv.review_group_id
LEFT JOIN "PROPOSAL" p ON p.id=rv.proposal_id
LEFT JOIN "TOPIC" t ON t.id=p.topic_id
WHERE g.id IS NULL OR p.id IS NULL OR t.id IS NULL OR g.term_id<>t.term_id;

-- check: review_member_outside_term
SELECT count(*)::int AS violations FROM "REVIEW_GROUP_MEMBER" gm
LEFT JOIN "REVIEW_GROUP" g ON g.id=gm.review_group_id
LEFT JOIN "TERM_LECTURER" tl ON tl.term_id=g.term_id AND tl.lecturer_id=gm.lecturer_id
WHERE g.id IS NULL OR tl.lecturer_id IS NULL;

-- check: duplicate_proposal_version
SELECT count(*)::int AS violations FROM (
  SELECT proposal_id,version FROM "PROPOSAL_VERSION"
  GROUP BY proposal_id,version HAVING count(*)>1
) q;

-- check: task_review_legacy_distribution
SELECT is_passed,count(*)::int AS records FROM "TASK_REVIEW" GROUP BY is_passed;

-- check: proposal_status_distribution
SELECT status,count(*)::int AS records FROM "PROPOSAL" GROUP BY status;

-- check: dossier_status_distribution
SELECT status,count(*)::int AS records FROM "THESIS_DOSSIER" GROUP BY status;
