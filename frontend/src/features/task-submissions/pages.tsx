import {
  FileUp,
  Send,
  RotateCcw,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskSubmissionCreateSchema } from "@doan/shared";
import type {
  SubmissionFileKind,
  SubmissionUploadPolicy,
  TaskSubmissionContext,
  TaskSubmissionView,
} from "@doan/shared";
import { submissionApi as api } from "./api";
import { GuidanceState, vietnamDate } from "../guidance-tasks/components";
import { getErrorMessage } from "../../shared/api/error-message";
import { guidanceApi } from "../guidance-tasks/api";
const issue = (e: unknown) =>
  getErrorMessage(e, "Không thể xử lý báo cáo/file.");
const kinds: SubmissionFileKind[] = ["REPORT", "SOURCE", "EVIDENCE"];
const labels = {
  REPORT: "Báo cáo PDF",
  SOURCE: "Mã nguồn ZIP",
  EVIDENCE: "Minh chứng",
};
const readinessLabel: Record<string, string> = {
  TERM_003: "Giai đoạn hướng dẫn chưa mở, đã khóa hoặc hết hạn.",
  INPUT_NOT_READY: "Dữ liệu nhiệm vụ hoặc bài nộp cũ cần được đối soát.",
  FILE_POLICY_NOT_CONFIGURED: "Chức năng nộp file đang tạm khóa theo cấu hình.",
  DOSSIER_NOT_FINALIZED: "Hồ sơ chưa có bản chốt hợp lệ hiện hành.",
  PLAN_PAUSED: "Kế hoạch hướng dẫn đang tạm dừng hoặc lưu trữ.",
  REBASE_REQUIRED:
    "GVHD cần xác nhận lại kế hoạch sau khi phân công/bản chốt thay đổi.",
  TOPIC_NOT_AGREED: "GVHD hiện hành cần xác nhận lại đề tài.",
  STATE_TRANSITION_INVALID: "Trạng thái hồ sơ/nhiệm vụ không cho phép nộp.",
  REPORTING_SCOPE_NOT_CONFIGURED: "Chưa cấu hình đầy đủ nghĩa vụ báo cáo tuần.",
};
export function validateSubmissionSelection(
  files: Array<{
    kind: SubmissionFileKind;
    file: Pick<File, "name" | "size" | "type">;
  }>,
  p: SubmissionUploadPolicy,
) {
  for (const kind of kinds) {
    const selected = files.filter((f) => f.kind === kind);
    if (
      (kind !== "EVIDENCE" && selected.length !== 1) ||
      selected.length > p.roles[kind].maxFiles
    )
      return `Cần chọn ${kind === "EVIDENCE" ? "đúng số lượng minh chứng" : "1 " + labels[kind]}.`;
    for (const { file } of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!(p.roles[kind].extensions as string[]).includes(ext))
        return `Định dạng ${labels[kind]} không hợp lệ.`;
      if (!file.size || file.size > p.maxFileBytes)
        return "File rỗng hoặc vượt dung lượng cấu hình.";
      if (
        Array.from(file.name).some((c) => c.charCodeAt(0) < 32) ||
        /[<>:"/\\|?*\u202a-\u202e]/.test(file.name)
      )
        return "Tên file không an toàn.";
    }
  }
  return files.reduce((s, f) => s + f.file.size, 0) > p.maxSubmissionBytes
    ? "Tổng dung lượng vượt cấu hình."
    : null;
}
type Selected = {
  kind: SubmissionFileKind;
  file: File;
  key: string;
  requestKey?: string;
  progress: number;
  uploadId?: string;
  expiresAt?: string;
  error?: string;
};
function SubmissionForm({
  context,
  onSaved,
  onReload,
}: {
  context: TaskSubmissionContext;
  onSaved: () => Promise<void>;
  onReload: () => Promise<TaskSubmissionContext>;
}) {
  const [files, setFiles] = useState<Selected[]>([]),
    [content, setContent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [revision, setRevision] = useState(context.taskRevision),
    [selectionEpoch, setSelectionEpoch] = useState(0),
    keys = useRef(new Map<string, string>()),
    p = context.policy!;
  const update = (key: string, changes: Partial<Selected>) =>
    setFiles((items) =>
      items.map((f) => (f.key === key ? { ...f, ...changes } : f)),
    );
  async function upload() {
    setError("");
    setSuccess("");
    const invalid = validateSubmissionSelection(files, p);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      for (const f of files) {
        if (f.uploadId && Date.parse(f.expiresAt!) > Date.now()) continue;
        const requestKey = f.uploadId
          ? crypto.randomUUID()
          : (f.requestKey ?? f.key);
        update(f.key, { requestKey });
        update(f.key, { progress: 0, error: undefined });
        try {
          const result = await api.stage(
            context.taskId,
            f.kind,
            f.file,
            requestKey,
            (percent) => update(f.key, { progress: percent }),
          );
          update(f.key, {
            uploadId: result.id,
            expiresAt: result.expiresAt,
            progress: 100,
          });
        } catch (e) {
          const code = isAxiosError<{ error?: { code?: string } }>(e)
            ? e.response?.data.error?.code
            : undefined;
          update(f.key, {
            error: issue(e),
            ...([
              "UPLOAD_EXPIRED",
              "UPLOAD_FAILED",
              "FILE_POLICY_CHANGED",
            ].includes(code ?? "")
              ? {
                  requestKey: crypto.randomUUID(),
                  uploadId: undefined,
                  expiresAt: undefined,
                }
              : {}),
          });
          throw e;
        }
      }
      setSuccess(
        "File đã tải lên staging. Bấm Xác nhận nộp để gửi bài chính thức.",
      );
    } catch (e) {
      setError(issue(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const input = TaskSubmissionCreateSchema.parse({
        expectedTaskRevision: revision,
        uploadIds: files.map((f) => f.uploadId),
        content,
      });
      if (files.some((f) => Date.parse(f.expiresAt!) <= Date.now()))
        throw Error("File staging đã hết hạn; chọn và tải lại file.");
      const hash = JSON.stringify(input);
      if (!keys.current.has(hash)) keys.current.set(hash, crypto.randomUUID());
      await api.submit(context.taskId, input, keys.current.get(hash)!);
      setFiles([]);
      setSelectionEpoch((v) => v + 1);
      setContent("");
      await onSaved();
      const latest = await onReload();
      setRevision(latest.taskRevision);
      setSuccess(
        "Đã nộp báo cáo và source. Hệ thống giữ lịch sử; chưa có kết quả đánh giá.",
      );
    } catch (e) {
      setError(issue(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rg-panel p-5 space-y-4">
      <h2 className="font-semibold text-lg">Nộp báo cáo và source</h2>
      <p className="text-sm text-slate-600">
        Bắt buộc 1 báo cáo PDF và 1 source ZIP; tối đa{" "}
        {p.roles.EVIDENCE.maxFiles} minh chứng. Tối đa{" "}
        {p.maxFileBytes / 1024 / 1024} MiB/file,{" "}
        {p.maxSubmissionBytes / 1024 / 1024} MiB/bài. File staging hết hạn sau{" "}
        {p.stagingTtlHours} giờ. File đã nộp được giữ lịch sử.
      </p>
      <p className="text-sm">
        Hạn: {vietnamDate(context.dueDate)} (UTC+7). Nộp muộn vẫn được nhận khi
        phase hướng dẫn còn mở và được ghi nhận là trễ.
      </p>
      {kinds.map((kind) => (
        <label key={kind} className="block rounded border border-dashed p-4">
          {labels[kind]}
          {kind === "EVIDENCE" ? " (tùy chọn)" : " (bắt buộc)"}
          <input
            key={kind + selectionEpoch}
            className="mt-2 block max-w-full text-sm"
            type="file"
            aria-label={labels[kind]}
            multiple={kind === "EVIDENCE"}
            accept={p.roles[kind].extensions.map((e) => "." + e).join(",")}
            disabled={busy}
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              setFiles((old) => [
                ...old.filter((f) => f.kind !== kind),
                ...list.map((file) => ({
                  kind,
                  file,
                  key: crypto.randomUUID(),
                  progress: 0,
                })),
              ]);
              setError("");
              setSuccess("");
            }}
          />
        </label>
      ))}
      {files.map((f) => (
        <div key={f.key} className="space-y-1 break-all text-sm">
          <p>
            {f.file.name} · {(f.file.size / 1024).toFixed(1)} KiB ·{" "}
            {f.uploadId ? "Đã staging" : "Chưa staging"}
          </p>
          <progress
            aria-label={`Upload ${f.file.name}`}
            max={100}
            value={f.progress}
            className="w-full"
          />
          <span>{f.progress}% tải file</span>
          {f.error && (
            <p role="alert" className="text-red-700">
              {f.error}
            </p>
          )}
        </div>
      ))}
      <label className="block">
        Nội dung báo cáo bổ sung
        <textarea
          aria-label="Nội dung báo cáo bổ sung"
          className="mt-2 w-full rounded border p-2"
          value={content}
          maxLength={20000}
          disabled={busy}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy || !files.length}
          onClick={() => void upload()}
          className="rounded border px-4 py-2 action-with-icon"
        >
          <FileUp size={16} aria-hidden="true" />
          {busy ? "Đang xử lý…" : "Tải file lên"}
        </button>
        <button
          disabled={
            busy ||
            !!validateSubmissionSelection(files, p) ||
            files.some((f) => !f.uploadId)
          }
          onClick={() => void submit()}
          className="rounded bg-blue-700 px-4 py-2 text-white action-with-icon"
        >
          <Send size={16} aria-hidden="true" />
          Xác nhận nộp
        </button>
        <button
          disabled={busy}
          className="text-blue-700 action-with-icon"
          onClick={async () => {
            try {
              const latest = await onReload();
              setRevision(latest.taskRevision);
              setError("");
              setSuccess("Đã tải revision mới; giữ các file đang chọn.");
            } catch (e) {
              setError(issue(e));
            }
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Tải trạng thái mới
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Nếu nhiệm vụ thay đổi trong lúc chuẩn bị bài, tải trạng thái mới và kiểm
        tra bài gần nhất trước khi nộp lại.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-green-700">
          {success}
        </p>
      )}
    </section>
  );
}
export function SubmissionHistoryItem({
  submission: s,
  currentId,
  onDownload,
  onViewReview,
}: {
  submission: TaskSubmissionView;
  currentId: string | null;
  onDownload: (submissionId: string, fileId: string, name: string) => void;
  onViewReview?: (submissionId: string) => void;
}) {
  return (
    <article className="rg-panel p-5 space-y-3 min-w-0">
      <h3 className="font-semibold">
        Lần nộp {s.versionNumber ?? "legacy — chưa đối soát"}{" "}
        {s.id === currentId ? "· Hiện hành" : ""}
      </h3>
      <p>
        {s.submittedAt
          ? vietnamDate(s.submittedAt)
          : "Chưa có metadata thời gian chính thức"}{" "}
        ·{" "}
        {s.state === "SUPERSEDED"
          ? "Đã có bản nộp mới"
          : s.state === "REVIEWED"
            ? "Đã ghi nhận đánh giá"
            : s.state === "SUBMITTED"
              ? "Đã nộp"
              : "Legacy — chưa đối soát"}
      </p>
      <p>
        {s.isLate === true
          ? "Nộp trễ"
          : s.isLate === false
            ? "Đúng hạn"
            : "Chưa xác định đúng/trễ"}{" "}
        · Hạn tại lúc nộp:{" "}
        {s.deadlineSnapshot ? vietnamDate(s.deadlineSnapshot) : "Chưa đối soát"}
      </p>
      <p className="text-sm break-all">
        Người nộp: {s.submittedBy ?? "Chưa đối soát"}
      </p>
      {s.content && (
        <p className="whitespace-pre-wrap break-words">{s.content}</p>
      )}
      {s.files.map((f) => (
        <button
          key={f.id}
          className="block max-w-full break-all text-left text-blue-700 underline action-with-icon"
          onClick={() => onDownload(s.id, f.id, f.originalName)}
        >
          <Download size={16} aria-hidden="true" />
          Tải {labels[f.kind]}: {f.originalName} (
          {(f.sizeBytes / 1024).toFixed(1)} KiB)
        </button>
      ))}
      {!s.files.length && <p>Chưa có file private đã đối soát.</p>}
      {onViewReview && (
        <button
          className="text-blue-700 underline action-with-icon"
          onClick={() => onViewReview(s.id)}
        >
          <Eye size={16} aria-hidden="true" />
          Xem nhận xét và đánh giá
        </button>
      )}
    </article>
  );
}
export function TaskSubmissionsPage() {
  const navigate = useNavigate();
  const { id = "" } = useParams(),
    client = useQueryClient(),
    [page, setPage] = useState(1),
    [downloadError, setDownloadError] = useState("");
  const context = useQuery({
      queryKey: ["task-submission-context", id],
      queryFn: () => api.context(id),
    }),
    history = useQuery({
      queryKey: ["task-submissions", id, page],
      queryFn: () => api.list(id, page),
    });
  const task = useQuery({
    queryKey: ["guidance-task", id],
    queryFn: () => guidanceApi.task(id),
  });
  async function refresh() {
    await Promise.all(
      [
        "task-submissions",
        "progress-review-context",
        "progress-inbox",
        "guidance-dashboard",
        "guidance-task",
        "guidance-tasks",
        "guidance-plan-tasks",
        "weekly-coverage",
      ].map((k) => client.invalidateQueries({ queryKey: [k] })),
    );
  }
  async function reload() {
    const result = await context.refetch();
    if (!result.data) throw result.error;
    return result.data;
  }
  return (
    <div className="space-y-5 min-w-0">
      <Link className="text-blue-700" to={`/guidance/tasks/${id}`}>
        ← Chi tiết nhiệm vụ
      </Link>
      <h1>Báo cáo tiến độ và source</h1>
      {task.data && (
        <section className="rg-panel p-5 space-y-2">
          <h2 className="font-semibold">{task.data.title}</h2>
          <p>
            {task.data.studentName} · {task.data.studentCode}
          </p>
          <p className="break-words">{task.data.topicTitle}</p>
          <p>
            Mốc: {task.data.periodLabel ?? "Chưa cấu hình"} · Hạn hiện tại:{" "}
            {vietnamDate(task.data.dueDate)} (UTC+7)
          </p>
        </section>
      )}
      <GuidanceState
        loading={context.isLoading}
        error={context.error ? issue(context.error) : undefined}
      >
        {context.data?.canSubmit && context.data.policy ? (
          <SubmissionForm
            key={id}
            context={context.data}
            onSaved={refresh}
            onReload={reload}
          />
        ) : (
          context.data && (
            <section className="rg-panel p-5">
              <p>
                Hồ sơ đang ở chế độ xem. Chỉ SV sở hữu hồ sơ hợp lệ mới được nộp
                trong giai đoạn hướng dẫn đang mở.
              </p>
              <p className="mt-2 text-sm">
                {context.data.readiness
                  .map((c) => readinessLabel[c])
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
          )
        )}
      </GuidanceState>
      <h2 className="font-semibold text-lg">Lịch sử nộp báo cáo</h2>
      {downloadError && (
        <p role="alert" className="text-red-700">
          {downloadError}
        </p>
      )}
      <GuidanceState
        loading={history.isLoading}
        error={history.error ? issue(history.error) : undefined}
      >
        {history.data && !history.data.data.length && (
          <p className="rg-panel p-5">
            Chưa có bài nộp. Tiến độ ghi chú không thay thế báo cáo.
          </p>
        )}
        {history.data?.data.map((s) => (
          <SubmissionHistoryItem
            key={s.id}
            submission={s}
            currentId={history.data.currentSubmissionId}
            onViewReview={(sid) => navigate(`/guidance/review/${sid}`)}
            onDownload={(sid, fid, name) => {
              setDownloadError("");
              void api
                .download(sid, fid, name)
                .catch((e) => setDownloadError(issue(e)));
            }}
          />
        ))}
      </GuidanceState>
      <div className="flex gap-3 items-center">
        <button
          disabled={page <= 1}
          onClick={() => setPage((v) => v - 1)}
          className="action-with-icon"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Trang trước
        </button>
        <span>
          Trang {page} / {Math.max(1, history.data?.totalPages ?? 1)}
        </span>
        <button
          disabled={page >= (history.data?.totalPages ?? 1)}
          onClick={() => setPage((v) => v + 1)}
          className="action-with-icon"
        >
          <ChevronRight size={16} aria-hidden="true" />
          Trang sau
        </button>
      </div>
    </div>
  );
}
