import { Prisma } from "@prisma/client";
import type { StudentDirectoryQuery } from "@doan/shared";

// GPA 0 is valid; NULL, non-finite/out-of-range GPA and an unverified flag are
// ineligible, matching the existing directory's hasEligibleGpa(value, 0).
export const eligibleStudentSql = Prisma.sql`(s.academic_eligible = true AND s.gpa >= 0 AND s.gpa <= 4)`;

export function studentDirectoryWhere(q: StudentDirectoryQuery) {
  const conditions: Prisma.Sql[] = [];
  if (q.search) conditions.push(Prisma.sql`strpos(lower(concat(s.student_code, ' ', s.full_name, ' ', COALESCE(u.email, ''), ' ', s.class_name)), lower(${q.search})) > 0`);
  if (q.trainingSystemId) conditions.push(Prisma.sql`s.training_system_id = ${q.trainingSystemId}`);
  if (q.className) conditions.push(Prisma.sql`s.class_name = ${q.className}`);
  if (q.termId) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "TERM_STUDENT" ts WHERE ts.student_id = s.id AND ts.term_id = ${q.termId})`);
  if (q.academicCondition === "eligible") conditions.push(eligibleStudentSql);
  if (q.academicCondition === "ineligible") conditions.push(Prisma.sql`(${eligibleStudentSql} IS NOT TRUE)`);
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
}

export function studentDirectoryOrder(q: StudentDirectoryQuery) {
  // SQL identifiers and direction come only from this fixed allowlist.
  const field = q.sortBy === "name" ? Prisma.sql`s.full_name` : q.sortBy === "gpa" ? Prisma.sql`s.gpa` : Prisma.sql`s.student_code`;
  const direction = q.sortDirection === "desc" ? Prisma.sql`DESC NULLS LAST` : Prisma.sql`ASC NULLS FIRST`;
  return Prisma.sql`${field} ${direction}, s.student_code ASC, s.id ASC`;
}
