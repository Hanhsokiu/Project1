import { z } from "zod";
import { assert, mutate, now, readDb, uid } from "../../../shared/data/store";
import type {
  Account,
  DemoDb,
  GuidancePlan,
  Meeting,
  StoredFile,
  Task,
} from "../../../shared/data/types";

const text = z.string().trim().min(1, "Vui lòng nhập đầy đủ nội dung.");
const planSchema = z.object({
  content: text.max(8000),
  milestones: text.max(8000),
});
const taskSchema = z.object({
  week: z.coerce.number().int().min(1).max(52),
  title: text.max(250),
  description: text.max(8000),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày hết hạn không hợp lệ.")
    .refine((value) => {
      const parsed = new Date(`${value}T12:00:00+07:00`);
      return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    }, "Ngày hết hạn không tồn tại."),
});
const meetingSchema = z.object({
  at: text,
  location: text.max(250),
  content: text.max(8000),
  conclusion: text.max(8000),
});
export type PlanInput = z.input<typeof planSchema>;
export type TaskInput = z.input<typeof taskSchema>;
export type MeetingInput = z.input<typeof meetingSchema>;
type ReviewStatus = "PASS" | "FAIL" | "REVISION";

function validate<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  assert(result.success, result.success ? "" : result.error.issues[0].message);
  return result.data;
}

export function guidanceStudents(db: DemoDb, termId: string, user?: Account) {
  if (!user) return [];
  const term = db.terms.find((t) => t.id === termId);
  return db.students.filter(
    (s) =>
      term?.studentIds.includes(s.id) &&
      (user.roles.includes("FACULTY") ||
        user.roles.includes("ADMIN") ||
        (user.roles.includes("STUDENT") && user.studentId === s.id) ||
        (user.roles.includes("LECTURER") &&
          db.assignments.some(
            (a) =>
              a.termId === termId &&
              a.studentId === s.id &&
              a.lecturerId === user.lecturerId &&
              a.published,
          ))),
  );
}

export function isAdvisor(
  db: DemoDb,
  termId: string,
  studentId: string,
  user?: Account,
) {
  return (
    !!user?.roles.includes("LECTURER") &&
    db.assignments.some(
      (a) =>
        a.termId === termId &&
        a.studentId === studentId &&
        a.lecturerId === user.lecturerId &&
        a.published,
    )
  );
}

function pair(
  db: DemoDb,
  user: Account,
  termId: string,
  studentId: string,
  actor: "advisor" | "student" | "either",
) {
  const term = db.terms.find((t) => t.id === termId);
  assert(term, "Không tìm thấy đợt đồ án.", "NOT_FOUND");
  assert(
    !term.locked && !["COMPLETED", "CANCELLED"].includes(term.status),
    "Đợt đã khóa hoặc kết thúc, không thể thay đổi hồ sơ.",
    "TERM_LOCKED",
  );
  const assignment = db.assignments.find(
    (a) => a.termId === termId && a.studentId === studentId && a.published,
  );
  assert(
    assignment,
    "Sinh viên chưa có kết quả phân công GVHD đã công bố.",
    "ASSIGNMENT_REQUIRED",
  );
  const advisor = isAdvisor(db, termId, studentId, user);
  const student =
    user.roles.includes("STUDENT") && user.studentId === studentId;
  assert(
    actor === "advisor"
      ? advisor
      : actor === "student"
        ? student
        : advisor || student,
    "Chỉ GVHD được phân công hoặc sinh viên trong hồ sơ được thực hiện thao tác này.",
    "FORBIDDEN",
  );
  return { term, assignment };
}

function approved(db: DemoDb, termId: string, studentId: string) {
  assert(
    db.topics.some(
      (t) =>
        t.termId === termId &&
        t.studentId === studentId &&
        ["APPROVED", "LOCKED"].includes(t.status),
    ),
    "Đề cương phải được nhóm duyệt/Khoa phê duyệt trước khi thực hiện hướng dẫn.",
    "PROPOSAL_NOT_APPROVED",
  );
}

function phaseOpen(db: DemoDb, termId: string, names: string[]) {
  const term = db.terms.find((t) => t.id === termId)!;
  const phase = term.phases.find((p) =>
    names.some((name) => p.name.toLocaleLowerCase("vi").includes(name)),
  );
  if (phase) {
    assert(!phase.locked, `Giai đoạn ${phase.name} đã khóa.`, "PHASE_LOCKED");
    assert(
      !isOverdue(phase.end),
      `Đã hết hạn giai đoạn ${phase.name}. Giáo vụ cần điều chỉnh kế hoạch.`,
      "DEADLINE_PASSED",
    );
  }
}

