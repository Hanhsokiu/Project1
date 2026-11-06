import type { Account, DemoDb, Role } from "../../../shared/data/types";
import { assert } from "../../../shared/data/store";

/** Read adapter for auth and business steps 1–3; replace with GET /dashboard in the HTTP adapter. */
export function dashboardData(
  db: DemoDb,
  user: Account,
  termId: string,
  role: Role,
) {
  assert(
    user.roles.includes(role),
    "Không có quyền xem tổng quan của vai trò này.",
    "FORBIDDEN",
  );
  const term = db.terms.find((t) => t.id === termId);
  assert(term, "Không tìm thấy đợt đồ án.", "NOT_FOUND");
  const allAssignments = db.assignments.filter((a) => a.termId === termId);
  const advisoryIds = allAssignments
    .filter(
      (a) =>
        term.assignmentPublished &&
        a.published &&
        a.lecturerId === user.lecturerId,
    )
    .map((a) => a.studentId);
  const visibleIds =
    role === "ADMIN" || role === "FACULTY"
      ? term.studentIds
      : role === "STUDENT"
        ? term.studentIds.filter((id) => id === user.studentId)
        : role === "LECTURER"
          ? advisoryIds
          : [];
  const students = db.students.filter((s) => visibleIds.includes(s.id));
  const assignments = allAssignments.filter(
    (a) =>
      visibleIds.includes(a.studentId) &&
      (role === "ADMIN" ||
        role === "FACULTY" ||
        (term.assignmentPublished && a.published)),
  );
  const topicIds =
    role === "STUDENT" || role === "LECTURER"
      ? assignments.map((a) => a.studentId)
      : visibleIds;
  const topics = db.topics.filter(
    (t) => t.termId === termId && topicIds.includes(t.studentId),
  );
  const registrations = db.registrations.filter(
    (r) => r.termId === termId && visibleIds.includes(r.studentId),
  );
  const notifications = db.notifications.filter(
    (n) => n.termId === termId && n.userId === user.id,
  );
  const assignmentNotifications =
    role === "FACULTY"
      ? db.notifications.filter(
          (n) =>
            n.termId === termId &&
            n.title.toLocaleLowerCase("vi").includes("phân công"),
        )
      : [];
  const lecturer = db.lecturers.find((l) => l.id === user.lecturerId);
  const quota =
    term.lecturers.find((l) => l.lecturerId === user.lecturerId)?.quota ??
    lecturer?.quota ??
    0;
  const phases = term.phases.filter((p) =>
    /đăng ký|phân công|đề cương|đề tài/i.test(p.name),
  );
  return {
    term,
    students,
    assignments,
    topics,
    registrations,
    notifications,
    assignmentNotifications,
    lecturer,
    quota,
    phases,
  };
}
export type DashboardData = ReturnType<typeof dashboardData>;
