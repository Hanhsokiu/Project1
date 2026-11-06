import type {
  Assignment,
  DemoDb,
  Registration,
} from "../../../shared/data/types";
import {
  assert,
  mutate,
  now,
  readDb,
  requireUser,
  uid,
} from "../../../shared/data/store";
import { contactSchema } from "../../../shared/data/schemas";
import { hasEligibleGpa } from "../../../shared/utils/gpa";
import { registrationApi, REGISTRATION_API } from "./registration-api";
import { assignmentApi } from "./assignment-api";

/** Date-only deadlines include the entire selected day in Vietnam. Datetimes are exclusive. */
export function registrationWindow(
  db: DemoDb,
  termId: string,
  at = new Date(),
) {
  const term = db.terms.find((t) => t.id === termId);
  if (!term) return "Không tìm thấy đợt";
  if (term.locked || term.phases[0]?.locked) return "Đăng ký đã khóa";
  if (term.assignmentPublished)
    return "Đã công bố phân công, không thay đổi đăng ký";
  if (term.status !== "OPEN_REGISTRATION") return "Đợt chưa mở đăng ký";
  const start = new Date(
    term.registrationStart.length === 10
      ? `${term.registrationStart}T00:00:00+07:00`
      : term.registrationStart,
  );
  const end = new Date(
    term.registrationEnd.length === 10
      ? `${term.registrationEnd}T00:00:00+07:00`
      : term.registrationEnd,
  );
  if (term.registrationEnd.length === 10)
    end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end
  )
    return "Mốc đăng ký chưa hợp lệ";
  if (at < start) return "Chưa đến thời gian đăng ký";
  if (at >= end) return "Đã hết hạn đăng ký";
  return "";
}

export function registrationIssue(
  db: DemoDb,
  termId: string,
  registration: Registration,
): string {
  const term = db.terms.find((t) => t.id === termId);
  const student = db.students.find((s) => s.id === registration.studentId);
  if (!term || !student || !term.studentIds.includes(student.id))
    return "Sinh viên không thuộc danh sách tham gia đợt";
  if (
    !student.eligible ||
    !hasEligibleGpa(student.gpa, term.parameters.passing_gpa_threshold)
  )
    return "Sinh viên chưa đủ điều kiện học vụ và GPA";
  if (student.program !== term.program)
    return "Hệ đào tạo của sinh viên không khớp với đợt";
  if (
    !db.catalogs.some(
      (c) =>
        c.kind === "direction" && c.id === registration.directionId && c.active,
    )
  )
    return "Hướng đồ án không còn hoạt động";
  if (
    !registration.preferences.length ||
    registration.preferences.length >
      Math.min(3, term.parameters.max_preferences ?? 3) ||
    new Set(registration.preferences).size !== registration.preferences.length
  )
    return "Danh sách nguyện vọng không hợp lệ";
  if (
    registration.preferences.some(
      (id) =>
        !term.lecturers.some((l) => l.lecturerId === id) ||
        !db.lecturers
          .find((l) => l.id === id)
          ?.directionIds.includes(registration.directionId),
    )
  )
    return "Giảng viên nguyện vọng không tham gia đợt hoặc không đúng hướng";
  return "";
}

/** Each preference round runs across every unassigned student before the next round. */
export function buildAssignment(db: DemoDb, termId: string): Assignment[] {
  const term = db.terms.find((t) => t.id === termId);
  assert(term, "Không tìm thấy đợt");
  const registrations = db.registrations
    .filter(
      (r) =>
        r.termId === termId &&
        r.status === "SUBMITTED" &&
        !registrationIssue(db, termId, r),
    )
    .sort((a, b) => {
      const first = db.students.find((s) => s.id === a.studentId)!;
      const second = db.students.find((s) => s.id === b.studentId)!;
      return (
        (second.gpa ?? -Infinity) - (first.gpa ?? -Infinity) ||
        first.code.localeCompare(second.code, "vi") ||
        a.studentId.localeCompare(b.studentId)
      );
    });
  const result: Assignment[] = [];
  const loads = new Map(term.lecturers.map((l) => [l.lecturerId, 0]));
  const canAssign = (registration: Registration, id: string) => {
    const lecturer = db.lecturers.find((l) => l.id === id);
    const quota = term.lecturers.find((l) => l.lecturerId === id)?.quota ?? 0;
    return (
      lecturer?.directionIds.includes(registration.directionId) &&
      (loads.get(id) ?? 0) < quota
    );
  };
  const put = (registration: Registration, id: string, preference: number) => {
    result.push({
      id: uid("pc"),
      termId,
      studentId: registration.studentId,
      lecturerId: id,
      preference,
      manual: false,
      reason: "",
      published: false,
    });
    loads.set(id, (loads.get(id) ?? 0) + 1);
  };
  for (let preference = 0; preference < 3; preference++) {
    for (const registration of registrations) {
      if (result.some((a) => a.studentId === registration.studentId)) continue;
      const id = registration.preferences[preference];
      if (id && canAssign(registration, id))
        put(registration, id, preference + 1);
    }
  }
  for (const registration of registrations) {
    if (result.some((a) => a.studentId === registration.studentId)) continue;
    const available = term.lecturers
      .filter((l) => canAssign(registration, l.lecturerId))
      .sort(
        (a, b) =>
          (loads.get(a.lecturerId) ?? 0) / a.quota -
            (loads.get(b.lecturerId) ?? 0) / b.quota ||
          a.lecturerId.localeCompare(b.lecturerId),
      );
    if (available[0]) put(registration, available[0].lecturerId, 4);
  }
  return result;
}

