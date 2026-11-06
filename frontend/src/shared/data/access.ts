import type { Account, DemoDb } from "./types";
export function isManager(user: Account) {
  return user.roles.some((r) => r === "ADMIN" || r === "FACULTY");
}
export function scopedStudentIds(
  db: DemoDb,
  user: Account,
  termId: string,
): string[] {
  if (isManager(user))
    return db.terms.find((t) => t.id === termId)?.studentIds || [];
  if (user.studentId) return [user.studentId];
  return db.assignments
    .filter(
      (a) =>
        a.termId === termId && a.lecturerId === user.lecturerId && a.published,
    )
    .map((a) => a.studentId);
}
