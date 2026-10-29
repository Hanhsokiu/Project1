import { WorkflowHeading } from "../review-groups/workflow-heading";
import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ProposalContentSchema,
  ProposalVersionSaveSchema,
  SubmittedProposalContentSchema,
  emptyProposalContent,
} from '@doan/shared';
import type {
  ProposalContent,
  ProposalEditorContext,
  ProposalVersionSave,
  ProposalVersionSubmit,
  ProposalVersionView,
  RevisionResponse,
} from '@doan/shared';
import { proposalReviewApi } from '../proposal-reviews/api';
import {
  ProposalContent as ProposalContentView,
  ReviewState,
  reviewStatusLabel,
} from '../proposal-reviews/components';
import { proposalVersionApi as api } from './api';
import { ProposalFields, RevisionFeedback, VersionChanges } from './components';
import { ProposalLifecycleActions } from './lifecycle-actions';
import { getErrorMessage } from '../../shared/api/error-message';
const errorText = (e: unknown) =>
  e ? getErrorMessage(e, 'Không thể tải/lưu đề cương.') : undefined;
const readinessText: Record<string, string> = {
  INPUT_NOT_READY: 'Thiếu dữ liệu đầu vào đã xác nhận từ bước trước',
  TERM_003: 'Đợt hoặc giai đoạn chỉnh sửa chưa mở, đã khóa hoặc hết hạn',
  DOSSIER_LOCKED: 'Hồ sơ đã chốt/khóa hoặc cần đối soát',
  STATE_TRANSITION_INVALID: 'Trạng thái hiện tại chỉ cho phép xem',
  ACTIVE_REVIEW_EXISTS: 'Còn vòng duyệt đang hoạt động',
  TOPIC_NOT_AGREED: 'GVHD cần xác nhận lại đề tài theo phân công hiện hành',
};
function useRequestKey() {
  const last = useRef<{ payload: string; key: string }>();
  return (v: unknown) => {
    const payload = JSON.stringify(v);
    if (last.current?.payload !== payload)
      last.current = { payload, key: crypto.randomUUID() };
    return last.current.key;
  };
}
const timestamp = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
export function ProposalEditorListPage() {
  const [params, setParams] = useSearchParams(),
    termId = params.get('termId') ?? '';
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(params.get('search') ?? '');
  const terms = useQuery({
    queryKey: ['proposal-review-terms'],
    queryFn: proposalReviewApi.terms,
  });
  useEffect(() => {
    if (!termId && terms.data?.[0])
      setParams({ termId: terms.data[0].id }, { replace: true });
  }, [termId, terms.data, setParams]);
  const requestedSearch = params.get('search');
  useEffect(() => {
    if (requestedSearch !== null) {
      setSearch(requestedSearch);
      setPage(1);
    }
  }, [requestedSearch]);
  const list = useQuery({
    queryKey: ['proposal-editor-list', termId, page, search],
    queryFn: () => proposalReviewApi.list(termId, { page, limit: 20, search }),
    enabled: !!termId,
  });
  return (
    <>
      <WorkflowHeading path="/topic/proposal" />
      <div className="rg-panel mb-5 grid gap-4 p-5 sm:grid-cols-2">
        <label className="text-sm">
          Đợt đồ án
          <select
            aria-label="Đợt đề cương"
            className="mt-2 w-full rounded border p-2"
            value={termId}
            onChange={(e) => {
              setParams({ termId: e.target.value });
              setPage(1);
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
        <label className="text-sm">
          Tìm đề cương
          <input
            aria-label="Tìm hồ sơ chỉnh sửa"
            className="mt-2 w-full rounded border p-2"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <ReviewState
        loading={terms.isLoading || (!!termId && list.isLoading)}
        error={errorText(terms.error || list.error)}
        empty={!termId || !list.data?.data.length}
      >
        <div className="grid gap-4">
          {list.data?.data.map((p) => (
            <article
              className="rg-panel flex flex-wrap items-center justify-between gap-4 p-5"
              key={p.id}
            >
              <div>
                <h2 className="font-semibold">{p.title}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {p.studentName} · {p.studentCode} ·{' '}
                  {reviewStatusLabel(p.status)}
                </p>
              </div>
              <Link className="rg-table-action" to={`/topic/proposal/${p.id}`}>
                Mở đề cương & lịch sử
              </Link>
            </article>
          ))}
        </div>
      </ReviewState>
      {list.data && list.data.total > 0 && (
        <div className="mt-4 flex justify-between gap-3 text-sm">
          <p>
            {list.data.total} hồ sơ · Trang {page}/{list.data.totalPages}
          </p>
          <div className="flex gap-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trước
            </button>
            <button
              disabled={page >= list.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function Editor({ context }: { context: ProposalEditorContext }) {
  const client = useQueryClient(),
    key = useRequestKey();
  const [initial] = useState(() =>
    context.status === 'REVISION_REQUESTED'
      ? context.submittedVersion
      : (context.workingVersion ?? context.submittedVersion),
  );
  const parsed = initial
    ? ProposalContentSchema.safeParse(initial.content)
    : { success: true as const, data: emptyProposalContent };
  const [content, setContent] = useState<ProposalContent>(
    parsed.success
      ? structuredClone(parsed.data)
      : structuredClone(emptyProposalContent),
  );
  const [responses, setResponses] = useState<RevisionResponse[]>(
      initial?.responses ?? [],
    ),
    [summary, setSummary] = useState(''),
    [revision, setRevision] = useState(context.revision),
    [baseId, setBaseId] = useState(initial?.id),
    [baseNumber, setBaseNumber] = useState(initial?.versionNumber),
    [currentId, setCurrentId] = useState(context.workingVersionId),
    [dirty, setDirty] = useState(false),
    [feedback, setFeedback] = useState(''),
    [validation, setValidation] = useState('');
  const allowed = context.allowedActions.includes('save') && parsed.success;
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['proposal-editing-context', context.proposalId],
      }),
      client.invalidateQueries({
        queryKey: ['proposal-version-history', context.proposalId],
      }),
      client.invalidateQueries({ queryKey: ['proposal-editor-list'] }),
      client.invalidateQueries({ queryKey: ['proposal-queue'] }),
      client.invalidateQueries({
        queryKey: ['review-proposal', context.proposalId],
      }),
    ]);
  };
  const save = useMutation({
    mutationFn: (input: ProposalVersionSave) =>
      api.save(context.proposalId, input, key({ kind: 'save', input })),
    onSuccess: async (result) => {
      setRevision(result.proposalRevision);
      setBaseId(result.id);
      setBaseNumber(result.versionNumber);
      setResponses(result.responses);
      setCurrentId(result.id);
      setDirty(false);
      setSummary('');
      setFeedback(`Đã lưu snapshot v${result.versionNumber}. Chưa gửi duyệt.`);
      await refresh();
    },
  });
  const submit = useMutation({
    mutationFn: (input: ProposalVersionSubmit) =>
      api.submit(context.proposalId, input, key({ kind: 'submit', input })),
    onSuccess: async (result) => {
      setRevision(result.proposalRevision);
      setDirty(false);
      setFeedback(
        `Đã gửi duyệt phiên bản v${result.versionNumber}. Snapshot đã SEALED; chờ Khoa phân nhóm.`,
      );
      await refresh();
    },
  });
  const busy = save.isPending || submit.isPending;
  function saveDraft() {
    const result = ProposalVersionSaveSchema.safeParse({
      expectedRevision: revision,
      basedOnVersionId: baseId,
      content,
      changeSummary: summary || undefined,
      responses,
    });
    if (!result.success) {
      setValidation(result.error.issues.map((i) => i.message).join('; '));
      return;
    }
    setValidation('');
    save.mutate(result.data);
  }
  function send() {
    if (dirty || !currentId) {
      setValidation('Hãy lưu nháp trước khi gửi bản đang chỉnh sửa.');
      return;
    }
    const parsed = SubmittedProposalContentSchema.safeParse(content);
    if (!parsed.success) {
      setValidation(
        parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      );
      return;
    }
    setValidation('');
    submit.mutate({ expectedRevision: revision, versionId: currentId });
  }
  return (
    <div className="space-y-5">
      {feedback && (
        <p
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
        >
          {feedback}
        </p>
      )}
      {(save.error || submit.error || validation) && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {validation || errorText(save.error || submit.error)}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => window.location.reload()}
          >
            Tải lại từ server
          </button>
        </p>
      )}
      {!parsed.success && (
        <p
          role="alert"
          className="rounded border border-amber-200 bg-amber-50 p-4"
        >
          Nội dung legacy chưa đúng ProposalContentV1. Chỉ xem bản gốc bên dưới;
          cần đối soát trước khi chuyển mẫu, không tự điền thay.
        </p>
      )}
      <section className="rg-panel space-y-5 p-5">
        <div>
          <h2 className="font-semibold">Bản làm việc hiện hành</h2>
          <p className="mt-2 text-xs text-slate-500">
            {baseNumber ? `Dựa trên v${baseNumber}` : 'Bản đầu tiên'} · Mỗi lần
            lưu tạo một bản mới
            {dirty ? ' · Có thay đổi chưa lưu' : ''}
          </p>
        </div>
        {parsed.success ? (
          <ProposalFields
            content={content}
            disabled={!allowed || busy}
            onChange={(value) => {
              setContent(value);
              setDirty(true);
            }}
          />
        ) : (
          initial && <ProposalContentView content={initial.content} />
        )}
        <label className="block text-sm">
          Tóm tắt thay đổi (tùy chọn)
          <textarea
            aria-label="Tóm tắt thay đổi"
            rows={2}
            maxLength={2000}
            className="mt-2 w-full rounded border p-2"
            disabled={!allowed || busy}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          {allowed && (
            <button
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
              disabled={busy}
              onClick={saveDraft}
            >
              {save.isPending ? 'Đang lưu…' : 'Lưu nháp mới'}
            </button>
          )}
          {context.allowedActions.includes('submit') && (
            <button
              className="rounded border border-blue-300 px-4 py-2 text-sm text-blue-700"
              disabled={busy || dirty || !currentId}
              onClick={send}
            >
              {submit.isPending
                ? 'Đang gửi…'
                : context.submittedVersionId
                  ? 'Gửi duyệt lại'
                  : 'Gửi duyệt'}
            </button>
          )}
        </div>
        {!allowed && (
          <p className="text-sm text-slate-500">
            Chỉ đọc theo quyền/trạng thái hiện tại. Không sửa trực tiếp bản đã
            gửi hoặc đã chốt.
          </p>
        )}
      </section>
      <RevisionFeedback
        feedback={context.feedback}
        responses={responses}
        disabled={!allowed || busy}
        onChange={(values) => {
          setResponses(values);
          setDirty(true);
        }}
      />
    </div>
  );
}
function VersionHistory({ proposalId }: { proposalId: string }) {
  const [page, setPage] = useState(1),
    [known, setKnown] = useState<ProposalVersionView[]>([]),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const history = useQuery({
    queryKey: ['proposal-version-history', proposalId, page],
    queryFn: () => api.list(proposalId, page),
  });
  useEffect(() => {
    if (history.data)
      setKnown((old) => {
        const map = new Map(old.map((v) => [v.id, v]));
        for (const v of history.data!.data) map.set(v.id, v);
        return [...map.values()].sort(
          (a, b) => b.versionNumber - a.versionNumber,
        );
      });
  }, [history.data]);
  const compare = useQuery({
    queryKey: ['proposal-version-compare', proposalId, from, to],
    queryFn: () => api.compare(proposalId, from, to),
    enabled: !!from && !!to,
  });
  return (
    <div className="space-y-5">
      <section className="rg-panel p-5">
        <h2 className="mb-4 font-semibold">Lịch sử phiên bản</h2>
        <ReviewState
          loading={history.isLoading}
          error={errorText(history.error)}
          empty={!history.data?.data.length}
        >
          <ul className="space-y-3">
            {history.data?.data.map((v) => (
              <li className="rounded border p-4 text-sm" key={v.id}>
                <Link
                  to={`/topic/proposal/${proposalId}/versions/${v.id}`}
                  className="font-semibold text-blue-700"
                >
                  Phiên bản v{v.versionNumber} ·{' '}
                  {v.state ?? 'LEGACY chưa đối soát'}
                </Link>
                <p className="mt-2 text-xs text-slate-500">
                  {v.authorName ?? 'Chưa có tác giả legacy'} ·{' '}
                  {timestamp(v.createdAt)}
                  {v.submittedAt ? ` · Gửi ${timestamp(v.submittedAt)}` : ''}
                </p>
                {v.changeSummary && (
                  <p className="mt-2 whitespace-pre-wrap break-words">
                    {v.changeSummary}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {history.data && (
            <div className="mt-4 flex justify-between gap-3 text-sm">
              <span>
                Trang {page}/{history.data.totalPages}
              </span>
              <div className="flex gap-4">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Trước
                </button>
                <button
                  disabled={page >= history.data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </ReviewState>
      </section>
      <section className="rg-panel grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">So sánh hai phiên bản</h2>
        {(
          [
            ['Bản trước', from, setFrom],
            ['Bản sau', to, setTo],
          ] as const
        ).map(([label, value, set]) => (
          <label className="text-sm" key={label}>
            {label}
            <select
              aria-label={label}
              className="mt-2 w-full rounded border p-2"
              value={value}
              onChange={(e) => set(e.target.value)}
            >
              <option value="">Chọn phiên bản</option>
              {known.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.state ?? 'LEGACY'}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>
      {from && to && (
        <ReviewState
          loading={compare.isLoading}
          error={errorText(compare.error)}
        >
          {compare.data && <VersionChanges changes={compare.data.changes} />}
        </ReviewState>
      )}
    </div>
  );
}
export function ProposalEditorPage() {
  const { proposalId = '', versionId } = useParams();
  return (
    <ProposalEditorPageContent
      key={proposalId}
      proposalId={proposalId}
      versionId={versionId}
    />
  );
}
function ProposalEditorPageContent({
  proposalId,
  versionId,
}: {
  proposalId: string;
  versionId?: string;
}) {
  const [editorEpoch, setEditorEpoch] = useState(0);
  const context = useQuery({
    queryKey: ['proposal-editing-context', proposalId],
    queryFn: () => api.context(proposalId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const historical = useQuery({
    queryKey: ['proposal-version', proposalId, versionId],
    queryFn: () => api.detail(proposalId, versionId!),
    enabled: !!versionId,
  });
  return (
    <>
      <Link
        className="mb-4 inline-block text-sm text-blue-700"
        to="/topic/proposal"
      >
        ← Danh sách đề cương
      </Link>
      <ReviewState
        loading={
          context.isLoading ||
          (!context.isFetchedAfterMount && context.isFetching)
        }
        error={errorText(context.error)}
      >
        {context.data && (
          <div className="space-y-5">
            <h1>{context.data.title}</h1>
            <p className="text-sm text-slate-500">
              {context.data.studentName} ·{' '}
              {reviewStatusLabel(context.data.status)} · Hồ sơ {proposalId}
            </p>
            {context.data.status === 'APPROVED' && (
              <section className="rounded border border-blue-200 bg-blue-50 p-4 text-sm space-y-3">
                <p>
                  Đề cương đã được duyệt, phiên bản này chỉ xem. Khoa chốt hồ sơ
                  chính thức trước khi sinh viên tải PDF để in, xin chữ ký và nộp Khoa.
                </p>
                <Link
                  className="inline-block font-medium text-blue-700 underline"
                  to={`/topic/dossier/${proposalId}`}
                >
                  Mở hồ sơ & bản in
                </Link>
              </section>
            )}
            {context.data.readiness.length > 0 && (
              <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm">
                Không thể chỉnh sửa hiện tại:{' '}
                {context.data.readiness
                  .map(
                    (code) =>
                      readinessText[code] ?? 'Dữ liệu cần được kiểm tra lại',
                  )
                  .join('; ')}
                . Kiểm tra trạng thái, giai đoạn và dữ liệu đầu vào; hệ thống
                không tự tạo xác nhận.
              </p>
            )}
            {versionId ? (
              <ReviewState
                loading={historical.isLoading}
                error={errorText(historical.error)}
              >
                {historical.data && (
                  <section className="space-y-4">
                    <div className="rg-panel p-5">
                      <h2 className="font-semibold">
                        Đang xem phiên bản lịch sử v
                        {historical.data.versionNumber} — chỉ đọc
                      </h2>
                      <p className="mt-2 text-xs text-slate-500">
                        {historical.data.authorName ??
                          'Tác giả legacy chưa xác định'}{' '}
                        · {timestamp(historical.data.createdAt)}
                      </p>
                      <p className="mt-2 break-all text-xs">
                        Hash:{' '}
                        {historical.data.contentHash ?? 'Chưa có metadata'}
                      </p>
                      <Link
                        className="mt-3 inline-block text-sm text-blue-700"
                        to={`/topic/proposal/${proposalId}`}
                      >
                        Trở lại bản làm việc
                      </Link>
                    </div>
                    <ProposalContentView content={historical.data.content} />
                    <RevisionFeedback
                      feedback={context.data.feedback.filter(
                        (f) =>
                          f.sourceVersionId === historical.data!.id ||
                          historical.data!.responses.some(
                            (r) =>
                              r.targetId === f.targetId &&
                              r.targetType === f.targetType,
                          ),
                      )}
                      responses={historical.data.responses}
                      disabled
                      onChange={() => {}}
                    />
                  </section>
                )}
              </ReviewState>
            ) : (
              <>
                <ProposalLifecycleActions
                  context={context.data}
                  onTransition={() => setEditorEpoch((value) => value + 1)}
                />
                <Editor
                  key={`${proposalId}:${editorEpoch}`}
                  context={context.data}
                />
              </>
            )}
            <VersionHistory proposalId={proposalId} />
          </div>
        )}
      </ReviewState>
    </>
  );
}