function validatePlan(db: DemoDb, termId: string) {
  const term = db.terms.find((t) => t.id === termId);
  assert(term, "Không tìm thấy đợt");
  const registrations = db.registrations.filter(
    (r) => r.termId === termId && r.status === "SUBMITTED",
  );
  const assignments = db.assignments.filter((a) => a.termId === termId);
  assert(registrations.length, "Chưa có đăng ký đã nộp");
  for (const registration of registrations)
    assert(
      !registrationIssue(db, termId, registration),
      `${db.students.find((s) => s.id === registration.studentId)?.code ?? registration.studentId}: ${registrationIssue(db, termId, registration)}`,
    );
  assert(
    new Set(assignments.map((a) => a.studentId)).size === assignments.length,
    "Một sinh viên chỉ được phân công một GVHD trong đợt",
  );
  assert(
    registrations.every((r) =>
      assignments.some((a) => a.studentId === r.studentId),
    ),
    "Còn sinh viên đăng ký chưa được phân công",
  );
  for (const assignment of assignments) {
    const registration = registrations.find(
      (r) => r.studentId === assignment.studentId,
    );
    assert(registration, "Phương án chứa sinh viên không có đăng ký đã nộp");
    const lecturer = db.lecturers.find((l) => l.id === assignment.lecturerId);
    const participant = term.lecturers.find(
      (l) => l.lecturerId === assignment.lecturerId,
    );
    assert(
      participant && lecturer?.directionIds.includes(registration.directionId),
      "Phương án đã thay đổi: GVHD không tham gia đợt hoặc không đúng hướng",
    );
    assert(
      assignments.filter((a) => a.lecturerId === assignment.lecturerId)
        .length <= participant.quota,
      "Phương án vượt quota hiện tại; hãy chạy lại hoặc điều chỉnh",
    );
  }
  return { term, assignments };
}

