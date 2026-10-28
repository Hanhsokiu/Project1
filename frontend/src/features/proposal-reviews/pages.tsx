import React, { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AssignReviewSchema, ReviewCommentSchema } from "@doan/shared";
import type {
  AssignReview,
  ProposalReviewView,
  ReviewCandidate,
  ReviewDecisionInput,
  ReviewQuery,
} from "@doan/shared";
import { proposalReviewApi as api, ReviewProposalDetail } from "./api";
import {
  DecisionForm,
  ProposalContent,
  ReviewEvidence,
  ReviewState,
  reviewStatusLabel,
} from "./components";
import { getErrorMessage } from "../../shared/api/error-message";
const message = (e: unknown) =>
  e ? getErrorMessage(e, "Không thể xử lý đề cương. Hãy thử lại.") : undefined;
function useRequestKey() {
  const saved = useRef<{ payload: string; key: string }>();
  return (payload: unknown) => {
    const signature = JSON.stringify(payload);
    if (saved.current?.payload !== signature)
      saved.current = { payload: signature, key: crypto.randomUUID() };
    return saved.current.key;
  };
}
const date = (v: string) =>
  new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
export function ProposalReviewQueuePage() {
  const [params, setParams] = useSearchParams(),
    termId = params.get("termId") ?? "";
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(params.get("search") ?? ""),
    [departmentId, setDepartment] = useState(""),
    [status, setStatus] = useState(""),
    [unassigned, setUnassigned] = useState(false);
  const terms = useQuery({
    queryKey: ["proposal-review-terms"],
    queryFn: api.terms,
  });
  const requestedSearch = params.get("search");
  useEffect(() => {
    if (requestedSearch !== null) {
      setSearch(requestedSearch);
      setPage(1);
    }
  }, [requestedSearch]);
  useEffect(() => {
    if (!termId && terms.data?.[0])
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("termId", terms.data![0].id);
          return next;
        },
        { replace: true },
      );
  }, [termId, terms.data, setParams]);
  const options = useQuery({
    queryKey: ["proposal-review-options", termId],
    queryFn: () => api.options(termId),
    enabled: !!termId,
  });
  const q: ReviewQuery = {
    page,
    limit: 20,
    search,
    departmentId: departmentId || undefined,
    status: (status || undefined) as ReviewQuery["status"],
    unassigned: unassigned ? "true" : undefined,
  };
  const list = useQuery({
    queryKey: ["proposal-queue", termId, q],
    queryFn: () => api.list(termId, q),
    enabled: !!termId,
  });
  return (
    <>
      <div className="mb-6">
        <h1>Phân công & xét duyệt đề cương</h1>
        <p className="mt-2 text-sm text-slate-500">
          Khoa quản lý trong phạm vi được cấp; giảng viên xem các vòng được phân
          cho nhóm mình.
        </p>
        <Link
          className="mt-3 inline-block text-sm text-blue-700"
          to={`/topic/review-groups?termId=${encodeURIComponent(termId)}`}
        >
          Quản lý nhóm duyệt →
        </Link>
      </div>
      {options.data?.phase ? (
        <p className="mb-5 rounded border bg-white p-4 text-sm">
          Phase duyệt: {date(options.data.phase.startsAt)} —{" "}
          {date(options.data.phase.endsAt)} ·{" "}
          {options.data.phase.isLocked ? "Đã khóa" : "Theo lịch mở"}{" "}
          (Asia/Ho_Chi_Minh)
        </p>
      ) : (
        termId && (
          <p className="mb-5 rounded border border-amber-200 bg-amber-50 p-4 text-sm">
            Chưa có phase PROPOSAL_REVIEW. Không thể ghi phân công hoặc kết luận
            khi đầu vào chưa sẵn sàng.
          </p>
        )
      )}
      <section className="rg-panel mb-5">
        <div className="rg-panel-heading">
          <h2>Hàng đợi / inbox theo đợt</h2>
        </div>
        <div className="rg-filters grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            Đợt đồ án
            <select
              aria-label="Đợt xét duyệt"
              className="mt-2 w-full rounded border p-2"
              value={termId}
              onChange={(e) => {
                setParams({ termId: e.target.value });
                setPage(1);
                setDepartment("");
              }}
            >
              <option value="">Chọn đợt</option>
              {terms.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bộ môn
            <select
              aria-label="Bộ môn xét duyệt"
              className="mt-2 w-full rounded border p-2"
              value={departmentId}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Trong phạm vi được cấp</option>
              {options.data?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái
            <select
              aria-label="Trạng thái đề cương"
              className="mt-2 w-full rounded border p-2"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {[
                "SUBMITTED",
                "UNDER_REVIEW",
                "REVISION_REQUESTED",
                "APPROVED",
              ].map((s) => (
                <option key={s} value={s}>
                  {reviewStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tìm hồ sơ
            <input
              aria-label="Tìm đề cương"
              className="mt-2 w-full rounded border p-2"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tên đề tài, sinh viên, mã SV…"
            />
          </label>
        </div>
        {options.data?.canAssign && (
          <label className="flex items-center gap-2 px-5 py-3 text-sm">
            <input
              type="checkbox"
              checked={unassigned}
              onChange={(e) => {
                setUnassigned(e.target.checked);
                setPage(1);
              }}
            />
            Chỉ hồ sơ chưa có vòng đang hoạt động
          </label>
        )}
      </section>
      <ReviewState
        loading={terms.isLoading || (!!termId && list.isLoading)}
        error={message(terms.error || options.error || list.error)}
        empty={!termId || !list.data?.data.length}
      >
        <section className="rg-panel">
          <div className="rg-table-scroll">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="p-4">Đề cương / sinh viên</th>
                  <th className="p-4">Bộ môn</th>
                  <th className="p-4">Phiên bản</th>
                  <th className="p-4">Trạng thái / nhóm</th>
                  <th className="p-4">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.data.map((p) => (
                  <tr className="border-t" key={p.id}>
                    <td className="p-4">
                      <strong className="block min-w-[180px]">{p.title}</strong>
                      <span className="mt-1 block text-slate-500">
                        {p.studentName} · {p.studentCode}
                      </span>
                    </td>
                    <td className="p-4">
                      {p.departmentName ?? "Chưa có routing"}
                      <small className="block text-slate-500">
                        {p.researchAreaName}
                      </small>
                    </td>
                    <td className="p-4">
                      {p.versionNumber
                        ? `v${p.versionNumber}`
                        : "Chưa sẵn sàng"}
                    </td>
                    <td className="p-4">
                      {reviewStatusLabel(p.status)}
                      <small className="block text-slate-500">
                        {p.groupName ?? "Chưa phân nhóm"}
                      </small>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col items-start gap-2">
                        {p.canAssign && (
                          <Link
                            className="rg-table-action"
                            to={`/topic/review-assignments/${p.id}`}
                          >
                            Hồ sơ / phân công
                          </Link>
                        )}
                        {p.activeReviewId && (
                          <Link
                            className="text-blue-700"
                            to={`/topic/reviews/${p.activeReviewId}`}
                          >
                            Xem vòng được phân
                          </Link>
                        )}
                        {p.readiness.length > 0 && (
                          <span className="text-xs text-amber-700">
                            Thiếu đầu vào bước 1–3
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </ReviewState>
      {list.data && list.data.total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span>
            {list.data.total} hồ sơ · Trang {page}/{list.data.totalPages}
          </span>
          <div className="flex gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-3 py-2 disabled:opacity-40"
            >
              Trước
            </button>
            <button
              disabled={page >= list.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-3 py-2 disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function AssignmentForm({
  proposal,
  candidates,
  activeReview,
  busy,
  onSubmit,
}: {
  proposal: ReviewProposalDetail;
  candidates: ReviewCandidate[];
  activeReview?: ProposalReviewView;
  busy: boolean;
  onSubmit: (v: AssignReview) => void;
}) {
  const [snapshot] = useState({
    proposalRevision: proposal.revision,
    versionId: proposal.submittedVersionId,
    reviewId: activeReview?.id,
    reviewRevision: activeReview?.revision,
  });
  const [groupId, setGroup] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      className="rg-panel space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = AssignReviewSchema.safeParse({
          groupId,
          proposalVersionId: snapshot.versionId,
          expectedProposalRevision: snapshot.proposalRevision,
          ...(snapshot.reviewId
            ? {
                replacesReviewId: snapshot.reviewId,
                expectedReviewRevision: snapshot.reviewRevision,
                reason,
              }
            : {}),
        });
        if (!parsed.success) {
          setError(parsed.error.issues.map((i) => i.message).join("; "));
          return;
        }
        setError("");
        onSubmit(parsed.data);
      }}
    >
      <h2 className="font-semibold">
        Khoa xác nhận phân công — v{proposal.versionNumber}
      </h2>
      <p className="text-sm text-slate-500">
        Danh sách cùng đợt và bộ môn theo hướng đề tài. Khớp chuyên môn là thông
        tin tham khảo; không tự chọn nhóm hoặc áp dụng trọng số.
      </p>
      <label className="block text-sm">
        Nhóm duyệt
        <select
          aria-label="Nhóm nhận đề cương"
          className="mt-2 w-full rounded border p-2"
          required
          value={groupId}
          onChange={(e) => setGroup(e.target.value)}
          disabled={busy}
        >
          <option value="">Khoa chọn nhóm duyệt</option>
          {candidates.map((g) => (
            <option value={g.id} key={g.id} disabled={!g.eligibleReviewerCount}>
              {g.name} · {g.eligibleReviewerCount} người hợp lệ ·{" "}
              {g.specialtyMatchCount} khớp hướng · {g.activeReviewCount} vòng
              active
            </option>
          ))}
        </select>
      </label>
      {!candidates.length && (
        <p className="text-amber-700">
          Chưa có nhóm phù hợp. Tạo nhóm trong bước 4 hoặc kiểm tra mapping.
        </p>
      )}
      {snapshot.reviewId && (
        <label className="block text-sm">
          Lý do phân lại
          <textarea
            aria-label="Lý do phân lại"
            required
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 w-full rounded border p-2"
            disabled={busy}
          />
          <small className="text-slate-500">
            Vòng cũ được giữ lịch sử và thay bằng một vòng mới.
          </small>
        </label>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy || !candidates.some((c) => c.eligibleReviewerCount > 0)}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
      >
        {busy
          ? "Đang xác nhận…"
          : snapshot.reviewId
            ? "Xác nhận phân lại"
            : "Xác nhận phân công"}
      </button>
    </form>
  );
}
export function ProposalReviewAssignmentPage() {
  const { proposalId = "" } = useParams(),
    navigate = useNavigate(),
    client = useQueryClient(),
    key = useRequestKey();
  const proposal = useQuery({
    queryKey: ["review-proposal", proposalId],
    queryFn: () => api.proposal(proposalId),
  });
  const candidates = useQuery({
    queryKey: ["review-candidates", proposalId],
    queryFn: () => api.candidates(proposalId),
    enabled:
      !!proposal.data?.canAssign &&
      ["SUBMITTED", "UNDER_REVIEW"].includes(proposal.data.status),
  });
  const history = useQuery({
    queryKey: ["review-history", proposalId],
    queryFn: () => api.history(proposalId),
  });
  const mutation = useMutation({
    mutationFn: (input: AssignReview) =>
      api.assign(proposalId, input, key(input)),
    onSuccess: async (r) => {
      await client.invalidateQueries({ queryKey: ["proposal-queue"] });
      navigate(`/topic/reviews/${r.id}?saved=assigned`);
    },
  });
  const activeReview = history.data?.find(
    (r) => r.id === proposal.data?.activeReviewId,
  );
  return (
    <>
      <Link
        to="/topic/reviews"
        className="mb-4 inline-block text-sm text-blue-700"
      >
        ← Danh sách đề cương
      </Link>
      <ReviewState
        loading={proposal.isLoading || history.isLoading}
        error={message(proposal.error || history.error)}
      >
        {proposal.data && (
          <div className="space-y-5">
            <h1>{proposal.data.title}</h1>
            <p>
              {proposal.data.studentName} · {proposal.data.studentCode} ·{" "}
              {reviewStatusLabel(proposal.data.status)}
            </p>
            <p className="rounded border bg-white p-4 text-sm">
              Phiên bản đã nộp v{proposal.data.version.versionNumber} ·{" "}
              {date(proposal.data.version.submittedAt)}
              <span className="mt-2 block break-all text-xs text-slate-500">
                Hash: {proposal.data.version.contentHash}
              </span>
            </p>
            {mutation.error && (
              <p
                role="alert"
                className="rounded border border-red-200 bg-red-50 p-4"
              >
                {message(mutation.error)}{" "}
                <button
                  onClick={() => window.location.reload()}
                  className="underline"
                >
                  Tải lại hồ sơ
                </button>
              </p>
            )}
            {proposal.data.canAssign &&
              ["SUBMITTED", "UNDER_REVIEW"].includes(proposal.data.status) && (
                <ReviewState
                  loading={candidates.isLoading}
                  error={message(candidates.error)}
                >
                  {candidates.data && (
                    <AssignmentForm
                      key={proposalId}
                      proposal={proposal.data}
                      candidates={candidates.data}
                      activeReview={activeReview}
                      busy={mutation.isPending}
                      onSubmit={(input) => mutation.mutate(input)}
                    />
                  )}
                </ReviewState>
              )}
            <ProposalContent content={proposal.data.version.content} />
            <ReviewHistory reviews={history.data ?? []} />
          </div>
        )}
      </ReviewState>
    </>
  );
}
export function ReviewHistory({ reviews }: { reviews: ProposalReviewView[] }) {
  return (
    <section className="rg-panel p-5">
      <h2 className="font-semibold">Lịch sử các vòng trong phạm vi truy cập</h2>
      {!reviews.length && (
        <p className="mt-3 text-slate-500">Chưa có vòng duyệt.</p>
      )}
      <ul className="mt-4 space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="rounded border p-3 text-sm">
            <Link className="text-blue-700" to={`/topic/reviews/${r.id}`}>
              Vòng {r.roundNumber} · v{r.versionNumber} · {r.groupName}
            </Link>
            <p className="mt-1 text-slate-500">
              {reviewStatusLabel(r.state)} ·{" "}
              {r.decision
                ? reviewStatusLabel(r.decision.decision)
                : "Chưa có kết luận"}
              {r.assignedAt ? ` · Phân lúc ${date(r.assignedAt)}` : ""}
              {r.assignedByUserId ? ` · Actor ${r.assignedByUserId}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
export function ProposalReviewDetailPage() {
  const { id = "" } = useParams();
  return <ProposalReviewDetail key={id} id={id} />;
}
function ProposalReviewDetail({ id }: { id: string }) {
  const [params, setParams] = useSearchParams(),
    client = useQueryClient(),
    key = useRequestKey();
  const review = useQuery({
    queryKey: ["proposal-review", id],
    queryFn: () => api.detail(id),
  });
  const history = useQuery({
    queryKey: ["review-history", review.data?.proposalId],
    queryFn: () => api.history(review.data!.proposalId),
    enabled: !!review.data,
  });
  const [text, setText] = useState(""),
    [feedback, setFeedback] = useState(""),
    [commentError, setCommentError] = useState("");
  const commentRevision = useRef<number>();
  const clearFeedback = () => {
    setFeedback("");
    if (params.has("saved"))
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("saved");
          return next;
        },
        { replace: true },
      );
  };
  const mutation = useMutation({
    onMutate: () => {
      clearFeedback();
      setCommentError("");
    },
    mutationFn: ({
      kind,
      input,
    }: {
      kind: "start" | "comment" | "decision";
      input: unknown;
    }) => {
      const requestKey = key({ kind, input });
      return kind === "start"
        ? api.start(id, input as Parameters<typeof api.start>[1], requestKey)
        : kind === "comment"
          ? api.comment(
              id,
              input as Parameters<typeof api.comment>[1],
              requestKey,
            )
          : api.decision(id, input as ReviewDecisionInput, requestKey);
    },
    onSuccess: async (_, v) => {
      setFeedback(
        v.kind === "decision"
          ? "Đã lưu kết luận chung."
          : v.kind === "start"
            ? "Đã bắt đầu vòng duyệt."
            : "Đã lưu nhận xét.",
      );
      if (v.kind === "comment") {
        setText("");
        commentRevision.current = undefined;
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ["proposal-review", id] }),
        client.invalidateQueries({ queryKey: ["review-history"] }),
        client.invalidateQueries({ queryKey: ["proposal-queue"] }),
      ]);
    },
  });
  const r = review.data;
  return (
    <>
      <Link
        to="/topic/reviews"
        className="mb-4 inline-block text-sm text-blue-700"
      >
        ← Inbox / danh sách đề cương
      </Link>
      <ReviewState loading={review.isLoading} error={message(review.error)}>
        {r && (
          <div className="space-y-5">
            <div>
              <h1>{r.title}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {r.studentName} · {r.studentCode} · {r.groupName}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-5">
              <strong>
                Đang xem phiên bản v{r.versionNumber} · Vòng {r.roundNumber}
              </strong>
              <p className="mt-2 text-sm">
                {reviewStatusLabel(r.state)} · Đề cương:{" "}
                {reviewStatusLabel(r.proposalStatus)}
              </p>
              <p className="mt-2 break-all text-xs text-slate-500">
                Version ID: {r.versionId}
                <br />
                Hash: {r.version.contentHash ?? "Chưa có hash"}
                <br />
                Nộp lúc:{" "}
                {r.version.submittedAt
                  ? date(r.version.submittedAt)
                  : "Chưa có dữ liệu"}
              </p>
              {r.supersededByReviewId && (
                <p className="mt-3 text-amber-700">
                  Vòng đã được thay thế; không thể ghi kết luận tại đây.
                </p>
              )}
            </div>
            {(feedback || params.get("saved")) && (
              <p
                role="status"
                className="rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
              >
                {feedback || "Đã xác nhận phân công nhóm duyệt."}
              </p>
            )}
            {mutation.error && (
              <p
                role="alert"
                className="rounded border border-red-200 bg-red-50 p-4"
              >
                {message(mutation.error)}{" "}
                <button
                  className="underline"
                  onClick={() => window.location.reload()}
                >
                  Tải lại phiên bản và vòng
                </button>
              </p>
            )}
            {r.allowedActions.includes("assign") && (
              <Link
                className="inline-block text-sm text-blue-700"
                to={`/topic/review-assignments/${r.proposalId}`}
              >
                Khoa điều chỉnh phân công →
              </Link>
            )}
            {r.allowedActions.includes("start") && (
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    kind: "start",
                    input: {
                      expectedProposalRevision: r.proposalRevision,
                      expectedReviewRevision: r.revision,
                    },
                  })
                }
              >
                Bắt đầu duyệt phiên bản {r.versionNumber}
              </button>
            )}
            <ProposalContent content={r.version.content} />
            <ReviewEvidence review={r} />
            {r.allowedActions.includes("comment") && (
              <form
                className="rg-panel space-y-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  clearFeedback();
                  const parsed = ReviewCommentSchema.safeParse({
                    expectedReviewRevision:
                      commentRevision.current ?? r.revision,
                    versionId: r.versionId,
                    text,
                  });
                  if (!parsed.success) {
                    setCommentError(
                      text.trim()
                        ? "Nhận xét không hợp lệ. Hãy tải lại vòng duyệt và thử lại."
                        : "Nội dung nhận xét không được để trống hoặc chỉ gồm khoảng trắng.",
                    );
                    return;
                  }
                  setCommentError("");
                  mutation.mutate({ kind: "comment", input: parsed.data });
                }}
              >
                <h2 className="font-semibold">Thêm nhận xét thành viên</h2>
                <textarea
                  aria-label="Nội dung nhận xét"
                  aria-invalid={!!commentError}
                  aria-describedby={
                    commentError ? "review-comment-error" : undefined
                  }
                  required
                  maxLength={10000}
                  rows={4}
                  className="w-full rounded border p-3"
                  value={text}
                  disabled={mutation.isPending}
                  onChange={(e) => {
                    commentRevision.current ??= r.revision;
                    clearFeedback();
                    setCommentError("");
                    mutation.reset();
                    setText(e.target.value);
                  }}
                />
                {commentError && (
                  <p
                    id="review-comment-error"
                    role="alert"
                    className="text-red-700"
                  >
                    {commentError}
                  </p>
                )}
                <button
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
                  disabled={mutation.isPending}
                >
                  Lưu nhận xét
                </button>
              </form>
            )}
            {r.allowedActions.includes("decide") && (
              <DecisionForm
                key={id}
                review={r}
                busy={mutation.isPending}
                onSubmit={(input) =>
                  mutation.mutate({ kind: "decision", input })
                }
              />
            )}
            <ReviewState
              loading={history.isLoading}
              error={message(history.error)}
            >
              {history.data && <ReviewHistory reviews={history.data} />}
            </ReviewState>
          </div>
        )}
      </ReviewState>
    </>
  );
}
