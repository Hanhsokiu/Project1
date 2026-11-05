import React, { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WeeklyPlanCreateSchema, WeeklyPlanUpdateSchema } from "@doan/shared";
import type {
  WeeklyPlanView,
  WeeklyQuery,
  WeeklyStudentRow,
} from "@doan/shared";
import { weeklyApi as api } from "./api";
import {
  vietnamDate,
  fromVietnamInput,
  toVietnamInput,
} from "../guidance-tasks/components";
import { getErrorMessage } from "../../shared/api/error-message";

const statusLabels = {
  NOT_SUBMITTED: "Chưa nộp",
  PENDING: "Chờ đánh giá",
  PASS: "Đạt",
  FAIL: "Không đạt",
  REVISION_REQUIRED: "Cần sửa",
  LATE: "Nộp muộn",
};
export function csvCell(v: unknown) {
  const text = String(v ?? "");
  return (
    '"' +
    (/^[\s]*[=+@-]/.test(text) ? "'" : "") +
    text.replace(/"/g, '""') +
    '"'
  );
}
function PlanForm({
  value,
  onSave,
  busy,
}: {
  value?: WeeklyPlanView;
  onSave: (v: unknown) => Promise<void>;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  return (
    <form
      className="rg-panel p-5 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        try {
          const body = {
            ordinal: Number(data.get("ordinal")),
            label: data.get("label"),
            description: data.get("description"),
            startsAt: fromVietnamInput(String(data.get("startsAt"))),
            endsAt: fromVietnamInput(String(data.get("endsAt"))),
            reportDueAt: fromVietnamInput(String(data.get("reportDueAt"))),
            expectedDeliverables: data.get("expectedDeliverables"),
            allowLate: data.get("allowLate") === "on",
          };
          await onSave(
            value
              ? WeeklyPlanUpdateSchema.parse({
                  ...body,
                  expectedRevision: value.revision,
                  reason: data.get("reason"),
                })
              : WeeklyPlanCreateSchema.parse(body),
          );
        } catch (e) {
          setError(
            getErrorMessage(e, "Kiểm tra các trường và khoảng thời gian tuần."),
          );
        }
      }}
    >
      <h2>{value ? "Điều chỉnh tuần" : "Tạo kế hoạch tuần"}</h2>
      <p>
        Thời gian theo Asia/Ho_Chi_Minh (UTC+7). Thay đổi hạn không làm đổi nhãn
        đúng hạn của bản đã nộp.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          Số tuần
          <input
            className="input"
            name="ordinal"
            type="number"
            min="1"
            max="520"
            required
            defaultValue={value?.ordinal ?? 1}
          />
        </label>
        <label>
          Tiêu đề
          <input
            className="input"
            name="label"
            required
            maxLength={255}
            defaultValue={value?.label}
          />
        </label>
        {(
          [
            ["startsAt", "Bắt đầu"],
            ["endsAt", "Kết thúc"],
            ["reportDueAt", "Hạn nộp"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              className="input"
              name={key}
              type="datetime-local"
              required
              defaultValue={value ? toVietnamInput(value[key]) : ""}
            />
          </label>
        ))}
      </div>
      <label className="block">
        Mô tả
        <textarea
          className="input w-full"
          name="description"
          defaultValue={value?.description}
          maxLength={20000}
        />
      </label>
      <label className="block">
        Kết quả mong đợi
        <textarea
          className="input w-full"
          name="expectedDeliverables"
          required
          defaultValue={
            value?.expectedDeliverables ?? "Báo cáo tiến độ và mã nguồn"
          }
          maxLength={20000}
        />
      </label>
      <label className="block">
        <input
          name="allowLate"
          type="checkbox"
          defaultChecked={value?.allowLate ?? true}
        />{" "}
        Cho phép nộp muộn lần đầu khi giai đoạn hướng dẫn còn mở
      </label>
      {value && (
        <label className="block">
          Lý do điều chỉnh
          <input name="reason" className="input" required maxLength={2000} />
        </label>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Đang lưu…" : "Lưu kế hoạch tuần"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function WeeklyPlansPage() {
  const [params, setParams] = useSearchParams(),
    term = params.get("termId") ?? "";
  const client = useQueryClient(),
    keys = useRef(new Map<string, string>());
  const [editing, setEditing] = useState<WeeklyPlanView | "new" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [page, setPage] = useState(1),
    [periodId, setPeriod] = useState(""),
    [status, setStatus] = useState("");
  const [studentSearch, setStudentSearch] = useState(""),
    [advisorSearch, setAdvisorSearch] = useState(""),
    [late, setLate] = useState(false);
  const [historyId, setHistoryId] = useState("");
  const options = useQuery({
    queryKey: ["weekly-options"],
    queryFn: api.options,
  });
  const plans = useQuery({
    queryKey: ["weekly-plans", term],
    queryFn: () => api.plans(term),
    enabled: !!term,
  });
  const query: WeeklyQuery = {
    page,
    limit: 20,
    periodId: periodId || undefined,
    status: (status || undefined) as WeeklyQuery["status"],
    studentSearch: studentSearch || undefined,
    advisorSearch: advisorSearch || undefined,
    isLate: late ? "true" : undefined,
  };
  const summary = useQuery({
    queryKey: ["weekly-summary", term, query],
    queryFn: () => api.summary(term, query),
    enabled: !!term,
  });
  const history = useQuery({
    queryKey: ["weekly-history", term, historyId],
    queryFn: () => api.history(term, historyId),
    enabled: !!historyId,
  });
  const manage = options.data?.find((o) => o.id === term)?.canManage;
  async function write(body: unknown, id?: string, state = false) {
    setBusy(true);
    setError("");
    const hash = JSON.stringify({ term, id, state, body });
    if (!keys.current.has(hash)) keys.current.set(hash, crypto.randomUUID());
    try {
      await api.write(term, body, keys.current.get(hash)!, id, state);
      setEditing(null);
      await client.invalidateQueries({ queryKey: ["weekly-plans"] });
      await client.invalidateQueries({ queryKey: ["weekly-summary"] });
      await client.invalidateQueries({ queryKey: ["weekly-history"] });
    } finally {
      setBusy(false);
    }
  }
  async function exportCsv() {
    setBusy(true);
    try {
      const rows: WeeklyStudentRow[] = [];
      let p = 1,
        totalPages = 1;
      do {
        const result = await api.summary(term, {
          ...query,
          page: p++,
          limit: 100,
        });
        rows.push(...result.data);
        totalPages = result.totalPages;
      } while (p <= totalPages);
      const csv = [
        [
          "Tuần",
          "Mã SV",
          "Họ tên",
          "GVHD",
          "Trạng thái",
          "Lần nộp",
          "Nộp muộn",
        ],
        ...rows.map((r) => [
          r.label,
          r.studentCode,
          r.studentName,
          r.advisorName,
          statusLabels[r.status],
          r.versionNumber,
          r.isLate === null ? "" : r.isLate ? "Có" : "Không",
        ]),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n");
      const href = URL.createObjectURL(
        new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = href;
      a.download = "tien-do-tuan.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      setError(getErrorMessage(e, "Không thể xử lý yêu cầu."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 min-w-0">
      <h1>Kế hoạch và báo cáo tuần</h1>
      <label>
        Đợt đồ án{" "}
        <select
          aria-label="Đợt đồ án"
          className="input"
          value={term}
          onChange={(e) => {
            setParams({ termId: e.target.value });
            setPage(1);
            setPeriod("");
            setEditing(null);
            setHistoryId("");
          }}
        >
          <option value="">Chọn đợt</option>
          {options.data?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {(options.isLoading ||
        (plans.isLoading && !!term) ||
        (summary.isLoading && !!term)) && <p role="status">Đang tải…</p>}
      {(error || options.error || plans.error || summary.error) && (
        <p role="alert">
          {error ||
            getErrorMessage(
              options.error || plans.error || summary.error,
              "Không tải được dữ liệu.",
            )}
        </p>
      )}
      {manage && (
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          Tạo tuần
        </button>
      )}
      {editing && (
        <PlanForm
          key={editing === "new" ? term : editing.id + editing.revision}
          value={editing === "new" ? undefined : editing}
          busy={busy}
          onSave={(body) =>
            write(body, editing === "new" ? undefined : editing.id)
          }
        />
      )}
      {plans.data?.length === 0 && <p>Chưa có kế hoạch tuần được công bố.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {plans.data?.map((p) => (
          <article key={p.id} className="rg-panel p-4 space-y-2">
            <h2>
              {p.ordinal}. {p.label}
            </h2>
            <p>
              {vietnamDate(p.startsAt)} – {vietnamDate(p.endsAt)}
            </p>
            <p>
              Hạn: {vietnamDate(p.reportDueAt)} ·{" "}
              {p.state === "DRAFT"
                ? "Nháp"
                : p.state === "LOCKED"
                  ? "Đã khóa"
                  : "Đã công bố"}
            </p>
            <p className="whitespace-pre-wrap">{p.description}</p>
            {Date.parse(p.reportDueAt) > Date.now() &&
              Date.parse(p.reportDueAt) - Date.now() < 86400000 && (
                <p className="text-amber-800">Sắp đến hạn trong 24 giờ</p>
              )}
            {p.canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditing(p)}
                >
                  Điều chỉnh
                </button>
                <button
                  disabled={busy}
                  className="btn btn-secondary"
                  onClick={() => {
                    const reason = window.prompt("Lý do công bố/mở/khóa tuần");
                    if (reason?.trim())
                      void write(
                        {
                          expectedRevision: p.revision,
                          state: p.state === "OPEN" ? "LOCKED" : "OPEN",
                          reason,
                        },
                        p.id,
                        true,
                      ).catch((e) =>
                        setError(
                          getErrorMessage(e, "Không thể xử lý yêu cầu."),
                        ),
                      );
                  }}
                >
                  {p.state === "OPEN" ? "Khóa tuần" : "Công bố / mở tuần"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setHistoryId(p.id)}
                >
                  Lịch sử
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {historyId && (
        <section className="rg-panel p-4">
          <h2>Lịch sử thay đổi tuần</h2>
          {history.error && (
            <p role="alert">
              {getErrorMessage(history.error, "Không tải được lịch sử.")}
            </p>
          )}
          {history.data?.map((h) => (
            <p key={h.id}>
              {vietnamDate(h.createdAt)} · {h.newValue.reason} · Hạn cũ:{" "}
              {h.newValue.before?.reportDueAt
                ? vietnamDate(h.newValue.before.reportDueAt)
                : "—"}{" "}
              →{" "}
              {h.newValue.after?.reportDueAt
                ? vietnamDate(h.newValue.after.reportDueAt)
                : "—"}
            </p>
          ))}
        </section>
      )}
      {term && (
        <>
          <div className="flex flex-wrap gap-3">
            <label>
              Tuần{" "}
              <select
                aria-label="Tuần"
                className="input"
                value={periodId}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả</option>
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái{" "}
              <select
                aria-label="Trạng thái"
                className="input"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả</option>
                {Object.entries(statusLabels)
                  .filter(([k]) => k !== "LATE")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void exportCsv()}
            >
              Xuất CSV
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <label>
              Sinh viên
              <input
                aria-label="Lọc sinh viên"
                className="input"
                placeholder="Họ tên hoặc mã sinh viên"
                maxLength={100}
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              GVHD
              <input
                aria-label="Lọc GVHD"
                className="input"
                placeholder="Tên giảng viên"
                maxLength={100}
                value={advisorSearch}
                onChange={(e) => {
                  setAdvisorSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={late}
                onChange={(e) => {
                  setLate(e.target.checked);
                  setPage(1);
                }}
              />{" "}
              Chỉ bài nộp muộn
            </label>
          </div>
          <p>
            {summary.data &&
              Object.entries(summary.data.metrics)
                .map(
                  ([k, v]) =>
                    `${statusLabels[k as keyof typeof statusLabels]}: ${v}`,
                )
                .join(" · ")}
          </p>
          <div className="rg-panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {[
                    "Tuần / sinh viên",
                    "Đề tài / GVHD",
                    "Nhiệm vụ",
                    "Báo cáo",
                    "Thao tác",
                  ].map((h) => (
                    <th className="p-3 text-left" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.data?.data.map((r) => (
                  <tr key={r.periodId + r.studentId} className="border-t">
                    <td className="p-3">
                      {r.label}
                      <p>
                        {r.studentName} · {r.studentCode}
                      </p>
                    </td>
                    <td className="p-3">
                      {r.topicTitle ?? "Chưa có đề tài"}
                      <p>{r.advisorName ?? "Chưa có GVHD chính thức"}</p>
                    </td>
                    <td className="p-3">{r.taskCount}</td>
                    <td className="p-3">
                      {statusLabels[r.status]} · Lần {r.versionNumber}
                      <p>
                        {r.isLate === null
                          ? ""
                          : r.isLate
                            ? "Nộp muộn"
                            : "Đúng hạn"}
                      </p>
                      {r.revisionDueAt && (
                        <p>Hạn sửa: {vietnamDate(r.revisionDueAt)}</p>
                      )}
                    </td>
                    <td className="p-3">
                      {r.taskId ? (
                        <Link to={`/guidance/tasks/${r.taskId}/submissions`}>
                          Xem báo cáo
                        </Link>
                      ) : r.proposalId ? (
                        <Link to={`/guidance/plan/${r.proposalId}`}>
                          Mở kế hoạch / tạo báo cáo tuần
                        </Link>
                      ) : (
                        "Chưa đủ hồ sơ"
                      )}
                      {r.submissionId && (
                        <p>
                          <Link to={`/guidance/review/${r.submissionId}`}>
                            Nhận xét
                          </Link>
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary.data?.total === 0 && (
              <p className="p-4">
                Chưa có nghĩa vụ báo cáo trong phạm vi đã chọn.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Trang trước
            </button>
            <span>
              Trang {page}/{Math.max(1, summary.data?.totalPages ?? 1)}
            </span>
            <button
              disabled={page >= (summary.data?.totalPages ?? 1)}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </div>
  );
}