export const registrationService = {
  save(
    termId: string,
    input: Pick<Registration, "directionId" | "preferences" | "note">,
    submit: boolean,
    email: string,
    phone: string,
  ) {
    if (REGISTRATION_API)
      return registrationApi.save(
        termId,
        {
          directionId: input.directionId || null,
          preferences: input.preferences.map((lecturerId, i) => ({
            lecturerId,
            preferenceOrder: i + 1,
          })),
          note: input.note,
          email,
          phone,
        },
        submit,
      );
    return mutate(
      submit ? "Nộp đăng ký" : "Lưu nháp đăng ký",
      ["STUDENT"],
      (db, user) => {
        assert(user.studentId, "Tài khoản chưa liên kết sinh viên");
        const term = db.terms.find((t) => t.id === termId);
        assert(term, "Không tìm thấy đợt");
        const reason = registrationWindow(db, termId);
        assert(!reason, reason, "REGISTRATION_CLOSED");
        const student = db.students.find((s) => s.id === user.studentId);
        assert(
          student && term.studentIds.includes(student.id),
          "Sinh viên chưa có trong danh sách đủ điều kiện của đợt",
        );
        assert(
          db.catalogs.some(
            (c) =>
              c.kind === "direction" && c.id === input.directionId && c.active,
          ),
          "Chọn một hướng đồ án",
        );
        const maximum = Math.min(3, term.parameters.max_preferences ?? 3);
        assert(
          input.preferences.length >= (submit ? 1 : 0) &&
            input.preferences.length <= maximum,
          submit
            ? `Chọn từ 1 đến ${maximum} nguyện vọng`
            : `Chọn tối đa ${maximum} nguyện vọng`,
        );
        assert(
          new Set(input.preferences).size === input.preferences.length,
          "Các nguyện vọng không được trùng",
        );
        for (const id of input.preferences)
          assert(
            term.lecturers.some((l) => l.lecturerId === id) &&
              db.lecturers
                .find((l) => l.id === id)
                ?.directionIds.includes(input.directionId),
            "Giảng viên phải tham gia đợt và có chuyên môn đúng hướng",
          );
        const contact = contactSchema.safeParse({ email, phone });
        if (submit) {
          assert(contact.success, "Email hoặc số điện thoại không hợp lệ");
          assert(
            student.eligible &&
              hasEligibleGpa(
                student.gpa,
                term.parameters.passing_gpa_threshold,
              ),
            "Sinh viên chưa đủ điều kiện học vụ và GPA",
          );
          assert(
            student.program === term.program,
            "Hệ đào tạo của sinh viên không khớp với đợt",
          );
        }
        if (contact.success) {
          Object.assign(student, contact.data);
          Object.assign(
            db.accounts.find((a) => a.id === user.id)!,
            contact.data,
          );
        }
        const old = db.registrations.find(
          (r) => r.termId === termId && r.studentId === student.id,
        );
        const data = {
          ...input,
          termId,
          studentId: student.id,
          status: submit ? ("SUBMITTED" as const) : ("DRAFT" as const),
          updatedAt: now(),
        };
        if (old) Object.assign(old, data);
        else db.registrations.push({ id: uid("dk"), ...data });
      },
    );
  },
  trial(termId: string) {
    assert(
      !REGISTRATION_API,
      "Dùng luồng xem trước và lưu nháp assignmentApi trong chế độ máy chủ.",
    );
    const db = readDb();
    requireUser(db, ["ADMIN", "FACULTY"]);
    return buildAssignment(db, termId);
  },
  saveTrial(termId: string) {
    assert(
      !REGISTRATION_API,
      "Dùng luồng xem trước và lưu nháp assignmentApi trong chế độ máy chủ.",
    );
    return mutate(
      "Chạy thử phương án phân công",
      ["ADMIN", "FACULTY"],
      (db) => {
        const term = db.terms.find((t) => t.id === termId);
        assert(term && !term.locked, "Đợt đã khóa hoặc không tồn tại");
        assert(
          !term.assignmentPublished,
          "Phân công đã công bố, cần điều chỉnh có lý do",
        );
        assert(
          term.status === "CLOSED_REGISTRATION",
          "Cần đóng đăng ký trước khi phân công",
        );
        const result = buildAssignment(db, termId);
        db.assignments = db.assignments
          .filter((a) => a.termId !== termId)
          .concat(result);
        return `Đã phân công ${result.length} sinh viên`;
      },
    );
  },
  adjust(
    termId: string,
    studentId: string,
    lecturerId: string,
    reason: string,
  ) {
    if (REGISTRATION_API)
      return assignmentApi.adjust(termId, studentId, lecturerId, reason);
    return mutate("Điều chỉnh phân công", ["ADMIN", "FACULTY"], (db) => {
      const term = db.terms.find((t) => t.id === termId);
      assert(term && !term.locked, "Đợt đã khóa hoặc không tồn tại");
      assert(
        ["CLOSED_REGISTRATION", "IN_PROGRESS"].includes(term.status),
        "Cần đóng đăng ký trước khi điều chỉnh phân công",
      );
      assert(term.studentIds.includes(studentId), "Sinh viên không thuộc đợt");
      assert(reason.trim().length >= 10, "Lý do điều chỉnh ít nhất 10 ký tự");
      const registration = db.registrations.find(
        (r) => r.termId === termId && r.studentId === studentId,
      );
      assert(
        registration?.status === "SUBMITTED",
        "Sinh viên chưa nộp đăng ký",
      );
      const issue = registrationIssue(db, termId, registration);
      assert(!issue, issue);
      const lecturer = db.lecturers.find((l) => l.id === lecturerId);
      assert(
        lecturer && lecturer.directionIds.includes(registration.directionId),
        "Giảng viên không cùng hướng chuyên môn",
      );
      const quota = term.lecturers.find(
        (l) => l.lecturerId === lecturerId,
      )?.quota;
      assert(quota !== undefined, "Giảng viên không tham gia đợt");
      assert(
        db.assignments.filter(
          (a) =>
            a.termId === termId &&
            a.lecturerId === lecturerId &&
            a.studentId !== studentId,
        ).length < quota,
        "Giảng viên đã đạt quota",
      );
      assert(
        !db.scores.some(
          (s) =>
            s.termId === termId &&
            s.studentId === studentId &&
            s.status !== "DRAFT",
        ),
        "Không đổi GVHD sau khi đã gửi điểm",
      );
      const existing = db.assignments.find(
        (a) => a.termId === termId && a.studentId === studentId,
      );
      assert(
        !existing || existing.lecturerId !== lecturerId,
        "Chọn GVHD mới khác giảng viên đang hướng dẫn",
      );
      const topic = db.topics.find(
        (t) => t.termId === termId && t.studentId === studentId,
      );
      assert(
        !topic || !["APPROVED", "LOCKED"].includes(topic.status),
        "Đề cương đã duyệt/chốt, không thay đổi GVHD",
      );
      if (existing)
        Object.assign(existing, {
          lecturerId,
          manual: true,
          preference: 0,
          reason,
        });
      else
        db.assignments.push({
          id: uid("pc"),
          termId,
          studentId,
          lecturerId,
          manual: true,
          preference: 0,
          reason,
          published: term.assignmentPublished,
        });
      if (topic) {
        topic.lecturerId = lecturerId;
        topic.advisorAgreed = false;
        if (topic.status === "SUBMITTED") topic.status = "DRAFT";
        topic.comment = `Đã điều chỉnh GVHD. Cần thống nhất lại đề tài và nộp lại đề cương. Lý do: ${reason.trim()}`;
      }
      db.tasks
        .filter((t) => t.termId === termId && t.studentId === studentId)
        .forEach((t) => (t.lecturerId = lecturerId));
      db.plans
        .filter((p) => p.termId === termId && p.studentId === studentId)
        .forEach((p) => (p.lecturerId = lecturerId));
      if (term.assignmentPublished)
        db.notifications.push({
          id: uid("tb"),
          termId,
          userId: studentId,
          title: "Điều chỉnh GVHD",
          content: `GVHD mới: ${lecturer.name}. Lý do: ${reason}`,
          status: "SENT",
          read: false,
        });
    });
  },
  publish(termId: string) {
    if (REGISTRATION_API) return assignmentApi.publish(termId);
    return mutate("Chốt và công bố phân công", ["ADMIN", "FACULTY"], (db) => {
      const term = db.terms.find((t) => t.id === termId);
      assert(term && !term.locked, "Đợt đã khóa hoặc không tồn tại");
      assert(!term.assignmentPublished, "Phân công đã được công bố");
      assert(term.status === "CLOSED_REGISTRATION", "Cần đóng đăng ký");
      const { assignments } = validatePlan(db, termId);
      for (const assignment of assignments) {
        assignment.published = true;
        const studentAccount = db.accounts.find(
          (a) => a.studentId === assignment.studentId,
        );
        const lecturerAccount = db.accounts.find(
          (a) => a.lecturerId === assignment.lecturerId,
        );
        db.notifications.push({
          id: uid("tb"),
          termId,
          userId: studentAccount?.id ?? assignment.studentId,
          title: "Kết quả phân công GVHD",
          content: `Bạn được phân công ${db.lecturers.find((l) => l.id === assignment.lecturerId)?.name}. Hãy liên hệ để thống nhất đề tài.`,
          status: "SENT",
          read: false,
        });
        db.notifications.push({
          id: uid("tb"),
          termId,
          userId: lecturerAccount?.id ?? assignment.lecturerId,
          title: "Sinh viên được giao hướng dẫn",
          content: `${db.students.find((s) => s.id === assignment.studentId)?.name} được phân công hướng dẫn.`,
          status: "SENT",
          read: false,
        });
      }
      term.assignmentPublished = true;
    });
  },
  retryNotification(id: string) {
    if (REGISTRATION_API) return assignmentApi.retry(id);
    return mutate("Gửi lại thông báo", ["ADMIN", "FACULTY"], (db) => {
      const notification = db.notifications.find((n) => n.id === id);
      assert(notification, "Không tìm thấy thông báo");
      assert(
        notification.status === "FAILED",
        "Chỉ gửi lại thông báo thất bại",
      );
      notification.status = "SENT";
    });
  },
};
export type RegistrationService = typeof registrationService;