function notify(
  db: DemoDb,
  termId: string,
  userId: string,
  title: string,
  content: string,
) {
  db.notifications.unshift({
    id: uid("notice"),
    termId,
    userId,
    title,
    content,
    status: "SENT",
    read: false,
  });
}

export function isOverdue(deadline: string) {
  const end = new Date(`${deadline}T23:59:59.999+07:00`).getTime();
  return Number.isFinite(end) && Date.now() > end;
}

export function latestSubmission(task: Task) {
  return task.submissions[task.submissions.length - 1];
}

export function validatePdf(file: StoredFile) {
  assert(
    file.name.toLowerCase().endsWith(".pdf") && file.type === "application/pdf",
    "Báo cáo cuối cùng phải là tệp .pdf với MIME application/pdf.",
  );
  assert(
    file.size > 0 && file.size <= 4 * 1024 * 1024,
    "Tệp PDF demo phải có dung lượng từ 1 byte đến 4 MB.",
  );
  assert(
    file.dataUrl,
    "PDF phải được tải lên từ thiết bị, không sử dụng liên kết bên ngoài.",
  );
  let header = "";
  try {
    const [metadata, data] = file.dataUrl.split(",", 2);
    header = metadata.includes(";base64")
      ? atob(data).slice(0, 5)
      : decodeURIComponent(data).slice(0, 5);
  } catch {
    /* Invalid encoding is rejected below. */
  }
  assert(
    header === "%PDF-",
    "Nội dung tệp không có chữ ký %PDF-. Vui lòng chọn một tệp PDF thực.",
  );
}

function validateAttachments(files: StoredFile[]) {
  assert(
    files.length > 0 && files.length <= 8,
    "Nộp báo cáo và mã nguồn, tối đa 8 tệp/liên kết mỗi lần.",
  );
  for (const file of files) {
    assert(file.name.trim(), "Tên tệp không được trống.");
    if (file.url) {
      let valid = false;
      try {
        const url = new URL(file.url);
        valid = url.protocol === "https:" || url.protocol === "http:";
      } catch {
        /* Validation below. */
      }
      assert(
        valid,
        "Liên kết mã nguồn phải là URL http:// hoặc https:// hợp lệ.",
      );
    } else
      assert(
        file.dataUrl && file.size > 0 && file.size <= 4 * 1024 * 1024,
        "Mỗi tệp phải có nội dung và không vượt quá 4 MB.",
      );
  }
  assert(
    files.some((f) => !f.url && /\.(pdf|docx?|txt|md)$/i.test(f.name)),
    "Cần ít nhất một báo cáo (.pdf, .doc, .docx, .txt hoặc .md).",
  );
  assert(
    files.some((f) => f.url || /\.(zip|rar|7z|tar|gz)$/i.test(f.name)),
    "Cần mã nguồn dạng .zip/.rar/.7z/.tar/.gz hoặc liên kết repository.",
  );
}

export function defenseReadiness(
  db: DemoDb,
  termId: string,
  studentId: string,
) {
  const tasks = db.tasks.filter(
    (t) => t.termId === termId && t.studentId === studentId,
  );
  const final = db.finals.find(
    (f) => f.termId === termId && f.studentId === studentId,
  );
  const pass = tasks.filter(
    (t) => latestSubmission(t)?.status === "PASS",
  ).length;
  const completed = tasks.filter(
    (t) =>
      ["PASS", "FAIL"].includes(latestSubmission(t)?.status || "") &&
      t.progress === 100,
  ).length;
  const minimum =
    db.terms.find((t) => t.id === termId)?.parameters.min_weekly_pass_rate ??
    0.8;
  const proposal = db.topics.find(
    (t) => t.termId === termId && t.studentId === studentId,
  );
  let validFinal = false;
  if (final) {
    try {
      validatePdf(final.file);
      validFinal = true;
    } catch {
      /* Invalid historical/mock files cannot make a dossier eligible. */
    }
  }
  const checks = [
    {
      label: "Đề cương đã được nhóm duyệt/Khoa phê duyệt",
      ok: !!proposal && ["APPROVED", "LOCKED"].includes(proposal.status),
    },
    {
      label: `Toàn bộ nhiệm vụ tuần hoàn thành và có đánh giá cuối (${completed}/${tasks.length})`,
      ok: tasks.length > 0 && completed === tasks.length,
    },
    {
      label: `Tỷ lệ tuần đạt tối thiểu ${Math.round(minimum * 100)}% (hiện tại ${tasks.length ? Math.round((pass / tasks.length) * 100) : 0}%)`,
      ok: tasks.length > 0 && pass / tasks.length >= minimum,
    },
    { label: "Đã nộp PDF đồ án hoàn chỉnh hợp lệ", ok: validFinal },
    {
      label: "Không có quyết định bảo lưu được chấp thuận",
      ok: !db.deferments.some(
        (d) =>
          d.termId === termId &&
          d.studentId === studentId &&
          d.status === "APPROVED",
      ),
    },
  ];
  return {
    checks,
    eligible: checks.every((c) => c.ok),
    tasks,
    final,
    pass,
    completed,
    minimum,
  };
}

