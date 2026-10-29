import { RotateCcw, CheckCheck, X, Undo2, Unlock } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ProposalWithdrawSchema,
  ProposalReturnToDraftSchema,
  ProposalReopenSchema,
} from '@doan/shared';
import type {
  ProposalEditorContext,
  ProposalLifecycleAction,
  ProposalWithdraw,
  ProposalReturnToDraft,
  ProposalReopen,
} from '@doan/shared';
import { proposalVersionApi as api } from './api';
import { getErrorMessage } from '../../shared/api/error-message';

const labels: Record<ProposalLifecycleAction, string> = {
  withdraw: 'Rút về nháp',
  'return-to-draft': 'Trả về nháp',
  reopen: 'Mở lại đề cương',
};
const explanations: Record<ProposalLifecycleAction, string> = {
  withdraw:
    'Rút bản đang chờ duyệt để chỉnh sửa. Vòng được giao sẽ dừng; bản đã nộp và lịch sử được giữ lại.',
  'return-to-draft':
    'Trả đề cương đang duyệt cho sinh viên chỉnh sửa. Vòng duyệt hiện tại sẽ dừng và giữ lại các nhận xét.',
  reopen:
    'Mở lại bản đã duyệt để chỉnh sửa. Bản chốt cũ sẽ được đánh dấu đã thay thế; kế hoạch hướng dẫn tạm dừng đến khi chốt lại và GVHD xác nhận tiếp tục.',
};
type Request = {
  action: ProposalLifecycleAction;
  body: ProposalWithdraw | ProposalReturnToDraft | ProposalReopen;
};

export function ProposalLifecycleActions({
  context,
  onTransition,
}: {
  context: ProposalEditorContext;
  onTransition: () => void;
}) {
  const client = useQueryClient(),
    lastKey = useRef<{ payload: string; key: string }>();
  const [action, setAction] = useState<ProposalLifecycleAction | null>(null),
    [reason, setReason] = useState(''),
    [validation, setValidation] = useState(''),
    [success, setSuccess] = useState('');
  const mutation = useMutation({
    mutationFn: ({ action, body }: Request) => {
      const payload = JSON.stringify({ action, body });
      if (lastKey.current?.payload !== payload)
        lastKey.current = { payload, key: crypto.randomUUID() };
      return api.transition(
        context.proposalId,
        action,
        body,
        lastKey.current.key,
      );
    },
    onSuccess: async (_, request) => {
      await Promise.all(
        [
          ['proposal-editing-context', context.proposalId],
          ['proposal-version-history', context.proposalId],
          ['review-proposal', context.proposalId],
          ['review-history', context.proposalId],
          ['proposal-review'],
          ['proposal-editor-list'],
          ['proposal-queue'],
          ['proposal-dossier', context.proposalId],
          ['dossier-list'],
          ['guidance-context', context.proposalId],
          ['guidance-proposals'],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
      onTransition();
      setSuccess(
        request.action === 'withdraw'
          ? 'Đã rút đề cương về nháp. Hãy lưu một bản mới trước khi nộp lại.'
          : request.action === 'return-to-draft'
            ? 'Đã trả đề cương về nháp và dừng vòng duyệt hiện tại.'
            : 'Đã mở lại đề cương. Bản chốt cũ được giữ trong lịch sử; kế hoạch hướng dẫn liên quan đã tạm dừng.',
      );
      setAction(null);
      setReason('');
    },
  });
  const allowed = context.lifecycle?.allowedActions ?? [];
  if (!allowed.length && !success) return null;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!action || !allowed.includes(action) || !context.submittedVersionId)
      return;
    const common = {
      expectedProposalRevision: context.revision,
      versionId: context.submittedVersionId,
    };
    const review = context.lifecycle?.reviewId
      ? {
          reviewId: context.lifecycle.reviewId,
          expectedReviewRevision: context.lifecycle.reviewRevision,
        }
      : {};
    const parsed =
      action === 'withdraw'
        ? ProposalWithdrawSchema.safeParse({
            ...common,
            ...review,
            reason: reason.trim() || undefined,
          })
        : action === 'return-to-draft'
          ? ProposalReturnToDraftSchema.safeParse({
              ...common,
              ...review,
              reason,
            })
          : ProposalReopenSchema.safeParse({
              ...common,
              expectedDossierRevision:
                context.lifecycle?.dossierRevision ?? undefined,
              reason,
            });
    if (!parsed.success) {
      setValidation(parsed.error.issues.map((i) => i.message).join('; '));
      return;
    }
    setValidation('');
    mutation.mutate({ action, body: parsed.data });
  }
  return (
    <section
      className="rg-panel space-y-4 p-5"
      aria-label="Thao tác trạng thái đề cương"
    >
      {success && (
        <p role="status" className="text-emerald-800">
          {success}
        </p>
      )}
      {!!allowed.length && (
        <div className="flex flex-wrap gap-3">
          {allowed.map((value) => (
            <button
              type="button"
              className="rounded border border-amber-400 px-4 py-2 text-sm action-with-icon"
              key={value}
              disabled={mutation.isPending}
              onClick={() => {
                setAction(value);
                setReason('');
                setValidation('');
                setSuccess('');
                mutation.reset();
              }}
            >
              {value === 'reopen' ? (
                <Unlock size={16} aria-hidden="true" />
              ) : (
                <Undo2 size={16} aria-hidden="true" />
              )}
              {labels[value]}
            </button>
          ))}
        </div>
      )}
      {action && allowed.includes(action) && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">{explanations[action]}</p>
          <label className="block text-sm">
            Lý do{action === 'withdraw' ? ' (tùy chọn)' : ' (bắt buộc)'}
            <textarea
              aria-label="Lý do thay đổi trạng thái"
              className="mt-2 w-full rounded border p-2"
              rows={3}
              maxLength={2000}
              required={action !== 'withdraw'}
              disabled={mutation.isPending}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {(validation || mutation.error) && (
            <p role="alert" className="text-red-800">
              {validation ||
                getErrorMessage(
                  mutation.error,
                  'Không thể đổi trạng thái đề cương.',
                )}{' '}
              <button
                type="button"
                className="underline action-with-icon"
                onClick={() => window.location.reload()}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Tải lại từ server
              </button>
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded bg-amber-700 px-4 py-2 text-sm text-white action-with-icon"
              disabled={
                mutation.isPending || (action !== 'withdraw' && !reason.trim())
              }
            >
              <CheckCheck size={16} aria-hidden="true" />
              {mutation.isPending
                ? 'Đang xử lý…'
                : `Xác nhận ${labels[action].toLocaleLowerCase('vi-VN')}`}
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                setAction(null);
                mutation.reset();
              }}
              className="action-with-icon"
            >
              <X size={16} aria-hidden="true" />
              Hủy
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
