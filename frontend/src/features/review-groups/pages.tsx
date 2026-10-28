import React, { useEffect, useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { GroupCreate } from '@doan/shared';
import {
  ChevronRight,
  ClipboardList,
  Layers,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { reviewGroupApi as api } from './api';
import { GroupState, GroupForm, MemberTable } from './components';
import { Button } from '../../shared/components/ui/Button';
import { getErrorMessage } from '../../shared/api/error-message';

const errorText = (error: unknown) =>
  error
    ? getErrorMessage(error, 'Không thể tải dữ liệu. Hãy thử lại.')
    : undefined;
function useRequestKey() {
  const last = useRef<{ signature: string; key: string }>();
  return (payload: unknown) => {
    const signature = JSON.stringify(payload);
    if (last.current?.signature !== signature)
      last.current = { signature, key: crypto.randomUUID() };
    return last.current!.key;
  };
}
export { ReviewGroupLayout } from './workspace';
function GroupSummary({
  total,
  members,
  reviews,
  manage,
}: {
  total?: number;
  members?: number;
  reviews?: number;
  manage?: boolean;
}) {
  const cards = [
    {
      title: 'Nhóm duyệt',
      value: total ?? '—',
      note: 'Theo bộ lọc đang chọn',
      icon: Layers,
    },
    {
      title: 'Giảng viên',
      value: members ?? '—',
      note: 'Thành viên trên trang hiện tại',
      icon: Users,
    },
    {
      title: 'Vòng đang duyệt',
      value: reviews ?? '—',
      note: 'Trong các nhóm đang hiển thị',
      icon: ClipboardList,
    },
    {
      title: 'Quyền truy cập',
      value: manage === undefined ? '—' : manage ? 'Quản lý' : 'Chỉ xem',
      note: 'Trong đợt đồ án đang chọn',
      icon: ShieldCheck,
    },
  ];
  return (
    <div className="rg-stats">
      {cards.map(({ title, value, note, icon: Icon }) => (
        <div className="rg-stat" key={title}>
          <div className="rg-stat-top">
            <span>{title}</span>
            <span className="rg-stat-icon">
              <Icon size={16} />
            </span>
          </div>
          <strong
            className={`rg-stat-value ${typeof value === 'string' && value !== '—' ? 'rg-stat-value-text' : ''}`}
          >
            {value}
          </strong>
          <p className="rg-stat-note">{note}</p>
        </div>
      ))}
    </div>
  );
}
export function ReviewGroupListPage() {
  const [params, setParams] = useSearchParams();
  const termId = params.get('termId') ?? '';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [departmentId, setDepartment] = useState('');
  const terms = useQuery({
    queryKey: ['review-group-terms'],
    queryFn: api.terms,
  });
  const requestedSearch = params.get('search');
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
          next.set('termId', terms.data![0].id);
          return next;
        },
        { replace: true },
      );
  }, [termId, terms.data, setParams]);
  const options = useQuery({
    queryKey: ['review-group-options', termId],
    queryFn: () => api.options(termId),
    enabled: !!termId,
  });
  const list = useQuery({
    queryKey: ['review-groups', termId, page, search, departmentId],
    queryFn: () => api.list(termId, page, search, departmentId),
    enabled: !!termId,
  });
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nhóm duyệt đề cương
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Quản lý nhóm và giảng viên theo từng đợt đồ án, bộ môn.
          </p>
        </div>
        {options.data?.canManage &&
          ['DRAFT', 'CLOSED_REGISTRATION', 'IN_PROGRESS'].includes(
            options.data.term.status,
          ) && (
            <Link
              aria-label="+ Tạo nhóm"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              to={`/topic/review-groups/new?termId=${encodeURIComponent(termId)}`}
            >
              <span className="flex items-center gap-2">
                <Plus size={16} />
                Tạo nhóm
              </span>
            </Link>
          )}
      </div>
      {params.get('saved') && (
        <p
          role="status"
          className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
        >
          Đã lưu thay đổi nhóm duyệt.
        </p>
      )}
      <GroupSummary
        total={list.data?.total}
        members={
          list.data
            ? new Set(
                list.data.data.flatMap((g) =>
                  g.members.map((m) => m.lecturerId),
                ),
              ).size
            : undefined
        }
        reviews={list.data?.data.reduce(
          (total, group) => total + group.activeReviewCount,
          0,
        )}
        manage={options.data?.canManage}
      />
      <section className="rg-panel">
        <div className="rg-panel-heading">
          <div>
            <h2>Danh sách nhóm duyệt</h2>
            <p>Tổ chức giảng viên theo đợt đồ án và bộ môn</p>
          </div>
          <span className="rg-panel-badge">
            {options.data?.term.name ?? 'Chọn đợt đồ án'}
          </span>
        </div>
        <div className="rg-filters mb-5 grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Đợt đồ án
            <select
              aria-label="Đợt đồ án"
              className="mt-2 w-full rounded border p-2"
              value={termId}
              onChange={(e) => {
                setParams({ termId: e.target.value });
                setDepartment('');
                setPage(1);
              }}
            >
              <option value="">Chọn đợt đồ án</option>
              {terms.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Bộ môn
            <select
              aria-label="Lọc bộ môn"
              className="mt-2 w-full rounded border p-2"
              value={departmentId}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trong phạm vi</option>
              {options.data?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Tên nhóm
            <input
              aria-label="Tìm tên nhóm"
              className="mt-2 w-full rounded border p-2"
              placeholder="Tìm nhóm duyệt…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <GroupState
          loading={terms.isLoading || (!!termId && list.isLoading)}
          error={errorText(terms.error || options.error || list.error)}
          empty={!termId || !list.data?.data.length}
        >
          <div className="rg-table-scroll">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-4">Nhóm duyệt</th>
                  <th className="p-4">Bộ môn</th>
                  <th className="p-4">Thành viên</th>
                  <th className="p-4">Vòng đang hoạt động</th>
                  <th className="p-4">
                    <span className="sr-only">Chi tiết</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data?.data.map((g) => (
                  <tr className="border-t hover:bg-slate-50" key={g.id}>
                    <td className="p-4 font-medium">
                      <div className="rg-group-cell">
                        <span className="rg-group-mark">
                          <Users size={18} />
                        </span>
                        <div>
                          <Link
                            className="text-blue-800"
                            to={`/topic/review-groups/${g.id}`}
                          >
                            {g.name}
                          </Link>
                          <small>Nhóm giảng viên duyệt đề cương</small>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500">{g.departmentName}</td>
                    <td className="p-4 tabular-nums">
                      <span className="rg-member-count">
                        <span className="rg-avatar-stack" aria-hidden="true">
                          {g.members.slice(0, 3).map((m) => (
                            <span key={m.lecturerId} className="rg-avatar">
                              {m.fullName
                                .split(' ')
                                .filter(Boolean)
                                .slice(-2)
                                .map((p) => p[0])
                                .join('')}
                            </span>
                          ))}
                        </span>
                        <span>{g.members.length} giảng viên</span>
                      </span>
                    </td>
                    <td className="p-4 tabular-nums">
                      <span
                        className={`rg-round-badge ${g.activeReviewCount ? 'rg-round-badge-active' : ''}`}
                      >
                        <i />
                        {g.activeReviewCount
                          ? `${g.activeReviewCount} vòng đang duyệt`
                          : 'Chưa có vòng đang duyệt'}
                      </span>
                    </td>
                    <td className="p-4">
                      <Link
                        className="rg-table-action"
                        to={`/topic/review-groups/${g.id}`}
                      >
                        Chi tiết <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GroupState>
        {list.data && list.data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm">
            <span>
              {list.data.total} nhóm · Trang {page}/{list.data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <Button
                variant="secondary"
                disabled={page >= list.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
export function ReviewGroupEditorPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const requestKey = useRequestKey();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const terms = useQuery({
    queryKey: ['review-group-terms'],
    queryFn: api.terms,
    enabled: !id,
  });
  const group = useQuery({
    queryKey: ['review-group', id],
    queryFn: () => api.detail(id!),
    enabled: !!id,
  });
  const termId = group.data?.termId ?? params.get('termId') ?? '';
  const options = useQuery({
    queryKey: ['review-group-options', termId, page, search],
    queryFn: () => api.options(termId, page, search),
    enabled: !!termId,
    placeholderData: keepPreviousData,
  });
  const mutation = useMutation({
    mutationFn: ({
      input,
      reason,
      key,
      revision,
    }: {
      input: GroupCreate;
      reason: string;
      key: string;
      revision?: number;
    }) =>
      id
        ? api.update(
            id,
            {
              name: input.name,
              ...(group.data?.activeReviewCount
                ? {}
                : { memberLecturerIds: input.memberLecturerIds }),
              expectedRevision: revision!,
              reason,
            },
            key,
          )
        : api.create(termId, input, key),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['review-groups'] });
      await client.invalidateQueries({ queryKey: ['review-group', result.id] });
      navigate(`/topic/review-groups/${result.id}?saved=1`);
    },
  });
  return (
    <>
      <Link
        to={`/topic/review-groups?termId=${encodeURIComponent(termId)}`}
        className="text-sm text-blue-700"
      >
        ← Danh sách nhóm
      </Link>
      <h1 className="my-6 text-2xl font-semibold">
        {id ? 'Chỉnh sửa nhóm duyệt' : 'Tạo nhóm duyệt'}
      </h1>
      {!id && (
        <label className="mb-5 block rounded-lg border bg-white p-5 text-sm font-medium">
          Đợt tạo nhóm
          <select
            aria-label="Đợt tạo nhóm"
            className="mt-2 w-full rounded border border-slate-300 p-2"
            value={termId}
            disabled={mutation.isPending || terms.isLoading}
            onChange={(event) => {
              setParams({ termId: event.target.value });
              setSearch('');
              setPage(1);
            }}
          >
            <option value="">Chọn đợt đồ án</option>
            {terms.data?.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
          <span className="mt-2 block font-normal text-slate-500">
            Đổi đợt sẽ xóa lựa chọn chưa lưu.
          </span>
        </label>
      )}
      {!termId && !group.isLoading && (
        <p role="alert" className="rounded bg-amber-50 p-4">
          Vui lòng chọn đợt đồ án để tạo nhóm.
        </p>
      )}
      <GroupState
        loading={(!!id && group.isLoading) || (options.isLoading && !!termId)}
        error={errorText(group.error || options.error || (!id && terms.error))}
      >
        {options.data && (!id || group.data) && (
          <GroupForm
            key={id ?? options.data.term.id}
            options={options.data}
            initial={group.data}
            busy={mutation.isPending || options.isPlaceholderData}
            error={errorText(mutation.error)}
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            currentPage={page}
            onPage={setPage}
            onSubmit={(input, reason, revision) =>
              mutation.mutate({
                input,
                reason,
                revision,
                key: requestKey({ input, reason, revision }),
              })
            }
          />
        )}
      </GroupState>
      {options.isFetching && !options.isLoading && (
        <p role="status" className="mt-3 text-sm text-slate-500">
          Đang cập nhật danh sách giảng viên…
        </p>
      )}
    </>
  );
}
export function ReviewGroupDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const requestKey = useRequestKey();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [archiveRevision, setArchiveRevision] = useState<number>();
  const group = useQuery({
    queryKey: ['review-group', id],
    queryFn: () => api.detail(id!),
  });
  const mutation = useMutation({
    mutationFn: (key: string) =>
      api.archive(
        id!,
        { expectedRevision: archiveRevision!, reason: reason.trim() },
        key,
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['review-groups'] });
      await client.invalidateQueries({ queryKey: ['review-group-terms'] });
      client.removeQueries({ queryKey: ['review-group', id] });
      navigate(
        `/topic/review-groups?termId=${encodeURIComponent(group.data!.termId)}&saved=1`,
      );
    },
  });
  const g = group.data;
  const options = useQuery({
    queryKey: ['review-group-options', g?.termId],
    queryFn: () => api.options(g!.termId),
    enabled: !!g,
  });
  return (
    <>
      <Link
        to={`/topic/review-groups?termId=${encodeURIComponent(g?.termId ?? '')}`}
        className="text-sm text-blue-700"
      >
        ← Danh sách nhóm
      </Link>
      <GroupState loading={group.isLoading} error={errorText(group.error)}>
        {g && (
          <>
            <div className="my-6 flex flex-wrap justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">{g.name}</h1>
                <p className="mt-2 text-sm text-slate-500">
                  {options.data?.term.name ?? g.termId} · {g.departmentName} ·{' '}
                  {g.members.length} thành viên
                </p>
              </div>
              {g.canManage && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
                    to={`/topic/review-groups/${g.id}/edit`}
                  >
                    Chỉnh sửa nhóm
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setArchiveRevision(g.revision);
                      setConfirm((v) => !v);
                    }}
                  >
                    Xóa nhóm
                  </Button>
                </div>
              )}
            </div>
            {params.get('saved') && (
              <p
                role="status"
                className="mb-5 rounded bg-emerald-50 p-4 text-emerald-800"
              >
                Đã lưu nhóm duyệt thành công.
              </p>
            )}
            {confirm && (
              <form
                className="mb-5 space-y-3 rounded-lg border border-red-200 bg-red-50 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate(
                    requestKey({
                      reason: reason.trim(),
                      revision: archiveRevision,
                    }),
                  );
                }}
              >
                <h2 className="font-semibold text-red-900">
                  Xác nhận xóa nhóm
                </h2>
                <p className="text-sm text-red-800">
                  Nhóm chỉ được lưu trữ khi chưa có đề cương liên kết. Lịch sử
                  và thành viên được giữ lại.
                </p>
                <label className="block text-sm">
                  Lý do
                  <input
                    aria-label="Lý do xóa"
                    className="mt-2 w-full rounded border bg-white p-2"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    maxLength={2000}
                  />
                </label>
                {mutation.error && (
                  <p role="alert" className="text-sm text-red-800">
                    {errorText(mutation.error)}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="danger"
                  disabled={mutation.isPending || !reason.trim()}
                >
                  {mutation.isPending ? 'Đang xử lý…' : 'Xác nhận xóa'}
                </Button>
              </form>
            )}
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-white p-5">
                <p className="text-sm text-slate-500">Bộ môn</p>
                <p className="mt-2 font-medium">{g.departmentName}</p>
              </div>
              <div className="rounded-lg border bg-white p-5">
                <p className="text-sm text-slate-500">Vòng đang hoạt động</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {g.activeReviewCount}
                </p>
              </div>
              <div className="rounded-lg border bg-white p-5">
                <p className="text-sm text-slate-500">Cập nhật</p>
                <p className="mt-2 text-sm">
                  {new Date(g.updatedAt).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  })}
                </p>
              </div>
            </div>
            <section className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b p-5">
                <h2 className="font-semibold">Thành viên nhóm duyệt</h2>
              </div>
              <MemberTable members={g.members} />
            </section>
          </>
        )}
      </GroupState>
    </>
  );
}
