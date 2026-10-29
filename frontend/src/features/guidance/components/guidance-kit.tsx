import { useState } from "react";
import { X, Save, CalendarDays, Clock3, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  Field,
  FileLink,
  Modal,
  Notice,
  Progress,
  date,
} from "../../../shared/components/kit";
import { useAction } from "../../../shared/hooks/use-demo";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import type { DemoDb, StoredFile, Task } from "../../../shared/data/types";
import {
  guidanceService,
  guidanceStudents,
  isAdvisor,
  isOverdue,
  latestSubmission,
  type TaskInput,
} from "../services/guidance-service";

export function useGuidance(db: DemoDb) {
  const workspace = useWorkspace();
  const students = guidanceStudents(db, workspace.termId, workspace.user);
  const studentId = students.some((s) => s.id === workspace.studentId)
    ? workspace.studentId
    : students[0]?.id || "";
  const student = students.find((s) => s.id === studentId);
  const assignment = db.assignments.find(
    (a) =>
      a.termId === workspace.termId && a.studentId === studentId && a.published,
  );
  const lecturer = db.lecturers.find((l) => l.id === assignment?.lecturerId);
  const topic = db.topics.find(
    (t) => t.termId === workspace.termId && t.studentId === studentId,
  );
  const advisor = isAdvisor(db, workspace.termId, studentId, workspace.user);
  const own =
    !!workspace.user?.roles.includes("STUDENT") &&
    workspace.user.studentId === studentId;
  const locked =
    !!workspace.term?.locked ||
    ["COMPLETED", "CANCELLED"].includes(workspace.term?.status || "");
  return {
    ...workspace,
    db,
    students,
    studentId,
    student,
    assignment,
    lecturer,
    topic,
    advisor,
    own,
    locked,
  };
}
export type GuidanceContext = ReturnType<typeof useGuidance>;

export function GuidanceSelector({ context }: { context: GuidanceContext }) {
  const { studentId, students, setStudentId, lecturer, topic, own, locked } =
    context;
  return (
    <div className="space-y-4 mb-6">
      {!own && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[240px] flex-1 max-w-lg">
            <Field label="Hồ sơ sinh viên">
              <select
                aria-label="Hồ sơ sinh viên"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="" disabled>
                  Chọn sinh viên
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="muted text-sm pb-2">
            {students.length} sinh viên trong phạm vi được phân quyền
          </p>
        </div>
      )}
      {students.length === 0 ? (
        <Empty
          title="Không có sinh viên trong phạm vi hướng dẫn"
          description="Kiểm tra đợt đang chọn, kết quả phân công và quyền của tài khoản."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>{topic?.title || "Sinh viên chưa hoàn tất đề tài"}</strong>
            <p className="text-sm muted mt-1">
              {context.student?.code} · {context.student?.name} · GVHD:{" "}
              {lecturer?.name || "Chưa công bố phân công"}
            </p>
          </div>
          {topic && <Badge value={topic.status} />}
        </div>
      )}
      {locked && (
        <Notice tone="warning">
          Đợt đã khóa hoặc kết thúc. Hồ sơ được mở ở chế độ xem.
        </Notice>
      )}
      {!own && !context.advisor && students.length > 0 && (
        <Notice>
          Chế độ quan sát. Chỉ GVHD được phân công và sinh viên trong hồ sơ được
          cập nhật công việc.
        </Notice>
      )}
    </div>
  );
}

export function ActionError({ error }: { error: Error | null }) {
  return error ? <Notice tone="danger">{error.message}</Notice> : null;
}

export function TaskStatus({ task }: { task: Task }) {
  const latest = latestSubmission(task);
  if (latest) return <Badge value={latest.status} />;
  return (
    <Badge value={isOverdue(task.deadline) ? "FAIL" : "PENDING"}>
      {isOverdue(task.deadline) ? "Quá hạn chưa nộp" : "Đang thực hiện"}
    </Badge>
  );
}

