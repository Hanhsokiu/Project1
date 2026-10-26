import React, { useState } from "react";
export function GuidanceState({
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
      <p role="status" className="rg-panel p-5 text-slate-500">
        Đang tải kế hoạch/nhiệm vụ…
      </p>
    );
  if (error)
    return (
      <p
        role="alert"
        className="rounded border border-red-200 bg-red-50 p-5 text-red-800"
      >
        {error}
      </p>
    );
  if (empty)
    return (
      <div className="rg-panel p-6">
        <h2 className="font-semibold">
          Chưa có nhiệm vụ hoặc kế hoạch phù hợp
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Kiểm tra phạm vi, lịch và bộ lọc đang chọn.
        </p>
      </div>
    );
  return <>{children}</>;
}
import type {
  GuidancePeriodView,
  GuidanceTaskCreate,
  GuidanceTaskUpdate,
  GuidanceTaskView,
} from "@doan/shared";
import {
  GuidanceTaskCreateSchema,
  GuidanceTaskUpdateSchema,
} from "@doan/shared";
export const guidanceStatusLabel = (s: string | null) =>
  ({
    TODO: "Chưa bắt đầu",
    IN_PROGRESS: "Đang thực hiện",
    SUBMITTED: "Đã nộp",
    REVISION_REQUESTED: "Cần làm lại",
    COMPLETED: "Đã hoàn thành",
    CANCELLED: "Đã hủy",
    ACTIVE: "Đang hướng dẫn",
    PAUSED: "Tạm dừng",
    ARCHIVED: "Đã lưu trữ",
  })[s ?? ""] ?? "Cần đối soát";
export const vietnamDate = (v: string) =>
  new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
export const toVietnamInput = (v: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(v))
    .replace(" ", "T");
export const fromVietnamInput = (v: string) => (v ? `${v}:00+07:00` : "");
export function TaskStatus({
  task,
}: {
  task: Pick<GuidanceTaskView, "status" | "isOverdue">;
}) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      <span>{guidanceStatusLabel(task.status)}</span>
      {task.isOverdue && (
        <span className="rounded bg-amber-100 px-2 text-amber-900">
          Quá hạn
        </span>
      )}
    </span>
  );
}
export function GuidanceTaskForm({
  task,
  planRevision,
  periods,
  busy,
  onSubmit,
}: {
  task?: GuidanceTaskView;
  planRevision: number;
  periods: GuidancePeriodView[];
  busy: boolean;
  onSubmit: (v: GuidanceTaskCreate | GuidanceTaskUpdate) => void;
}) {
  const [initial] = useState({ task, planRevision });
  const [title, setTitle] = useState(task?.title ?? ""),
    [description, setDescription] = useState(task?.description ?? ""),
    [expected, setExpected] = useState(task?.expectedDeliverables ?? ""),
    [periodId, setPeriod] = useState(task?.periodId ?? ""),
    [start, setStart] = useState(
      task?.startDate ? toVietnamInput(task.startDate) : "",
    ),
    [due, setDue] = useState(task ? toVietnamInput(task.dueDate) : ""),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [error, setError] = useState("");
  const weekly = task?.kind === "WEEKLY_REPORT";
  return (
    <form
      className="rg-panel p-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const values = initial.task
          ? {
              expectedRevision: initial.task.revision,
              title,
              description,
              ...(!weekly
                ? {
                    expectedDeliverables: expected,
                    startDate: fromVietnamInput(start),
                    dueDate: fromVietnamInput(due),
                  }
                : {}),
              reason,
              acknowledgeExistingSubmissions: ack,
            }
          : {
              expectedPlanRevision: initial.planRevision,
              title,
              description,
              expectedDeliverables: expected,
              periodId,
              startDate: fromVietnamInput(start),
              dueDate: fromVietnamInput(due),
            };
        const parsed = initial.task
          ? GuidanceTaskUpdateSchema.safeParse(values)
          : GuidanceTaskCreateSchema.safeParse(values);
        if (!parsed.success) {
          setError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          );
          return;
        }
        setError("");
        onSubmit(parsed.data);
      }}
    >
      <h2 className="font-semibold">
        {task ? "Chỉnh sửa nhiệm vụ" : "Giao nhiệm vụ mới"}
      </h2>
      <p className="text-sm text-slate-500">
        Thời gian nhập theo Asia/Ho_Chi_Minh (UTC+7). Sản phẩm dự kiến là mô tả
        yêu cầu; màn hình này chưa nhận upload hoặc chấm kết quả.
      </p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block">
          Tên nhiệm vụ
          <input
            aria-label="Tên nhiệm vụ"
            maxLength={255}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded border p-2"
          />
        </label>
        <label className="block">
          Mô tả
          <textarea
            aria-label="Mô tả nhiệm vụ"
            maxLength={20000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded border p-2"
          />
        </label>
        <label className="block">
          Sản phẩm dự kiến
          <textarea
            aria-label="Sản phẩm dự kiến"
            maxLength={20000}
            required
            value={expected}
            disabled={weekly}
            onChange={(e) => setExpected(e.target.value)}
            className="mt-2 w-full rounded border p-2"
          />
        </label>
        <label className="block">
          Tuần / mốc kế hoạch
          <select
            aria-label="Mốc nhiệm vụ"
            required
            disabled={!!task}
            value={periodId}
            onChange={(e) => setPeriod(e.target.value)}
            className="mt-2 w-full rounded border p-2"
          >
            <option value="">Chọn mốc đã cấu hình</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Ngày bắt đầu
            <input
              aria-label="Ngày bắt đầu"
              type="datetime-local"
              required
              disabled={weekly}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-2 w-full min-w-0 rounded border p-2"
            />
          </label>
          <label>
            Hạn hoàn thành
            <input
              aria-label="Hạn hoàn thành"
              type="datetime-local"
              required
              disabled={weekly}
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-2 w-full min-w-0 rounded border p-2"
            />
          </label>
        </div>
        {weekly && (
          <p className="text-sm text-amber-800">
            Lịch và sản phẩm nhiệm vụ tuần do cấu hình nghĩa vụ quyết định;
            không sửa riêng tại đây.
          </p>
        )}
        {task && (
          <label className="block">
            Lý do thay đổi
            <textarea
              aria-label="Lý do thay đổi"
              required
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded border p-2"
            />
          </label>
        )}
        {task?.hasSubmissions && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            Tôi xác nhận nhiệm vụ đã có bài nộp; giữ nguyên bài và lịch sử cũ.
          </label>
        )}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button className="rounded bg-blue-700 px-4 py-2 text-white">
          {busy
            ? "Đang lưu…"
            : task
              ? "Lưu thay đổi nhiệm vụ"
              : "Giao nhiệm vụ"}
        </button>
      </fieldset>
    </form>
  );
}
