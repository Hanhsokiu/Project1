import { useState } from "react";
import {
  Save,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  FileUp,
  History,
  Plus,
  Search,
} from "lucide-react";
import {
  Button,
  Card,
  Confirm,
  DataBoundary,
  Empty,
  Field,
  Modal,
  Notice,
  PageHeader,
  Progress,
  readFile,
  date,
} from "../../../shared/components/kit";
import { useAction } from "../../../shared/hooks/use-demo";
import type { DemoDb, StoredFile, Task } from "../../../shared/data/types";
import {
  guidanceService,
  isOverdue,
  latestSubmission,
} from "../services/guidance-service";
import {
  ActionError,
  AttachmentList,
  GuidanceSelector,
  TaskEditor,
  TaskHistory,
  TaskStatus,
  useGuidance,
} from "../components/guidance-kit";

function TaskSubmit({ task, onClose }: { task: Task; onClose: () => void }) {
  const action = useAction();
  const [content, setContent] = useState("");
  const [progress, setProgress] = useState(task.progress);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [repository, setRepository] = useState("");
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const attachments = repository.trim()
    ? [
        ...files,
        {
          name: "Mã nguồn · Repository",
          type: "text/uri-list",
          size: 0,
          url: repository.trim(),
        },
      ]
    : files;
  return (
    <Modal
      wide
      title={`Cập nhật / nộp nhiệm vụ tuần ${task.week}`}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          action
            .run(() =>
              guidanceService.submitTask(task.id, {
                content,
                files: attachments,
                progress,
              }),
            )
            .then(onClose)
            .catch(() => {});
        }}
      >
        <p className="font-semibold">{task.title}</p>
        <Notice>
          Nộp một báo cáo (.pdf, .docx, .txt, .md) và mã nguồn (.zip hoặc liên
          kết repository). Mỗi tệp tối đa 4 MB. Các lần nộp được giữ nguyên lịch
          sử.
        </Notice>
        <ActionError error={action.error} />
        {fileError && <Notice tone="danger">{fileError}</Notice>}
        <Field label={`Tiến độ hoàn thành: ${progress}%`}>
          <input
            aria-label="Tiến độ hoàn thành"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </Field>
        <Button
          type="button"
          variant="secondary"
          disabled={action.pending || reading}
          onClick={() =>
            action
              .run(() => guidanceService.updateProgress(task.id, progress))
              .then(onClose)
              .catch(() => {})
          }
        >
          <Save size={16} aria-hidden="true" />
          Chỉ lưu tiến độ
        </Button>
        <Field label="Nội dung báo cáo / thay đổi so với lần trước">
          <textarea
            rows={4}
            required
            minLength={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Công việc đã hoàn thành, kết quả, khó khăn và kế hoạch tiếp theo…"
          />
        </Field>
        <Field
          label="Báo cáo và tệp mã nguồn"
          hint="Có thể chọn nhiều tệp. Để nộp báo cáo, tiến độ cần đạt 100%."
        >
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md,.zip,.rar,.7z,.tar,.gz"
            disabled={reading}
            onChange={async (e) => {
              const selected = Array.from(e.target.files || []);
              e.target.value = "";
              setFileError("");
              setReading(true);
              try {
                const added = await Promise.all(selected.map(readFile));
                setFiles((current) => [...current, ...added]);
              } catch (error) {
                setFileError((error as Error).message);
              } finally {
                setReading(false);
              }
            }}
          />
        </Field>
        {reading && <p className="muted text-sm">Đang đọc tệp…</p>}
        <AttachmentList
          files={files}
          onRemove={(index) =>
            setFiles((current) => current.filter((_, i) => i !== index))
          }
        />
        <Field
          label="Liên kết mã nguồn"
          hint="Nếu không tải tệp nén, nhập URL repository dùng http:// hoặc https://."
        >
          <input
            type="url"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            placeholder="https://github.com/username/project"
          />
        </Field>
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Đóng
          </Button>
          <Button disabled={action.pending || reading || progress !== 100}>
            <FileUp size={16} />
            {action.pending ? "Đang nộp…" : "Nộp báo cáo và mã nguồn"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BoardContent({ db }: { db: DemoDb }) {
  const context = useGuidance(db);
  const { termId, studentId, student, advisor, own, locked, topic } = context;
  const action = useAction();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [editor, setEditor] = useState<Task | "new" | null>(null);
  const [detailId, setDetailId] = useState("");
  const [submitId, setSubmitId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const all = db.tasks
    .filter((t) => t.termId === termId && t.studentId === studentId)
    .sort((a, b) => a.week - b.week);
  const tasks = all.filter(
    (t) =>
      `${t.week} ${t.title} ${t.description}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")) &&
      (status === "ALL" ||
        (status === "OVERDUE"
          ? isOverdue(t.deadline) && latestSubmission(t)?.status !== "PASS"
          : (latestSubmission(t)?.status || "PENDING") === status)),
  );
  const overdue = all.filter(
    (t) => isOverdue(t.deadline) && latestSubmission(t)?.status !== "PASS",
  );
  const detail = all.find((t) => t.id === detailId),
    submit = all.find((t) => t.id === submitId);
  const canAssign =
    advisor &&
    !locked &&
    !!topic &&
    ["APPROVED", "LOCKED"].includes(topic.status);
  const groups = [
    {
      title: "Đang thực hiện",
      statuses: ["", "FAIL", "REVISION"],
      color: "bg-amber-400",
    },
    {
      title: "Chờ GVHD đánh giá",
      statuses: ["SUBMITTED"],
      color: "bg-indigo-500",
    },
    { title: "Đạt yêu cầu", statuses: ["PASS"], color: "bg-emerald-500" },
  ];
  return (
    <>
      <PageHeader
        eyebrow="HƯỚNG DẪN ĐỒ ÁN / TIẾN ĐỘ TUẦN"
        title="Bảng nhiệm vụ"
        description="Theo dõi công việc, nộp báo cáo và mã nguồn, tiếp nhận phản hồi của GVHD."
        actions={
          canAssign && (
            <Button onClick={() => setEditor("new")}>
              <Plus size={16} />
              Giao nhiệm vụ
            </Button>
          )
        }
      />
      <GuidanceSelector context={context} />
      {student && (
        <>
          <div className="mb-5">
            {overdue.length > 0 ? (
              <Notice tone="warning">
                <strong>
                  {overdue.length} nhiệm vụ đã quá hạn và chưa đạt.
                </strong>{" "}
                Sinh viên cần trao đổi với GVHD để gia hạn hoặc hoàn tất phản
                hồi. Hạn được tính theo giờ Việt Nam.
              </Notice>
            ) : (
              <Notice tone="success">
                Không có nhiệm vụ quá hạn chưa đạt. Tiếp tục thực hiện theo kế
                hoạch.
              </Notice>
            )}
          </div>
          <div className="card mb-6 p-4 flex flex-wrap items-center gap-3">
            <div className="search-input flex-1">
              <Search size={17} />
              <input
                aria-label="Tìm nhiệm vụ"
                placeholder="Tìm tuần, nhiệm vụ, nội dung…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Lọc trạng thái nhiệm vụ"
              className="max-w-xs"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {[
                ["ALL", "Tất cả trạng thái"],
                ["PENDING", "Chưa nộp"],
                ["SUBMITTED", "Chờ đánh giá"],
                ["PASS", "Đạt"],
                ["REVISION", "Cần sửa"],
                ["FAIL", "Không đạt"],
                ["OVERDUE", "Quá hạn chưa đạt"],
              ].map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="muted text-sm">
              {tasks.length}/{all.length} nhiệm vụ
            </span>
          </div>
          {!all.length ? (
            <Card>
              <Empty
                title="Chưa có nhiệm vụ tuần"
                description="GVHD giao nhiệm vụ sau khi đề cương được phê duyệt."
                action={
                  canAssign ? (
                    <Button onClick={() => setEditor("new")}>
                      <Plus size={16} aria-hidden="true" />
                      Giao nhiệm vụ đầu tiên
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="grid xl:grid-cols-3 gap-5 items-start">
              {groups.map((group) => {
                const items = tasks.filter((t) =>
                  group.statuses.includes(latestSubmission(t)?.status || ""),
                );
                return (
                  <section
                    key={group.title}
                    className="rounded-xl bg-slate-100 p-3"
                  >
                    <h2 className="font-semibold px-1 py-3 flex gap-2 items-center">
                      <span className={`w-2 h-2 rounded-full ${group.color}`} />
                      {group.title}
                      <span className="ml-auto text-sm muted">
                        {items.length}
                      </span>
                    </h2>
                    <div className="space-y-3">
                      {items.length ? (
                        items.map((task) => {
                          const latest = latestSubmission(task);
                          const canSubmit =
                            own &&
                            !locked &&
                            !isOverdue(task.deadline) &&
                            !["SUBMITTED", "PASS"].includes(
                              latest?.status || "",
                            );
                          return (
                            <article
                              key={task.id}
                              className="bg-white border rounded-xl p-4 shadow-sm space-y-3"
                            >
                              <div className="flex justify-between items-center gap-2">
                                <span className="eyebrow">
                                  TUẦN {task.week}
                                </span>
                                <TaskStatus task={task} />
                              </div>
                              <h3 className="font-semibold leading-6">
                                {task.title}
                              </h3>
                              <p className="text-sm muted line-clamp-3">
                                {task.description}
                              </p>
                              <Progress value={task.progress} />
                              <p
                                className={`text-xs flex gap-1 items-center ${isOverdue(task.deadline) && latest?.status !== "PASS" ? "text-red-600" : "muted"}`}
                              >
                                {isOverdue(task.deadline) &&
                                  latest?.status !== "PASS" && (
                                    <AlertTriangle size={14} />
                                  )}
                                Hạn: {date(task.deadline)} ·{" "}
                                {task.submissions.length} lần nộp
                              </p>
                              {latest?.feedback && (
                                <p className="text-sm rounded-lg p-2 bg-indigo-50 line-clamp-3">
                                  GVHD: {latest.feedback}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  variant="secondary"
                                  onClick={() => setDetailId(task.id)}
                                >
                                  <History size={14} />
                                  Lịch sử
                                </Button>
                                {canSubmit && (
                                  <Button onClick={() => setSubmitId(task.id)}>
                                    <FileUp size={16} aria-hidden="true" />
                                    Cập nhật / nộp
                                  </Button>
                                )}
                                {advisor && !locked && (
                                  <Button
                                    variant="ghost"
                                    onClick={() => setEditor(task)}
                                  >
                                    <Pencil size={16} aria-hidden="true" />
                                    Sửa / gia hạn
                                  </Button>
                                )}
                                {advisor &&
                                  !locked &&
                                  !task.submissions.length && (
                                    <Button
                                      variant="ghost"
                                      onClick={() => setDeleteId(task.id)}
                                    >
                                      <Trash2 size={16} aria-hidden="true" />
                                      Xóa
                                    </Button>
                                  )}
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <div className="p-5 text-sm muted text-center">
                          Không có nhiệm vụ phù hợp.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
      {editor && (
        <TaskEditor
          context={context}
          task={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {detail && (
        <Modal
          wide
          title={`Tuần ${detail.week} · ${detail.title}`}
          onClose={() => setDetailId("")}
        >
          <TaskHistory task={detail} />
        </Modal>
      )}
      {submit && <TaskSubmit task={submit} onClose={() => setSubmitId("")} />}
      {deleteId && (
        <Confirm
          title="Xóa nhiệm vụ chưa có bài nộp?"
          description="Nhiệm vụ sẽ được xóa khỏi bảng công việc của sinh viên. Nhiệm vụ đã có bài nộp không thể xóa."
          pending={action.pending}
          onClose={() => setDeleteId("")}
          onConfirm={() =>
            action
              .run(() => guidanceService.deleteTask(deleteId))
              .then(() => setDeleteId(""))
              .catch(() => {})
          }
        />
      )}
    </>
  );
}
export default function TaskBoardPage() {
  return <DataBoundary>{(db) => <BoardContent db={db} />}</DataBoundary>;
}
