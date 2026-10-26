import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { GroupCreate, GroupOptions, ReviewGroupView } from '@doan/shared';
import { GroupCreateSchema, GroupUpdateSchema } from '@doan/shared';
import { Button } from '../../shared/components/ui/Button';

export function GroupState({
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
      <div
        role="status"
        className="rounded-lg border bg-white p-8 text-slate-500"
      >
        Đang tải nhóm duyệt…
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"
      >
        {error}
      </div>
    );
  if (empty)
    return (
      <div className="rounded-lg border bg-white px-6 py-12 text-center">
        <h2 className="font-semibold">Chưa có nhóm duyệt</h2>
        <p className="mt-2 text-sm text-slate-500">
          Không có nhóm trong phạm vi và bộ lọc đã chọn.
        </p>
      </div>
    );
  return <>{children}</>;
}
export function MemberTable({
  members,
}: {
  members: ReviewGroupView['members'];
}) {
  if (!members.length)
    return (
      <p className="p-5 text-sm text-slate-500">Nhóm chưa có thành viên.</p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="p-4">Giảng viên</th>
            <th className="p-4">Mã giảng viên</th>
            <th className="p-4">Vai trò</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.lecturerId} className="border-t border-slate-100">
              <td className="p-4 font-medium">{m.fullName}</td>
              <td className="p-4 tabular-nums text-slate-500">
                {m.lecturerCode}
              </td>
              <td className="p-4">
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800">
                  Thành viên duyệt
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function GroupForm({
  options,
  initial,
  busy,
  onSubmit,
  search,
  onSearch,
  onPage,
  currentPage,
  error,
}: {
  options: GroupOptions;
  initial?: ReviewGroupView;
  busy: boolean;
  error?: string;
  onSubmit: (input: GroupCreate, reason: string, revision?: number) => void;
  search: string;
  onSearch: (value: string) => void;
  onPage: (page: number) => void;
  currentPage: number;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? '');
  const [selected, setSelected] = useState(
    initial?.members.map((m) => m.lecturerId) ?? [],
  );
  const [reason, setReason] = useState('');
  const [originalRevision] = useState(initial?.revision);
  const [validation, setValidation] = useState('');
  const locked = !!initial?.activeReviewCount;
  const canWrite =
    options.canManage &&
    ['DRAFT', 'CLOSED_REGISTRATION', 'IN_PROGRESS'].includes(
      options.term.status,
    );
  const inputClass =
    'mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100';
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = { name, departmentId, memberLecturerIds: selected };
    const parsed = initial
      ? GroupUpdateSchema.safeParse({
          name,
          ...(locked ? {} : { memberLecturerIds: selected }),
          expectedRevision: initial.revision,
          reason,
        })
      : GroupCreateSchema.safeParse(input);
    if (!parsed.success) {
      setValidation(parsed.error.issues.map((i) => i.message).join(' '));
      return;
    }
    setValidation('');
    onSubmit(GroupCreateSchema.parse(input), reason.trim(), originalRevision);
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      {(error || validation) && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {validation || error}
        </div>
      )}
      {!canWrite && (
        <p role="status" className="rounded bg-amber-50 p-4 text-amber-900">
          Bạn không có quyền quản lý hoặc đợt đang khóa thay đổi.
        </p>
      )}
      <fieldset
        disabled={busy || !canWrite}
        className="space-y-6 disabled:opacity-70"
      >
        <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold">Thông tin nhóm</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium sm:col-span-2">
              Tên nhóm
              <input
                aria-label="Tên nhóm"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                required
              />
            </label>
            <label className="text-sm font-medium">
              Đợt đồ án
              <input
                className={inputClass}
                value={options.term.name}
                disabled
              />
            </label>
            <label className="text-sm font-medium">
              Bộ môn
              <select
                aria-label="Bộ môn"
                className={inputClass}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={!!initial}
                required
              >
                <option value="">Chọn bộ môn</option>
                {options.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-semibold">
            Thành viên{' '}
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800">
              {selected.length} đã chọn
            </span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Chọn giảng viên hoạt động trong roster của đợt. Mỗi giảng viên có
            vai trò thành viên duyệt.
          </p>
          {locked && (
            <p
              role="status"
              className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900"
            >
              Nhóm đang có đề cương được giao. Cần phân lại trước khi thay đổi
              thành viên.
            </p>
          )}
          {!locked && (
            <>
              <label className="mt-4 block text-sm">
                Tìm giảng viên
                <input
                  aria-label="Tìm giảng viên"
                  className={inputClass}
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Tìm theo họ tên…"
                />
              </label>
              <div className="mt-4 max-h-72 space-y-1 overflow-auto rounded border border-slate-200 p-2">
                {options.lecturers.data.map((l) => (
                  <label
                    key={l.id}
                    className="flex cursor-pointer items-center gap-3 rounded p-3 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(l.id)}
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, l.id]
                            : v.filter((id) => id !== l.id),
                        )
                      }
                    />
                    <span>
                      <span className="font-medium">{l.fullName}</span>
                      <span className="ml-2 text-slate-500">
                        {l.lecturerCode}
                      </span>
                    </span>
                  </label>
                ))}
                {!options.lecturers.data.length && (
                  <p className="p-3 text-sm text-slate-500">
                    Không có giảng viên hợp lệ phù hợp.
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={currentPage <= 1}
                  onClick={() => onPage(currentPage - 1)}
                >
                  Trước
                </Button>
                <span>
                  Trang {currentPage} /{' '}
                  {Math.max(1, options.lecturers.totalPages)}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={currentPage >= options.lecturers.totalPages}
                  onClick={() => onPage(currentPage + 1)}
                >
                  Sau
                </Button>
              </div>
              <div
                className="mt-3 flex flex-wrap gap-2"
                aria-label="Thành viên đã chọn"
              >
                {selected.map((id) => (
                  <button
                    type="button"
                    key={id}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800"
                    aria-label={`Bỏ chọn ${id}`}
                    onClick={() =>
                      setSelected((v) => v.filter((x) => x !== id))
                    }
                  >
                    {options.lecturers.data.find((l) => l.id === id)
                      ?.fullName ??
                      initial?.members.find((m) => m.lecturerId === id)
                        ?.fullName ??
                      id}{' '}
                    ×
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {initial && (
          <label className="block rounded-lg border bg-white p-5 text-sm font-medium">
            Lý do thay đổi
            <textarea
              aria-label="Lý do thay đổi"
              required
              className={inputClass}
              maxLength={2000}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Tạo nhóm duyệt'}
          </Button>
          <Link
            className="rounded border bg-white px-4 py-2 text-sm"
            to={
              initial
                ? `/topic/review-groups/${initial.id}`
                : `/topic/review-groups?termId=${encodeURIComponent(options.term.id)}`
            }
          >
            Hủy
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
