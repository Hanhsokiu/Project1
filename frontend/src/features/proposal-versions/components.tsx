import React from 'react';
import type {
  DataChange,
  ProposalContent,
  ProposalFeedback,
  RevisionResponse,
} from '@doan/shared';
export const localDateTime = (iso: string) =>
  iso ? new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16) : '';
export const fromLocalDateTime = (value: string) =>
  value ? `${value}:00+07:00` : '';
const fields = [
  ['objectives', 'Mục tiêu'],
  ['scope', 'Phạm vi'],
  ['mainContents', 'Nội dung chính'],
  ['tools', 'Công nghệ / công cụ'],
  ['expectedResults', 'Kết quả dự kiến'],
] as const;
export function ProposalFields({
  content,
  disabled,
  onChange,
}: {
  content: ProposalContent;
  disabled: boolean;
  onChange: (v: ProposalContent) => void;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-5">
      <p className="text-xs text-slate-500">
        Mẫu đề cương: mục tiêu, phạm vi, nội dung, công nghệ, kết quả và kế
        hoạch. Thời gian hiển thị theo Asia/Ho_Chi_Minh. Lưu nháp cho phép nội
        dung chưa hoàn chỉnh.
      </p>
      {fields.map(([key, label]) => (
        <label className="block text-sm font-medium" key={key}>
          {label}
          <textarea
            aria-label={label}
            className="mt-2 w-full rounded border p-3 font-normal"
            rows={key === 'mainContents' ? 5 : 3}
            value={content[key]}
            maxLength={20000}
            onChange={(e) => onChange({ ...content, [key]: e.target.value })}
          />
        </label>
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ['startsAt', 'Bắt đầu thực hiện'],
            ['endsAt', 'Kết thúc thực hiện'],
          ] as const
        ).map(([key, label]) => (
          <label className="block text-sm" key={key}>
            {label}
            <input
              aria-label={label}
              type="datetime-local"
              className="mt-2 w-full min-w-0 rounded border p-2"
              value={localDateTime(content[key])}
              onChange={(e) =>
                onChange({
                  ...content,
                  [key]: fromLocalDateTime(e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <section className="space-y-4">
        <h3 className="font-semibold">Kế hoạch thực hiện</h3>
        {!content.schedule.length && (
          <p className="text-sm text-slate-500">
            Chưa thêm mốc. Cần có kế hoạch hợp lệ trước khi gửi duyệt.
          </p>
        )}
        {content.schedule.map((row, i) => (
          <div key={i} className="space-y-3 rounded border p-4">
            <div className="flex justify-between gap-3">
              <strong className="text-sm">Mốc {i + 1}</strong>
              <button
                type="button"
                className="text-xs text-red-700"
                onClick={() =>
                  onChange({
                    ...content,
                    schedule: content.schedule.filter((_, n) => n !== i),
                  })
                }
              >
                Bỏ mốc {i + 1}
              </button>
            </div>
            {(['label', 'startsAt', 'endsAt', 'deliverables'] as const).map(
              (key) => (
                <label className="block text-sm" key={key}>
                  {
                    {
                      label: 'Tên mốc',
                      startsAt: 'Bắt đầu mốc',
                      endsAt: 'Kết thúc mốc',
                      deliverables: 'Sản phẩm',
                    }[key]
                  }
                  <input
                    aria-label={`${{ label: 'Tên mốc', startsAt: 'Bắt đầu mốc', endsAt: 'Kết thúc mốc', deliverables: 'Sản phẩm' }[key]} ${i + 1}`}
                    type={
                      key === 'startsAt' || key === 'endsAt'
                        ? 'datetime-local'
                        : 'text'
                    }
                    className="mt-1 w-full min-w-0 rounded border p-2"
                    value={
                      key === 'startsAt' || key === 'endsAt'
                        ? localDateTime(row[key])
                        : row[key]
                    }
                    maxLength={key === 'label' ? 255 : 20000}
                    onChange={(e) =>
                      onChange({
                        ...content,
                        schedule: content.schedule.map((item, n) =>
                          n === i
                            ? {
                                ...item,
                                [key]:
                                  key === 'startsAt' || key === 'endsAt'
                                    ? fromLocalDateTime(e.target.value)
                                    : e.target.value,
                              }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
              ),
            )}
          </div>
        ))}
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm"
          disabled={content.schedule.length >= 100}
          onClick={() =>
            onChange({
              ...content,
              schedule: [
                ...content.schedule,
                { label: '', startsAt: '', endsAt: '', deliverables: '' },
              ],
            })
          }
        >
          Thêm mốc kế hoạch
        </button>
      </section>
    </fieldset>
  );
}
export function RevisionFeedback({
  feedback,
  responses,
  disabled,
  onChange,
}: {
  feedback: ProposalFeedback[];
  responses: RevisionResponse[];
  disabled: boolean;
  onChange: (r: RevisionResponse[]) => void;
}) {
  return (
    <section className="rg-panel space-y-4 p-5">
      <h2 className="font-semibold">Góp ý và phản hồi chỉnh sửa</h2>
      <p className="text-xs text-slate-500">
        Góp ý gốc gắn với phiên bản/vòng cũ và được giữ nguyên. Phản hồi được
        lưu vào snapshot mới khi lưu nháp; không thay thế quyết định duyệt.
      </p>
      {!feedback.length && (
        <p className="text-sm text-slate-500">Chưa có góp ý được lưu.</p>
      )}
      {feedback.map((f) => {
        const text =
          responses.find(
            (r) => r.targetType === f.targetType && r.targetId === f.targetId,
          )?.text ?? '';
        return (
          <article
            className="space-y-3 rounded border p-4"
            key={`${f.targetType}:${f.targetId}`}
          >
            <p className="text-xs text-slate-500">
              v{f.versionNumber} · Vòng {f.roundNumber ?? 'legacy'} ·{' '}
              {f.authorName} ·{' '}
              {f.targetType === 'DECISION'
                ? 'Yêu cầu sửa chung'
                : 'Nhận xét thành viên'}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">{f.text}</p>
            <label className="block text-sm">
              Phản hồi góp ý
              <textarea
                aria-label={`Phản hồi ${f.targetType} ${f.targetId}`}
                rows={3}
                maxLength={10000}
                disabled={disabled}
                className="mt-2 w-full rounded border p-2"
                value={text}
                onChange={(e) => {
                  const other = responses.filter(
                    (r) =>
                      !(
                        r.targetType === f.targetType &&
                        r.targetId === f.targetId
                      ),
                  );
                  onChange(
                    e.target.value.trim()
                      ? [
                          ...other,
                          {
                            targetType: f.targetType,
                            targetId: f.targetId,
                            text: e.target.value,
                          },
                        ]
                      : other,
                  );
                }}
              />
            </label>
          </article>
        );
      })}
    </section>
  );
}
const display = (value: unknown) =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);
export function VersionChanges({ changes }: { changes: DataChange[] }) {
  return (
    <section className="rg-panel p-5">
      <h2 className="mb-4 font-semibold">Khác biệt dữ liệu phiên bản</h2>
      {!changes.length ? (
        <p className="text-sm text-slate-500">
          Không có khác biệt về nội dung và phản hồi.
        </p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="p-3">Trường dữ liệu</th>
                <th className="p-3">Bản trước</th>
                <th className="p-3">Bản sau</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.path} className="border-t">
                  <td className="p-3 font-mono">{c.path}</td>
                  <td className="max-w-xs whitespace-pre-wrap break-words p-3">
                    {c.beforeExists ? display(c.before) : '(chưa có)'}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap break-words p-3">
                    {c.afterExists ? display(c.after) : '(đã bỏ)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