export function TaskHistory({ task }: { task: Task }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-4">
        <p className="whitespace-pre-wrap">{task.description}</p>
        <div className="flex gap-4 flex-wrap mt-3 text-sm muted">
          <span className="flex gap-1 items-center">
            <CalendarDays size={15} />
            Tuần {task.week}
          </span>
          <span className="flex gap-1 items-center">
            <Clock3 size={15} />
            Hạn nộp {date(task.deadline)}
          </span>
        </div>
        <div className="mt-3">
          <Progress value={task.progress} />
        </div>
      </div>
      <h3 className="font-semibold">
        Lịch sử nộp và phản hồi ({task.submissions.length})
      </h3>
      {!task.submissions.length ? (
        <Empty
          title="Chưa có bài nộp"
          description="Báo cáo và mã nguồn sẽ được lưu theo từng lần nộp."
        />
      ) : (
        [...task.submissions].reverse().map((submission, index) => (
          <article
            key={submission.id}
            className="rounded-xl border border-slate-200 p-4 space-y-3"
          >
            <div className="flex gap-3 justify-between flex-wrap">
              <strong>
                Lần {task.submissions.length - index} ·{" "}
                {new Date(submission.at).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </strong>
              <Badge value={submission.status} />
            </div>
            <p className="whitespace-pre-wrap">{submission.content}</p>
            <div className="flex gap-2 flex-wrap">
              {submission.files.map((file, i) => (
                <FileLink key={`${file.name}-${i}`} file={file} />
              ))}
            </div>
            {submission.feedback && (
              <div className="bg-indigo-50 border-l-4 border-indigo-400 p-3 text-sm">
                <strong>GVHD nhận xét</strong>
                <p className="mt-1 whitespace-pre-wrap">
                  {submission.feedback}
                </p>
              </div>
            )}
          </article>
        ))
      )}
    </div>
  );
}

export function TaskEditor({
  context,
  task,
  onClose,
}: {
  context: GuidanceContext;
  task?: Task;
  onClose: () => void;
}) {
  const action = useAction();
  const { db, termId, studentId } = context;
  const tasks = db.tasks.filter(
    (t) => t.termId === termId && t.studentId === studentId,
  );
  const nextWeek = Math.min(52, Math.max(0, ...tasks.map((t) => t.week)) + 1);
  const [form, setForm] = useState<TaskInput>({
    week: task?.week || nextWeek,
    title: task?.title || "",
    description: task?.description || "",
    deadline:
      task?.deadline ||
      new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
  });
  return (
    <Modal
      wide
      title={
        task ? `Cập nhật nhiệm vụ tuần ${task.week}` : "Giao nhiệm vụ tuần"
      }
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          action
            .run(() =>
              guidanceService.saveTask(termId, studentId, form, task?.id),
            )
            .then(onClose)
            .catch(() => {});
        }}
      >
        <ActionError error={action.error} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Tuần hướng dẫn">
            <input
              required
              type="number"
              min={1}
              max={52}
              value={String(form.week)}
              onChange={(e) =>
                setForm({ ...form, week: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Hạn nộp (giờ Việt Nam)">
            <input
              required
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Tên nhiệm vụ">
          <input
            required
            maxLength={250}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ví dụ: Xây dựng chức năng đăng ký nguyện vọng"
          />
        </Field>
        <Field label="Yêu cầu và sản phẩm bàn giao">
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Nội dung công việc, báo cáo cần nộp, mã nguồn và tiêu chí đánh giá…"
          />
        </Field>
        {task?.submissions.length ? (
          <Notice>
            Gia hạn nhiệm vụ giữ nguyên toàn bộ các lần nộp và nhận xét đã có.
          </Notice>
        ) : null}
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Hủy
          </Button>
          <Button disabled={action.pending}>
            <Save size={16} aria-hidden="true" />
            {action.pending ? "Đang lưu…" : "Lưu và thông báo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AttachmentList({
  files,
  onRemove,
}: {
  files: StoredFile[];
  onRemove?: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          className="flex gap-3 items-center justify-between rounded-lg border p-2"
          key={`${file.name}-${index}`}
        >
          <FileLink file={file} />
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              aria-label={`Xóa tệp ${file.name}`}
              onClick={() => onRemove(index)}
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
