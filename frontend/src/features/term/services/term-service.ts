import { parameters } from "../../../shared/data/seed";
import { hasEligibleGpa } from "../../../shared/utils/gpa";
import { assert, mutate, uid } from "../../../shared/data/store";
import type { Term, TermStatus } from "../../../shared/data/types";
import { step1Api } from "../../../shared/data/snapshot-api";
import { termApi } from "./term-api";
const managers = ["ADMIN", "FACULTY"] as const;
const transitions: Record<TermStatus, TermStatus[]> = {
  DRAFT: ["OPEN_REGISTRATION", "CANCELLED"],
  OPEN_REGISTRATION: ["CLOSED_REGISTRATION"],
  CLOSED_REGISTRATION: ["OPEN_REGISTRATION", "IN_PROGRESS"],
  IN_PROGRESS: ["DEFENDING"],
  DEFENDING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
export type TermInput = Pick<
  Term,
  | "name"
  | "code"
  | "semester"
  | "program"
  | "start"
  | "end"
  | "registrationStart"
  | "registrationEnd"
> & { id?: string };
function instant(value: string, end = false) {
  return new Date(
    value.length === 10
      ? `${value}T${end ? "23:59:59" : "00:00:00"}+07:00`
      : /[zZ]|[+-]\d\d:\d\d$/.test(value)
        ? value
        : `${value}+07:00`,
  ).getTime();
}
function assertMutable(t: Term | undefined): asserts t is Term {
  assert(
    t && !t.locked && !["COMPLETED", "CANCELLED"].includes(t.status),
    "Đợt không tồn tại, đã khóa hoặc kết thúc",
  );
}
function validatePhases(t: Term, phases: Term["phases"]) {
  assert(phases.length, "Cần ít nhất một giai đoạn");
  assert(
    new Set(phases.map((p) => p.id)).size === phases.length,
    "Mã giai đoạn bị trùng",
  );
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    assert(
      p.name.trim() &&
        p.start &&
        p.end &&
        Number.isFinite(instant(p.start)) &&
        Number.isFinite(instant(p.end)) &&
        p.start <= p.end,
      "Mỗi giai đoạn cần tên và khoảng thời gian hợp lệ",
    );
    assert(
      p.start >= t.start && p.end <= t.end,
      "Giai đoạn phải nằm trong thời gian đợt",
    );
    if (i)
      assert(
        p.start > phases[i - 1].end,
        "Các giai đoạn phải đúng thứ tự và không chồng thời gian",
      );
  }
}
function initialPhases(input: TermInput): Term["phases"] {
  const registrationEnd = input.registrationEnd.slice(0, 10);
  const dayAfter = new Date(`${registrationEnd}T12:00:00+07:00`);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const assignmentStart = dayAfter.toISOString().slice(0, 10);
  const lastDay = new Date(`${input.end}T12:00:00+07:00`);
  const available = Math.round(
    (lastDay.getTime() - dayAfter.getTime()) / 86400000,
  );
  if (available < 1)
    return [
      {
        id: uid("gd"),
        name: "Đăng ký nguyện vọng",
        start: input.registrationStart.slice(0, 10),
        end: registrationEnd,
        locked: false,
      },
    ];
  const assignmentEnd = new Date(dayAfter);
  assignmentEnd.setDate(
    assignmentEnd.getDate() +
      Math.min(4, Math.max(0, Math.floor(available / 4))),
  );
  const proposalStart = new Date(assignmentEnd);
  proposalStart.setDate(proposalStart.getDate() + 1);
  return [
    {
      id: uid("gd"),
      name: "Đăng ký nguyện vọng",
      start: input.registrationStart.slice(0, 10),
      end: registrationEnd,
      locked: false,
    },
    {
      id: uid("gd"),
      name: "Phân công GVHD",
      start: assignmentStart,
      end: assignmentEnd.toISOString().slice(0, 10),
      locked: false,
    },
    {
      id: uid("gd"),
      name: "Đề tài & đề cương",
      start: proposalStart.toISOString().slice(0, 10),
      end: input.end,
      locked: false,
    },
  ];
}
export const mockTermService = {
  save(input: TermInput) {
    return mutate("Lưu đợt đồ án", [...managers], (db) => {
      assert(
        input.name.trim().length >= 5 &&
          input.code.trim() &&
          input.semester &&
          input.program,
        "Nhập đầy đủ thông tin đợt",
      );
      assert(
        db.catalogs.some(
          (c) => c.kind === "program" && c.name === input.program,
        ),
        "Hệ đào tạo không tồn tại",
      );
      assert(
        db.catalogs.some(
          (c) => c.kind === "semester" && c.name === input.semester,
        ),
        "Kỳ học không tồn tại",
      );
      assert(
        Number.isFinite(instant(input.start)) &&
          Number.isFinite(instant(input.end)) &&
          input.start < input.end,
        "Ngày kết thúc phải sau ngày bắt đầu",
      );
      const start = instant(input.registrationStart);
      const end = instant(input.registrationEnd, true);
      assert(
        Number.isFinite(start) && Number.isFinite(end) && start < end,
        "Hạn đăng ký phải sau thời điểm mở",
      );
      assert(
        start >= instant(input.start) && end <= instant(input.end, true),
        "Khoảng đăng ký phải nằm trong thời gian đợt",
      );
      assert(
        !db.terms.some((t) => t.code === input.code && t.id !== input.id),
        "Mã đợt đã tồn tại",
      );
      const old = db.terms.find((t) => t.id === input.id);
      if (old) {
        assertMutable(old);
        assert(
          old.studentIds.every(
            (id) =>
              db.students.find((s) => s.id === id)?.program === input.program,
          ),
          "Không đổi hệ khi danh sách SV tham gia thuộc hệ khác",
        );
        Object.assign(old, input);
      } else {
        const id = uid("dot");
        db.terms.push({
          ...input,
          id,
          status: "DRAFT",
          locked: false,
          studentIds: [],
          lecturers: [],
          phases: initialPhases(input),
          parameters: { ...parameters },
          assignmentPublished: false,
          resultsPublished: false,
        });
        return id;
      }
    });
  },
  transition(id: string, status: TermStatus) {
    return mutate("Chuyển trạng thái đợt", [...managers], (db) => {
      const t = db.terms.find((t) => t.id === id);
      assertMutable(t);
      assert(
        transitions[t.status].includes(status),
        "Chuyển trạng thái không hợp lệ",
      );
      if (status === "OPEN_REGISTRATION") {
        assert(
          !t.assignmentPublished,
          "Không mở lại đăng ký sau khi đã công bố phân công",
        );
        assert(
          t.studentIds.length && t.lecturers.some((l) => l.quota > 0),
          "Cần có sinh viên đủ điều kiện và giảng viên có quota trước khi mở đăng ký",
        );
        validatePhases(t, t.phases);
        assert(
          instant(t.registrationStart) < instant(t.registrationEnd, true) &&
            instant(t.registrationStart) >= instant(t.start) &&
            instant(t.registrationEnd, true) <= instant(t.end, true),
          "Cửa sổ đăng ký không hợp lệ",
        );
        assert(
          t.studentIds.every((id) => {
            const s = db.students.find((s) => s.id === id);
            return (
              s &&
              s.program === t.program &&
              s.eligible &&
              hasEligibleGpa(s.gpa, t.parameters.passing_gpa_threshold)
            );
          }),
          "Danh sách SV có người sai hệ hoặc chưa đủ điều kiện",
        );
        assert(
          t.lecturers.every(
            (l) =>
              db.lecturers.some(
                (g) =>
                  g.id === l.lecturerId &&
                  g.directionIds.some((id) =>
                    db.catalogs.some((c) => c.id === id && c.active),
                  ),
              ) &&
              Number.isInteger(l.quota) &&
              l.quota >= 0,
          ),
          "GV tham gia cần hướng chuyên môn hoạt động và quota hợp lệ",
        );
        t.phases[0].locked = false;
      }
      if (status === "CLOSED_REGISTRATION" && t.phases[0])
        t.phases[0].locked = true;
      if (status === "IN_PROGRESS")
        assert(
          t.assignmentPublished,
          "Cần công bố phân công trước khi thực hiện",
        );
      if (status === "COMPLETED") {
        assert(
          t.resultsPublished,
          "Cần công bố kết quả trước khi hoàn thành đợt",
        );
        t.locked = true;
      }
      if (status === "CANCELLED") t.locked = true;
      t.status = status;
    });
  },
  toggleLock(id: string) {
    return mutate("Khóa/mở đợt", [...managers], (db) => {
      const t = db.terms.find((t) => t.id === id);
      assert(t, "Không tìm thấy đợt");
      assert(
        !["COMPLETED", "CANCELLED"].includes(t.status),
        "Đợt đã kết thúc hoặc hủy, chỉ được tra cứu",
      );
      t.locked = !t.locked;
    });
  },
  savePhases(id: string, phases: Term["phases"]) {
    return mutate("Cập nhật kế hoạch giai đoạn", [...managers], (db) => {
      const t = db.terms.find((t) => t.id === id);
      assertMutable(t);
      validatePhases(t, phases);
      const registration = phases[0];
      if (registration.start !== t.registrationStart.slice(0, 10))
        t.registrationStart = `${registration.start}T00:00`;
      if (registration.end !== t.registrationEnd.slice(0, 10))
        t.registrationEnd = `${registration.end}T23:59`;
      t.phases = structuredClone(phases);
    });
  },
  saveParameters(id: string, values: Record<string, number>) {
    return mutate("Cập nhật tham số đợt", [...managers], (db) => {
      const t = db.terms.find((t) => t.id === id);
      assertMutable(t);
      assert(!t.resultsPublished, "Không đổi trọng số sau công bố điểm");
      assert(
        Object.values(values).every(Number.isFinite),
        "Tham số phải là số hợp lệ",
      );
      for (const k of [
        "process_weight",
        "committee_weight",
        "advisor_weight_in_process",
        "reviewer_weight_in_process",
        "min_weekly_pass_rate",
      ])
        assert(
          values[k] >= 0 && values[k] <= 1,
          "Trọng số/tỷ lệ nằm trong khoảng 0–1",
        );
      assert(
        Math.abs(values.process_weight + values.committee_weight - 1) < 0.0001,
        "Tổng trọng số quá trình và hội đồng phải bằng 1",
      );
      assert(
        Math.abs(
          values.advisor_weight_in_process +
            values.reviewer_weight_in_process -
            1,
        ) < 0.0001,
        "Tổng trọng số GVHD và GVPB phải bằng 1",
      );
      assert(
        values.min_pass_score >= 0 &&
          values.min_pass_score <= 10 &&
          values.passing_gpa_threshold >= 0 &&
          values.passing_gpa_threshold <= 4,
        "Ngưỡng điểm không hợp lệ",
      );
      assert(
        values.max_preferences >= 1 &&
          values.max_preferences <= 3 &&
          Number.isInteger(values.max_preferences),
        "Số nguyện vọng tối đa từ 1 đến 3",
      );
      t.parameters = { ...values };
    });
  },
  saveRoster(id: string, studentIds: string[], lecturers: Term["lecturers"]) {
    return mutate("Cập nhật danh sách tham gia", [...managers], (db) => {
      const t = db.terms.find((t) => t.id === id);
      assertMutable(t);
      assert(
        new Set(studentIds).size === studentIds.length,
        "Danh sách sinh viên bị trùng",
      );
      assert(
        new Set(lecturers.map((l) => l.lecturerId)).size === lecturers.length,
        "Danh sách giảng viên bị trùng",
      );
      for (const studentId of studentIds) {
        const s = db.students.find((s) => s.id === studentId);
        assert(
          s && s.eligible && hasEligibleGpa(s.gpa, t.parameters.passing_gpa_threshold),
          "Chỉ thêm sinh viên đủ điều kiện học vụ và GPA",
        );
        assert(
          s.program === t.program,
          "Hệ đào tạo của sinh viên không khớp với đợt",
        );
      }
      assert(
        lecturers.every((l) => db.lecturers.some((g) => g.id === l.lecturerId)),
        "Giảng viên tham gia không tồn tại",
      );
      assert(
        lecturers.every(
          (l) => Number.isInteger(l.quota) && l.quota >= 0 && l.quota <= 100,
        ),
        "Quota phải là số nguyên từ 0 đến 100",
      );
      const assigned = db.assignments.filter((a) => a.termId === id);
      if (t.assignmentPublished)
        assert(
          assigned.every(
            (a) =>
              studentIds.includes(a.studentId) &&
              lecturers.some((l) => l.lecturerId === a.lecturerId),
          ),
          "Không được loại người đang có phân công đã công bố",
        );
      for (const l of lecturers)
        assert(
          assigned.filter((a) => a.lecturerId === l.lecturerId).length <=
            l.quota,
          "Quota thấp hơn số sinh viên đang được phân",
        );
      t.studentIds = [...studentIds];
      t.lecturers = structuredClone(lecturers);
    });
  },
};
export const termService = {
  save: (input: TermInput) =>
    step1Api.term ? termApi.save(input) : mockTermService.save(input),
  transition: (id: string, status: TermStatus) =>
    step1Api.term
      ? termApi.transition(id, status)
      : mockTermService.transition(id, status),
  toggleLock: (id: string) =>
    step1Api.term ? termApi.toggleLock(id) : mockTermService.toggleLock(id),
  savePhases: (id: string, phases: Term["phases"]) =>
    step1Api.term
      ? termApi.savePhases(id, phases)
      : mockTermService.savePhases(id, phases),
  saveParameters: (id: string, values: Record<string, number>) =>
    step1Api.term
      ? termApi.saveParameters(id, values)
      : mockTermService.saveParameters(id, values),
  saveRoster: (
    id: string,
    studentIds: string[],
    lecturers: Term["lecturers"],
  ) =>
    step1Api.term
      ? termApi.saveRoster(id, studentIds, lecturers)
      : mockTermService.saveRoster(id, studentIds, lecturers),
};
export { transitions };
export type TermService = typeof termService;
