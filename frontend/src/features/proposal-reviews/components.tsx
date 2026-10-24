import React, { useRef, useState } from 'react';
import type { ProposalReviewView, ReviewDecisionInput } from '@doan/shared';
import { ReviewDecisionSchema } from '@doan/shared';
export const reviewStatusLabel = (state: string) =>
  ({
    SUBMITTED: 'Chờ duyệt',
    UNDER_REVIEW: 'Đang duyệt',
    REVISION_REQUESTED: 'Yêu cầu sửa',
    REVISION_REQUIRED: 'Yêu cầu sửa',
    APPROVED: 'Đã duyệt',
    DRAFT: 'Bản nháp',
    REJECTED: 'Legacy — cần đối soát',
    ASSIGNED: 'Đã phân nhóm',
    IN_REVIEW: 'Đang xét',
    DECIDED: 'Đã kết luận',
    SUPERSEDED: 'Đã thay thế',
  })[state] ?? state;
export function ReviewState({
  loading,
  error,
  empty,
  children,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  children?: React.ReactNode;
}) {
  if (loading)
    return (
      <p
        role="status"
        className="rounded-lg border bg-white p-8 text-slate-500"
      >
        Đang tải đề cương…
      </p>
    );
  if (error)
    return (
      <p
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"
      >
        {error}
      </p>
    );
  if (empty)
    return (
      <div className="rounded-lg border bg-white p-10 text-center">
        <h2 className="font-semibold">Chưa có đề cương</h2>
        <p className="mt-2 text-slate-500">
          Không có hồ sơ trong phạm vi và bộ lọc đã chọn.
        </p>
      </div>
    );
  return <>{children}</>;
}
export function ProposalContent({ content }: { content: unknown }) {
  const labels: Record<string, string> = {
    schemaVersion: 'Phiên bản cấu trúc',
    objectives: 'Mục tiêu',
    scope: 'Phạm vi',
    mainContents: 'Nội dung chính',
    tools: 'Công cụ',
    expectedResults: 'Kết quả dự kiến',
    startsAt: 'Bắt đầu',
    endsAt: 'Kết thúc',
    schedule: 'Kế hoạch thực hiện',
    label: 'Mốc',
    deliverables: 'Sản phẩm',
  };
  function render(value: unknown): React.ReactNode {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value))
      return (
        <ol className="space-y-3">
          {value.map((item, i) => (
            <li className="rounded border p-3" key={i}>
              {render(item)}
            </li>
          ))}
        </ol>
      );
    if (typeof value === 'object')
      return (
        <dl className="space-y-4">
          {Object.entries(value).map(([key, item]) => (
            <div key={key}>
              <dt className="mb-1 text-xs font-semibold text-slate-500">
                {labels[key] ?? key}
              </dt>
              <dd className="whitespace-pre-wrap break-words text-sm">
                {render(item)}
              </dd>
            </div>
          ))}
        </dl>
      );
    return String(value);
  }
  return (
    <section className="rg-panel p-5">
      <h2 className="mb-5 font-semibold">Nội dung phiên bản được xét</h2>
      {render(content)}
    </section>
  );
}
export function ReviewEvidence({ review }: { review: ProposalReviewView }) {
  return (
    <>
      <section className="rg-panel p-5">
        <h2 className="font-semibold">
          Nhận xét thành viên ({review.comments.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Nhận xét tham khảo; kết luận chung được lưu riêng. Chưa áp dụng tiêu
          chí hoặc kết quả cá nhân.
        </p>
        <div className="mt-4 space-y-4">
          {!review.comments.length && (
            <p className="text-sm text-slate-500">Chưa có nhận xét.</p>
          )}
          {review.comments.map((c) => (
            <article className="rounded border p-4" key={c.id}>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                <span>{c.authorName} · phiên bản đang xét</span>
                <time>
                  {new Date(c.createdAt).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  })}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {c.text}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="rg-panel p-5">
        <h2 className="font-semibold">Kết luận chung của vòng</h2>
        {review.decision ? (
          <div className="mt-3">
            <strong>{reviewStatusLabel(review.decision.decision)}</strong>
            <p className="mt-1 text-xs text-slate-500">
              {review.decision.deciderName} ·{' '}
              {new Date(review.decision.decidedAt).toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
              })}
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words">
              {review.decision.comment}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Chưa có kết luận chung. Mỗi vòng chỉ có một quyết định có hiệu lực.
          </p>
        )}
      </section>
    </>
  );
}
export function DecisionForm({
  review,
  busy,
  onSubmit,
}: {
  review: ProposalReviewView;
  busy: boolean;
  onSubmit: (input: ReviewDecisionInput) => void;
}) {
  const revisions =
    useRef<
      Pick<
        ReviewDecisionInput,
        'expectedProposalRevision' | 'expectedReviewRevision' | 'versionId'
      >
    >();
  const currentRevisions = {
    expectedProposalRevision: review.proposalRevision,
    expectedReviewRevision: review.revision,
    versionId: review.versionId,
  };
  const [decision, setDecision] = useState<'APPROVED' | 'REVISION_REQUIRED'>(
      'APPROVED',
    ),
    [comment, setComment] = useState(''),
    [error, setError] = useState('');
  return (
    <form
      className="rg-panel space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = ReviewDecisionSchema.safeParse({
          ...(revisions.current ?? currentRevisions),
          decision,
          comment: comment || undefined,
        });
        if (!parsed.success) {
          setError(parsed.error.issues.map((i) => i.message).join('; '));
          return;
        }
        setError('');
        onSubmit(parsed.data);
      }}
    >
      <h2 className="font-semibold">
        Kết luận phiên bản {review.versionNumber} — vòng {review.roundNumber}
      </h2>
      <p className="text-xs text-slate-500">
        Quyết định chung không thể sửa trong cùng vòng. APPROVED chưa phải là
        Khoa chốt hồ sơ.
      </p>
      <label className="block text-sm">
        Kết quả chung
        <select
          aria-label="Kết quả chung"
          className="mt-2 w-full rounded border p-2"
          value={decision}
          onChange={(e) => {
            revisions.current ??= currentRevisions;
            setDecision(e.target.value as typeof decision);
          }}
          disabled={busy}
        >
          <option value="APPROVED">Đạt — APPROVED</option>
          <option value="REVISION_REQUIRED">
            Yêu cầu sửa — REVISION_REQUIRED
          </option>
        </select>
      </label>
      <label className="block text-sm">
        Nhận xét kết luận
        <textarea
          aria-label="Nhận xét kết luận"
          className="mt-2 w-full rounded border p-2"
          value={comment}
          onChange={(e) => {
            revisions.current ??= currentRevisions;
            setComment(e.target.value);
          }}
          required={decision === 'REVISION_REQUIRED'}
          maxLength={10000}
          rows={4}
          disabled={busy}
        />
      </label>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
        disabled={busy}
      >
        Xác nhận kết luận chung
      </button>
    </form>
  );
}
