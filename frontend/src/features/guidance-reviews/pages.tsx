import React, { useRef, useState, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ProgressReviewCreate,
  ProgressReviewAmend,
  GuidanceMonitorQuery,
  GuidanceMeetingCreate,
  GuidanceMeetingAmend,
  GuidanceMeetingView,
} from "@doan/shared";
import { progressApi as api } from "./api";
import { submissionApi } from "../task-submissions/api";
import { GuidanceState, vietnamDate } from "../guidance-tasks/components";
import { getErrorMessage } from "../../shared/api/error-message";
import {
  ProgressReviewForm,
  ProgressReviewHistory,
  ProgressTaskTable,
  GuidanceMeetingForm,
  progressDecisionLabel,
  MeetingHistoryContent,
} from "./components";
const issue = (e: unknown) =>
  e ? getErrorMessage(e, "Không thể xử lý đánh giá/tiến độ.") : undefined;
function useKey() {
  const keys = useRef(new Map<string, string>());
  return (input: unknown) => {
    const v = JSON.stringify(input);
    if (!keys.current.has(v)) keys.current.set(v, crypto.randomUUID());
    return keys.current.get(v)!;
  };
}
function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Trang trước
      </button>
      <span>
        Trang {page} / {Math.max(1, totalPages)}
      </span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Trang sau
      </button>
    </div>
  );
}
function useTerm() {
  const [params, setParams] = useSearchParams(),
    termId = params.get("termId") ?? "",
    options = useQuery({
      queryKey: ["progress-options"],
      queryFn: api.options,
    });
  const select = (
    <label className="block">
      Đợt đồ án
      <select
        aria-label="Đợt đồ án"
        value={termId}
        onChange={(e) => setParams({ termId: e.target.value })}
        className="ml-3 max-w-full rounded border p-2"
      >
        <option value="">Chọn đợt</option>
        {options.data?.terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
  return { termId, options, select };
}
export function ProgressReviewInboxPage() {
  const { termId, options, select } = useTerm(),
    [page, setPage] = useState(1),
    [pending, setPending] = useState("true"),
    [decision, setDecision] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => setPage(1), [termId]);
  const q: GuidanceMonitorQuery = {
      page,
      limit: 20,
      pending: (pending as "true" | "false") || undefined,
      decision: (decision as GuidanceMonitorQuery["decision"]) || undefined,
      search: search || undefined,
    },
    query = useQuery({
      queryKey: ["progress-inbox", termId, q],
      staleTime: 0,
      queryFn: () => api.inbox(termId, q),
      enabled: !!termId && !!options.data?.canReview,
    });
  return (
    <div className="space-y-5">
      <h1>Báo cáo cần nhận xét</h1>
      {select}
      <GuidanceState loading={options.isLoading} error={issue(options.error)} />
      {options.data && !options.data.canReview && (
        <p role="alert">Chức năng dành cho GVHD có quyền đánh giá.</p>
      )}
      {termId && options.data?.canReview && (
        <>
          <div className="flex flex-wrap gap-3">
            <label>
              Trạng thái xét
              <select
                aria-label="Lọc trạng thái xét"
                value={pending}
                onChange={(e) => {
                  setPending(e.target.value);
                  setPage(1);
                }}
                className="ml-2 rounded border p-2"
              >
                <option value="true">Chờ đánh giá</option>
                <option value="false">Đã có đánh giá</option>
                <option value="">Tất cả bài đã nộp</option>
              </select>
            </label>
            <label>
              Kết quả
              <select
                aria-label="Lọc kết quả"
                value={decision}
                onChange={(e) => {
                  setDecision(e.target.value);
                  setPending("");
                  setPage(1);
                }}
                className="ml-2 rounded border p-2"
              >
                <option value="">Tất cả</option>
                <option value="PASS">Đạt</option>
                <option value="FAIL">Không đạt</option>
                <option value="REVISION_REQUIRED">Cần sửa</option>
              </select>
            </label>
            <input
              aria-label="Tìm sinh viên hoặc nhiệm vụ"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm SV / nhiệm vụ"
              className="rounded border p-2"
            />
          </div>
          <GuidanceState loading={query.isLoading} error={issue(query.error)}>
            {query.data && <ProgressTaskTable rows={query.data.data} />}
          </GuidanceState>
          <Pager
            page={page}
            totalPages={query.data?.totalPages ?? 0}
            onChange={setPage}
          />
        </>
      )}
      {!termId && (
        <p>Chọn đợt để xem bài nộp của SV đang được phân công hướng dẫn.</p>
      )}
    </div>
  );
}
export function ProgressReviewDetailPage() {
  const { submissionId = "" } = useParams(),
    client = useQueryClient(),
    key = useKey(),
    [amending, setAmending] = useState(false),
    [epoch, setEpoch] = useState(0),
    [success, setSuccess] = useState(""),
    [downloadError, setDownloadError] = useState("");
  const query = useQuery({
      queryKey: ["progress-review-context", submissionId],
      staleTime: 0,
      queryFn: () => api.context(submissionId),
      refetchOnWindowFocus: false,
    }),
    c = query.data;
  const save = useMutation({
    mutationFn: (input: ProgressReviewCreate | ProgressReviewAmend) =>
      amending
        ? api.amend(
            c!.effectiveReview!.id,
            input as ProgressReviewAmend,
            key(input),
          )
        : api.record(submissionId, input, key(input)),
    onSuccess: async () => {
      setAmending(false);
      setEpoch((v) => v + 1);
      setSuccess("Đã lưu đánh giá, lịch sử và thông báo cho sinh viên.");
      await Promise.all(
        [
          "progress-review-context",
          "progress-inbox",
          "guidance-dashboard",
          "guidance-task",
          "guidance-tasks",
          "guidance-plan-tasks",
          "task-submission-context",
          "task-submissions",
          "weekly-coverage",
          "guidance-notifications",
        ].map((k) => client.invalidateQueries({ queryKey: [k] })),
      );
    },
  });
  return (
    <div className="space-y-5 min-w-0">
      <Link
        className="text-blue-700"
        to={c ? `/guidance/tasks/${c.taskId}/submissions` : "/guidance/tasks"}
      >
        ← Báo cáo và lịch sử nộp
      </Link>
      <h1>{c?.allowedActions.some((action) => action === "review" || action === "amend")
        ? "Đánh giá báo cáo sinh viên" : "Kết quả đánh giá báo cáo"}</h1>
      <GuidanceState loading={query.isLoading} error={issue(query.error)}>
        {c && (
          <>
            <section className="rg-panel p-5 space-y-3">
              <h2 className="font-semibold text-lg">
                {c.taskTitle} · Lần nộp{" "}
                {c.submission.versionNumber ?? "chưa đối soát"}
              </h2>
              <p>
                {c.studentName} · {c.studentCode} ·{" "}
                {c.periodLabel ?? "Chưa cấu hình mốc"}
              </p>
              <p>
                Nộp lúc{" "}
                {c.submission.submittedAt
                  ? vietnamDate(c.submission.submittedAt)
                  : "Chưa đối soát"}{" "}
                ·{" "}
                {c.submission.isLate === true
                  ? "Nộp trễ"
                  : c.submission.isLate === false
                    ? "Đúng hạn"
                    : "Chưa xác định đúng/trễ"}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {c.submission.content}
              </p>
              {c.currentSubmissionId !== c.submission.id && (
                <p role="status" className="text-amber-800">
                  Đây là bản nộp cũ. Không thể đánh giá hoặc sửa đánh giá trên
                  phiên bản này.
                </p>
              )}
              {c.submission.files.map((f) => (
                <button
                  key={f.id}
                  className="block max-w-full break-all text-left text-blue-700 underline"
                  onClick={() => {
                    setDownloadError("");
                    void submissionApi
                      .download(c.submission.id, f.id, f.originalName)
                      .catch((e) =>
                        setDownloadError(issue(e) ?? "Không tải được file."),
                      );
                  }}
                >
                  Tải{" "}
                  {f.kind === "REPORT"
                    ? "báo cáo"
                    : f.kind === "SOURCE"
                      ? "source"
                      : "minh chứng"}
                  : {f.originalName}
                </button>
              ))}
              {downloadError && <p role="alert">{downloadError}</p>}
              <p>
                Kết quả lần nộp này:{" "}
                <strong>
                  {progressDecisionLabel(c.effectiveReview?.decision ?? null)}
                </strong>
              </p>
            </section>
            {c.effectiveReview?.decision === "REVISION_REQUIRED" && (
              <p
                role="status"
                className="rounded border border-amber-200 bg-amber-50 p-4 whitespace-pre-wrap break-words"
              >
                Yêu cầu chỉnh sửa: {c.effectiveReview.comment}
              </p>
            )}
            {c.effectiveReview?.decision === "FAIL" && (
              <p
                role="status"
                className="rounded border border-red-200 bg-red-50 p-4 whitespace-pre-wrap break-words"
              >
                Báo cáo không đạt; cần làm và nộp lại:{" "}
                {c.effectiveReview.comment}
              </p>
            )}
            {(c.allowedActions.includes("review") ||
              (amending && c.allowedActions.includes("amend"))) && (
              <ProgressReviewForm
                key={`${submissionId}-${epoch}-${amending}`}
                context={c}
                amending={amending}
                busy={save.isPending}
                onSave={(v) => save.mutate(v)}
              />
            )}
            {c.allowedActions.includes("amend") && !amending && (
              <button
                className="rounded border px-4 py-2"
                onClick={() => setAmending(true)}
              >
                Sửa đánh giá có lý do
              </button>
            )}
            {!c.allowedActions.length &&
              c.currentSubmissionId === c.submission.id && (
                <p>
                  Chế độ xem. Chỉ GVHD hiện hành được đánh giá khi hồ sơ, kế
                  hoạch và giai đoạn hợp lệ.
                </p>
              )}
            {save.error && (
              <p role="alert" className="text-red-700">
                {issue(save.error)} Nội dung đang nhập được giữ lại; tải bản mới
                trước khi gửi tiếp.
              </p>
            )}
            {success && (
              <p role="status" className="text-green-700">
                {success}
              </p>
            )}
            <ProgressReviewHistory reviews={c.history} />
            <div className="flex flex-wrap gap-4">
              <Link
                className="text-blue-700"
                to={`/guidance/tasks/${c.taskId}/submissions`}
              >
                Xem yêu cầu và nộp lại
              </Link>
              <Link
                className="text-blue-700"
                to={`/guidance/meetings?planId=${(c.submission.contextSnapshot as { planId?: string } | null)?.planId ?? ""}`}
              >
                Nhật ký hướng dẫn
              </Link>
              {c.allowedActions.length > 0 && (
                <Link
                  className="text-blue-700"
                  to={`/guidance/plan/${c.proposalId}/tasks/new`}
                >
                  Giao việc tiếp theo
                </Link>
              )}
              <button
                className="text-blue-700"
                onClick={async () => {
                  await query.refetch();
                  setAmending(false);
                  setEpoch((v) => v + 1);
                }}
              >
                Tải phiên bản hiện tại
              </button>
            </div>
          </>
        )}
      </GuidanceState>
    </div>
  );
}
export function GuidanceProgressDashboardPage() {
  const { termId, options, select } = useTerm(),
    [page, setPage] = useState(1),
    [advisorId, setAdvisor] = useState(""),
    [studentId, setStudent] = useState("");
  useEffect(() => {
    setPage(1);
    setAdvisor("");
    setStudent("");
  }, [termId]);
  const q: GuidanceMonitorQuery = {
      page,
      limit: 20,
      advisorId: advisorId || undefined,
      studentId: studentId || undefined,
    },
    query = useQuery({
      queryKey: ["guidance-dashboard", termId, q],
      staleTime: 0,
      queryFn: () => api.dashboard(termId, q),
      enabled: !!termId && !!options.data?.canMonitor,
    }),
    d = query.data;
  return (
    <div className="space-y-5">
      <h1>Theo dõi tiến độ toàn đợt</h1>
      {select}
      <GuidanceState loading={options.isLoading} error={issue(options.error)} />
      {options.data && !options.data.canMonitor && (
        <p role="alert">Chức năng dành cho Khoa có phạm vi được cấp.</p>
      )}
      {termId && options.data?.canMonitor && (
        <>
          <div className="flex flex-wrap gap-3">
            <label>
              GVHD
              <select
                aria-label="Lọc GVHD"
                value={advisorId}
                onChange={(e) => {
                  setAdvisor(e.target.value);
                  setPage(1);
                }}
                className="ml-2 max-w-full rounded border p-2"
              >
                <option value="">Tất cả trong phạm vi</option>
                {d?.advisors.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sinh viên
              <select
                aria-label="Lọc sinh viên"
                value={studentId}
                onChange={(e) => {
                  setStudent(e.target.value);
                  setPage(1);
                }}
                className="ml-2 max-w-full rounded border p-2"
              >
                <option value="">Tất cả trong phạm vi</option>
                {d?.students.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} · {s.code}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <GuidanceState loading={query.isLoading} error={issue(query.error)}>
            {d && (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {(
                    [
                      ["Tổng nhiệm vụ", d.metrics.totalTasks],
                      ["Đã hoàn thành (Đạt)", d.metrics.completed],
                      ["Nhiệm vụ chưa nộp", d.metrics.notSubmitted],
                      ["Nhiệm vụ quá hạn", d.metrics.overdue],
                      ["Cần làm/nộp lại", d.metrics.needsResubmission],
                      ["Không đạt", d.metrics.failed],
                      ["Cần sửa", d.metrics.revisionRequired],
                      ["Chờ đánh giá", d.metrics.pendingReview],
                    ] as const
                  ).map(([label, n]) => (
                    <section className="rg-panel p-4" key={label}>
                      <h2 className="text-sm text-slate-500">{label}</h2>
                      <strong className="text-2xl" data-metric={label}>
                        {n}
                      </strong>
                    </section>
                  ))}
                </div>
                <p className="text-sm">
                  Nhiệm vụ hủy: {d.metrics.cancelled}; dữ liệu cũ chưa đối soát:{" "}
                  {d.metrics.legacyUnknown}. Các nhóm có thể giao nhau. Thời
                  điểm thống kê: {vietnamDate(d.asOf)}.
                </p>
                <section className="rg-panel p-5 space-y-2">
                  <h2 className="font-semibold">
                    Nghĩa vụ báo cáo tuần (kể cả chưa có task)
                  </h2>
                  {d.weekly.coverageState === "NOT_CONFIGURED" && (
                    <p role="alert" className="text-amber-800">
                      Cấu hình tuần/đối tượng/nghĩa vụ chưa đầy đủ. Các số dưới
                      đây chỉ phản ánh phần đã xác định.
                    </p>
                  )}
                  <p>
                    Tổng nghĩa vụ: {d.weekly.required} · Đã nộp:{" "}
                    {d.weekly.submitted} · Chưa nộp: {d.weekly.missing} · Chưa
                    tới tuần: {d.weekly.notDue}
                  </p>
                  <p>
                    Quá hạn chưa nộp: {d.weekly.overdue} · Chưa có kế hoạch:{" "}
                    {d.weekly.missingPlan} · Chưa có nhiệm vụ:{" "}
                    {d.weekly.missingTask}
                  </p>
                  <p className="text-sm text-slate-500">
                    Bài Không đạt/Cần sửa vẫn là đã nộp. Thống kê này không xác
                    nhận hoàn thành SV hoặc điều kiện bảo vệ.
                  </p>
                </section>
                <ProgressTaskTable rows={d.tasks.data} />
                <Pager
                  page={page}
                  totalPages={d.tasks.totalPages}
                  onChange={setPage}
                />
              </>
            )}
          </GuidanceState>
        </>
      )}
      {!termId && <p>Chọn đợt để xem thống kê trong phạm vi Khoa.</p>}
    </div>
  );
}
export function GuidanceMeetingsPage() {
  const client = useQueryClient();
  const [params] = useSearchParams(),
    planId = params.get("planId") ?? "",
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<GuidanceMeetingView | null>(null),
    [epoch, setEpoch] = useState(0),
    [success, setSuccess] = useState(""),
    key = useKey();
  const query = useQuery({
    queryKey: ["guidance-meetings", planId, page],
    staleTime: 0,
    queryFn: () => api.meetings(planId, page),
    refetchOnWindowFocus: false,
    enabled: !!planId,
  });
  const save = useMutation({
    mutationFn: (v: GuidanceMeetingCreate | GuidanceMeetingAmend) =>
      editing
        ? api.amendMeeting(editing.id, v as GuidanceMeetingAmend, key(v))
        : api.createMeeting(planId, v as GuidanceMeetingCreate, key(v)),
    onSuccess: async () => {
      setEditing(null);
      setEpoch((v) => v + 1);
      setSuccess("Đã lưu nhật ký và lịch sử hướng dẫn.");
      await client.invalidateQueries({ queryKey: ["guidance-context"] });
      await query.refetch();
    },
  });
  return (
    <div className="space-y-5">
      <h1>Nhật ký buổi hướng dẫn</h1>
      <Link
        className="text-blue-700"
        to={
          query.data
            ? `/guidance/plan/${query.data.proposalId}`
            : "/guidance/plan"
        }
      >
        ← Chọn / xem kế hoạch hướng dẫn
      </Link>
      {!planId && (
        <p>Mở kế hoạch của sinh viên rồi chọn “Nhật ký hướng dẫn”.</p>
      )}
      <GuidanceState
        loading={!!planId && query.isLoading}
        error={issue(query.error)}
      >
        {query.data && (
          <>
            <p>Sinh viên: {query.data.studentName}</p>
            {query.data.canCreate && (
              <GuidanceMeetingForm
                key={editing?.id ?? "new-" + epoch}
                planRevision={query.data.planRevision}
                meeting={editing ?? undefined}
                busy={save.isPending}
                onSave={(v) => save.mutate(v)}
              />
            )}
            {save.error && (
              <p role="alert" className="text-red-700">
                {issue(save.error)} Nội dung đang nhập được giữ lại.
              </p>
            )}
            {success && <p role="status">{success}</p>}
            {!query.data.data.length && <p>Chưa có nhật ký hướng dẫn.</p>}
            {query.data.data.map((m) => (
              <article key={m.id} className="rg-panel p-5 space-y-3">
                <h2 className="font-semibold">
                  {vietnamDate(m.occurredAt)} ·{" "}
                  {m.mode === "ONLINE"
                    ? "Trực tuyến"
                    : m.mode === "IN_PERSON"
                      ? "Trực tiếp"
                      : "Dữ liệu cũ chưa đối soát"}
                </h2>
                <p className="break-words">{m.location}</p>
                <p className="whitespace-pre-wrap break-words">
                  Nội dung: {m.discussion ?? "Chưa đối soát"}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  Kết luận: {m.conclusion ?? "Chưa đối soát"}
                </p>
                {m.canAmend && (
                  <button
                    className="text-blue-700"
                    onClick={() => setEditing(m)}
                  >
                    Sửa nhật ký
                  </button>
                )}
                <details>
                  <summary>Lịch sử thay đổi ({m.history.length})</summary>
                  {m.history.map((h) => (
                    <div key={h.id} className="mt-3">
                      <p>
                        {vietnamDate(h.createdAt)} · {h.reason} · {h.actorId}
                      </p>
                      <MeetingHistoryContent snapshot={h.snapshot} />
                    </div>
                  ))}
                </details>
              </article>
            ))}
            <Pager
              page={page}
              totalPages={query.data.totalPages}
              onChange={setPage}
            />
            <button
              className="text-blue-700"
              onClick={async () => {
                await query.refetch();
                setEditing(null);
                setEpoch((v) => v + 1);
              }}
            >
              Tải nhật ký mới nhất
            </button>
          </>
        )}
      </GuidanceState>
    </div>
  );
}
export function GuidanceNotificationsPage() {
  const [page, setPage] = useState(1),
    query = useQuery({
      queryKey: ["guidance-notifications", page],
      staleTime: 0,
      queryFn: () => api.notifications(page),
    }),
    [error, setError] = useState("");
  return (
    <div className="space-y-5">
      <h1>Thông báo của tôi</h1>
      {error && <p role="alert">{error}</p>}
      <GuidanceState loading={query.isLoading} error={issue(query.error)}>
        {query.data && !query.data.data.length && <p>Chưa có thông báo.</p>}
        {query.data?.data.map((n) => (
          <article className="rg-panel p-5 space-y-3" key={n.id}>
            <h2 className="font-semibold">
              {n.title} · {n.status === "UNREAD" ? "Chưa đọc" : "Đã đọc"}
            </h2>
            <p className="whitespace-pre-wrap break-words">{n.body}</p>
            <p className="text-sm">{vietnamDate(n.createdAt)}</p>
            {n.link?.startsWith("/guidance/") && (
              <Link to={n.link} className="text-blue-700">
                Mở hồ sơ liên quan
              </Link>
            )}
            {n.status === "UNREAD" && (
              <button
                className="ml-4 text-blue-700"
                onClick={async () => {
                  try {
                    await api.read(n.id);
                    await query.refetch();
                  } catch (e) {
                    setError(issue(e) ?? "Không cập nhật được thông báo.");
                  }
                }}
              >
                Đánh dấu đã đọc
              </button>
            )}
          </article>
        ))}
      </GuidanceState>
      <Pager
        page={page}
        totalPages={query.data?.totalPages ?? 0}
        onChange={setPage}
      />
    </div>
  );
}