/** Mock adapter for UC14–UC17. Replace these methods with HTTP calls without changing pages. */
export const guidanceService = {
  snapshot: () => readDb(),
  savePlan(termId: string, studentId: string, input: PlanInput) {
    return mutate("Lưu kế hoạch hướng dẫn", ["LECTURER"], (db, user) => {
      const { assignment } = pair(db, user, termId, studentId, "advisor");
      approved(db, termId, studentId);
      phaseOpen(db, termId, ["hướng dẫn"]);
      const values = validate(planSchema, input);
      const old = db.plans.find(
        (p) => p.termId === termId && p.studentId === studentId,
      );
      const plan: GuidancePlan = {
        id: old?.id || uid("plan"),
        termId,
        studentId,
        lecturerId: assignment.lecturerId,
        ...values,
        updatedAt: now(),
      };
      if (old) Object.assign(old, plan);
      else db.plans.push(plan);
      return plan;
    });
  },
  deletePlan(id: string) {
    return mutate("Xóa kế hoạch hướng dẫn", ["LECTURER"], (db, user) => {
      const plan = db.plans.find((p) => p.id === id);
      assert(plan, "Không tìm thấy kế hoạch.");
      pair(db, user, plan.termId, plan.studentId, "advisor");
      assert(
        !db.tasks.some(
          (t) => t.termId === plan.termId && t.studentId === plan.studentId,
        ),
        "Kế hoạch đã có nhiệm vụ. Hãy chỉnh sửa kế hoạch thay vì xóa.",
      );
      db.plans = db.plans.filter((p) => p.id !== id);
    });
  },
  saveTask(termId: string, studentId: string, input: TaskInput, id?: string) {
    return mutate("Giao/cập nhật nhiệm vụ tuần", ["LECTURER"], (db, user) => {
      const { assignment } = pair(db, user, termId, studentId, "advisor");
      approved(db, termId, studentId);
      phaseOpen(db, termId, ["hướng dẫn"]);
      assert(
        !db.finals.some(
          (f) =>
            f.termId === termId && f.studentId === studentId && f.confirmed,
        ),
        "Hồ sơ đã được xác nhận bảo vệ. Cần thu hồi xác nhận trước khi sửa nhiệm vụ.",
      );
      const values = validate(taskSchema, input);
      assert(
        !isOverdue(values.deadline),
        "Ngày giao/hạn nhiệm vụ phải từ hôm nay trở đi.",
      );
      const old = id
        ? db.tasks.find(
            (t) =>
              t.id === id && t.termId === termId && t.studentId === studentId,
          )
        : undefined;
      assert(!id || old, "Không tìm thấy nhiệm vụ.", "NOT_FOUND");
      assert(
        !db.tasks.some(
          (t) =>
            t.termId === termId &&
            t.studentId === studentId &&
            t.week === values.week &&
            t.id !== id,
        ),
        "Sinh viên đã có nhiệm vụ trong tuần này. Hãy cập nhật nhiệm vụ hiện có.",
      );
      const task: Task = {
        id: old?.id || uid("task"),
        termId,
        studentId,
        lecturerId: assignment.lecturerId,
        ...values,
        progress: old?.progress || 0,
        submissions: old?.submissions || [],
      };
      if (old) Object.assign(old, task);
      else db.tasks.push(task);
      notify(
        db,
        termId,
        studentId,
        `Nhiệm vụ tuần ${task.week}`,
        `${task.title}. Hạn nộp: ${task.deadline}.`,
      );
      return task;
    });
  },
  deleteTask(id: string) {
    return mutate("Xóa nhiệm vụ tuần", ["LECTURER"], (db, user) => {
      const task = db.tasks.find((t) => t.id === id);
      assert(task, "Không tìm thấy nhiệm vụ.");
      pair(db, user, task.termId, task.studentId, "advisor");
      assert(
        !task.submissions.length,
        "Nhiệm vụ đã có bài nộp; không thể xóa lịch sử.",
      );
      db.tasks = db.tasks.filter((t) => t.id !== id);
    });
  },
  updateProgress(id: string, progress: number) {
    return mutate("Cập nhật tiến độ nhiệm vụ", ["STUDENT"], (db, user) => {
      const task = db.tasks.find((t) => t.id === id);
      assert(task, "Không tìm thấy nhiệm vụ.");
      pair(db, user, task.termId, task.studentId, "student");
      phaseOpen(db, task.termId, ["hướng dẫn"]);
      approved(db, task.termId, task.studentId);
      assert(
        !db.finals.some(
          (f) =>
            f.termId === task.termId &&
            f.studentId === task.studentId &&
            f.confirmed,
        ),
        "Hồ sơ đã được GVHD xác nhận bảo vệ; không thể thay đổi tiến độ.",
      );
      assert(
        !isOverdue(task.deadline),
        "Nhiệm vụ đã quá hạn. Liên hệ GVHD để gia hạn.",
        "DEADLINE_PASSED",
      );
      assert(
        !["SUBMITTED", "PASS"].includes(latestSubmission(task)?.status || ""),
        "Bài đã nộp đang chờ đánh giá hoặc đã đạt.",
      );
      assert(
        Number.isInteger(progress) && progress >= 0 && progress <= 100,
        "Tiến độ phải từ 0 đến 100%.",
      );
      task.progress = progress;
    });
  },
  submitTask(
    id: string,
    input: { content: string; files: StoredFile[]; progress: number },
  ) {
    return mutate("Nộp báo cáo và mã nguồn tuần", ["STUDENT"], (db, user) => {
      const task = db.tasks.find((t) => t.id === id);
      assert(task, "Không tìm thấy nhiệm vụ.");
      pair(db, user, task.termId, task.studentId, "student");
      approved(db, task.termId, task.studentId);
      phaseOpen(db, task.termId, ["hướng dẫn"]);
      assert(
        !db.finals.some(
          (f) =>
            f.termId === task.termId &&
            f.studentId === task.studentId &&
            f.confirmed,
        ),
        "Hồ sơ đã được GVHD xác nhận bảo vệ; không thể nộp lại báo cáo tuần.",
      );
      assert(
        !isOverdue(task.deadline),
        "Đã hết hạn nộp. GVHD cần gia hạn nhiệm vụ trước khi nộp lại.",
        "DEADLINE_PASSED",
      );
      assert(
        !["SUBMITTED", "PASS"].includes(latestSubmission(task)?.status || ""),
        "Bài đã nộp đang chờ đánh giá hoặc đã đạt.",
      );
      assert(
        input.content.trim().length >= 10,
        "Nội dung báo cáo cần ít nhất 10 ký tự.",
      );
      assert(
        input.progress === 100,
        "Hoàn thành 100% nhiệm vụ trước khi nộp báo cáo.",
      );
      validateAttachments(input.files);
      task.progress = 100;
      task.submissions.push({
        id: uid("submission"),
        at: now(),
        content: input.content.trim(),
        files: input.files,
        status: "SUBMITTED",
        feedback: "",
      });
      notify(
        db,
        task.termId,
        task.lecturerId,
        "Có báo cáo tuần cần đánh giá",
        `Sinh viên ${db.students.find((s) => s.id === task.studentId)?.name} đã nộp nhiệm vụ tuần ${task.week}.`,
      );
    });
  },
  reviewTask(
    taskId: string,
    submissionId: string,
    status: ReviewStatus,
    feedback: string,
  ) {
    return mutate(
      "Nhận xét và đánh giá báo cáo tuần",
      ["LECTURER"],
      (db, user) => {
        const task = db.tasks.find((t) => t.id === taskId);
        assert(task, "Không tìm thấy nhiệm vụ.");
        pair(db, user, task.termId, task.studentId, "advisor");
        const submission = latestSubmission(task);
        assert(
          submission?.id === submissionId && submission.status === "SUBMITTED",
          "Chỉ đánh giá lần nộp mới nhất đang chờ duyệt. Hãy tải lại dữ liệu.",
          "CONFLICT",
        );
        assert(
          ["PASS", "FAIL", "REVISION"].includes(status),
          "Trạng thái đánh giá không hợp lệ.",
        );
        assert(feedback.trim().length >= 5, "Nhập nhận xét tối thiểu 5 ký tự.");
        Object.assign(submission, { status, feedback: feedback.trim() });
        notify(
          db,
          task.termId,
          task.studentId,
          `Phản hồi nhiệm vụ tuần ${task.week}`,
          feedback.trim(),
        );
      },
    );
  },
  saveMeeting(
    termId: string,
    studentId: string,
    input: MeetingInput,
    id?: string,
  ) {
    return mutate(
      "Lưu nhật ký hướng dẫn",
      ["LECTURER", "STUDENT"],
      (db, user) => {
        const { assignment } = pair(db, user, termId, studentId, "either");
        const values = validate(meetingSchema, input);
        assert(
          Number.isFinite(new Date(values.at).getTime()),
          "Ngày giờ buổi hướng dẫn không hợp lệ.",
        );
        const old = id
          ? db.meetings.find(
              (m) =>
                m.id === id && m.termId === termId && m.studentId === studentId,
            )
          : undefined;
        assert(!id || old, "Không tìm thấy buổi hướng dẫn.");
        const meeting: Meeting = {
          id: old?.id || uid("meeting"),
          termId,
          studentId,
          lecturerId: assignment.lecturerId,
          ...values,
        };
        if (old) Object.assign(old, meeting);
        else db.meetings.push(meeting);
      },
    );
  },
  deleteMeeting(id: string) {
    return mutate("Xóa nhật ký hướng dẫn", ["LECTURER"], (db, user) => {
      const meeting = db.meetings.find((m) => m.id === id);
      assert(meeting, "Không tìm thấy buổi hướng dẫn.");
      pair(db, user, meeting.termId, meeting.studentId, "advisor");
      db.meetings = db.meetings.filter((m) => m.id !== id);
    });
  },
  submitFinal(termId: string, studentId: string, file: StoredFile) {
    return mutate("Nộp PDF đồ án hoàn chỉnh", ["STUDENT"], (db, user) => {
      const { assignment } = pair(db, user, termId, studentId, "student");
      approved(db, termId, studentId);
      phaseOpen(db, termId, ["cuối cùng", "final"]);
      validatePdf(file);
      const existing = db.finals.find(
        (f) => f.termId === termId && f.studentId === studentId,
      );
      assert(
        !existing?.confirmed,
        "GVHD đã xác nhận hồ sơ bảo vệ; cần thu hồi xác nhận trước khi nộp bản mới.",
      );
      if (existing) {
        existing.revisions.push(existing.file);
        existing.file = file;
        existing.submittedAt = now();
        existing.comment = "";
      } else
        db.finals.push({
          id: uid("final"),
          termId,
          studentId,
          file,
          submittedAt: now(),
          confirmed: false,
          comment: "",
          revisions: [],
        });
      notify(
        db,
        termId,
        assignment.lecturerId,
        "Sinh viên đã nộp PDF đồ án hoàn chỉnh",
        `${db.students.find((s) => s.id === studentId)?.name} đã nộp ${file.name}. Vui lòng kiểm tra hồ sơ bảo vệ.`,
      );
    });
  },
  confirmDefense(
    termId: string,
    studentId: string,
    confirmed: boolean,
    comment: string,
  ) {
    return mutate(
      confirmed
        ? "GVHD xác nhận đủ điều kiện bảo vệ"
        : "GVHD thu hồi xác nhận bảo vệ",
      ["LECTURER"],
      (db, user) => {
        pair(db, user, termId, studentId, "advisor");
        const readiness = defenseReadiness(db, termId, studentId);
        assert(readiness.final, "Sinh viên chưa nộp PDF đồ án hoàn chỉnh.");
        assert(
          !db.defenses.some(
            (d) => d.termId === termId && d.studentId === studentId,
          ),
          "Sinh viên đã được lập lịch bảo vệ; liên hệ Giáo vụ xử lý trước khi thay đổi xác nhận.",
        );
        if (confirmed) {
          assert(
            readiness.eligible,
            readiness.checks
              .filter((c) => !c.ok)
              .map((c) => c.label)
              .join("; "),
            "NOT_ELIGIBLE",
          );
          validatePdf(readiness.final.file);
        }
        assert(
          comment.trim().length >= 10,
          "Nhận xét của GVHD cần ít nhất 10 ký tự.",
        );
        readiness.final.confirmed = confirmed;
        readiness.final.comment = comment.trim();
        notify(
          db,
          termId,
          studentId,
          confirmed ? "GVHD đồng ý cho bảo vệ" : "Đã thu hồi xác nhận bảo vệ",
          comment.trim(),
        );
      },
    );
  },
};
