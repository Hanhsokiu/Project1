import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Notice,
} from "../../../shared/components/kit";
import { buildDecisionInput, type DecisionForm } from "./validation";
import type {
  ConfirmationContext,
  DecisionResponse,
  HistoryItem,
  Issue,
} from "./types";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";
const changed = (value: boolean | null) =>
  value === null ? "Chưa xác định" : value ? "Đã thay đổi" : "Không thay đổi";
function Issues({ items }: { items: Issue[] }) {
  return items.length ? (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item, i) => (
        <li key={`${item.code}-${i}`}>{item.message}</li>
      ))}
    </ul>
  ) : null;
}

export function ConfirmationContextView({
  context: c,
  downloading,
  onDownload,
}: {
  context: ConfirmationContext;
  downloading: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card title="Hồ sơ sinh viên">
        <p>
          <strong>
            {c.student.code} · {c.student.name}
          </strong>
        </p>
        <p>
          Hồ sơ: {c.proposal.id} · Trạng thái: {c.proposal.status}
        </p>
        <p>
          Đợt: {c.term.id} · {c.term.status}
        </p>
        <p>
          GVHD chính thức:{" "}
          {c.advisor.state === "OFFICIAL" ? c.advisor.name : "Chưa xác định"}
        </p>
        {c.advisor.state === "OFFICIAL" && (
          <p>Revision phân công: {c.advisor.revision}</p>
        )}
        <p>
          Phân công so với quyết định: {changed(c.advisorChangedSinceDecision)}
        </p>
        <p>
          Xác nhận áp dụng cho context hiện hành:{" "}
          {c.confirmationApplicableToCurrentContext === null
            ? "Chưa xác định"
            : c.confirmationApplicableToCurrentContext
              ? "Có"
              : "Không"}
        </p>
      </Card>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          title="Cửa sổ xác nhận UC17"
          action={<Badge value={c.window.state} />}
        >
          <p>Bắt đầu: {date(c.window.opensAt)}</p>
          <p>Kết thúc: {date(c.window.closesAt)}</p>
          <p>
            Khóa:{" "}
            {c.window.locked === null
              ? "Chưa xác định"
              : c.window.locked
                ? "Có"
                : "Không"}
          </p>
          <p>
            UC18: <strong>{c.uc18.state}</strong>
          </p>
          {c.uc18.state !== "OPEN" && (
            <Notice tone="warning">
              UC18 chưa OPEN hợp lệ; không được ghi quyết định.
            </Notice>
          )}
          <Issues items={c.window.issues} />
        </Card>
        <Card
          title="PDF hiện hành đã kiểm tra"
          action={<Badge value={c.pdf.state} />}
        >
          {c.pdf.snapshot ? (
            <>
              <p className="break-words">{c.pdf.snapshot.originalName}</p>
              <p>
                {c.pdf.snapshot.sizeBytes.toLocaleString("vi-VN")} byte ·
                Revision {c.pdf.snapshot.revision}
              </p>
              <p>Nộp lúc: {date(c.pdf.snapshot.submittedAt)}</p>
            </>
          ) : (
            <p>Chưa có PDF đủ bằng chứng xác minh.</p>
          )}
          <p>PDF so với quyết định: {changed(c.pdfChangedSinceDecision)}</p>
          <Issues items={c.pdf.issues} />
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            disabled={
              downloading || c.pdf.state !== "READY" || !c.expectedContext?.pdf
            }
            onClick={onDownload}
          >
            {downloading ? "Đang tải PDF…" : "Tải đúng PDF của context này"}
          </Button>
          <p className="muted text-sm mt-2">
            Tải tệp không tự xác nhận rằng GVHD đã đọc PDF. Sinh viên có thể nộp
            lại theo cửa sổ riêng.
          </p>
        </Card>
      </div>
      <Card title="Tiến độ và cảnh báo">
        <p>
          Dữ liệu:{" "}
          {c.progress.dataState === "MISSING"
            ? "Thiếu dữ liệu"
            : c.progress.dataState === "PARTIAL"
              ? "Có một phần"
              : "Đã có dữ liệu"}
        </p>
        <p>
          Tổng {c.progress.summary.total} · Hoàn thành{" "}
          {c.progress.summary.completed} · Chưa hoàn thành{" "}
          {c.progress.summary.incomplete} · Chưa xác định{" "}
          {c.progress.summary.unknown} · Quá hạn {c.progress.summary.overdue}
        </p>
        <Issues items={c.progress.warnings} />
        <p className="muted text-sm mt-2">
          Tiến độ chưa hoàn thành là cảnh báo. Điều kiện chặn quyết định lấy từ
          backend.
        </p>
      </Card>
      {(c.legacy.decision || c.legacy.pdf) && (
        <Notice tone="warning">
          Có dữ liệu legacy. Các bằng chứng thiếu được giữ ở trạng thái chưa xác
          định.
        </Notice>
      )}
    </div>
  );
}

export function CurrentDecisionView({
  response,
}: {
  response: DecisionResponse;
}) {
  const d = response.decision;
  return (
    <Card
      title="Quyết định hiện hành"
      action={<Badge value={d.status || "UNKNOWN"} />}
    >
      <p>
        {!response.configured
          ? "Chưa có quyết định."
          : d.state === "PENDING"
            ? "Bản ghi PENDING, chưa có quyết định chính thức."
            : d.state === "LEGACY"
              ? "Quyết định legacy, thiếu bằng chứng xác minh."
              : d.state === "INVALID"
                ? "Dữ liệu quyết định chưa hợp lệ."
                : "Quyết định đã được ghi nhận."}
      </p>
      <p>Revision: {d.revision ?? "Chưa có"}</p>
      <p className="whitespace-pre-wrap">
        Nhận xét / lý do: {d.note || "Chưa có"}
      </p>
      <p>Người quyết định: {d.decidedBy?.displayName || "Chưa xác định"}</p>
      <p>GVHD khi quyết định: {d.advisor?.fullName || "Chưa xác định"}</p>
      <p>Quyết định lúc: {date(d.decidedAt)}</p>
      <p>Xác nhận lúc: {date(d.confirmedAt)}</p>
      <Issues items={d.issues} />
    </Card>
  );
}

export function ConfirmationHistory({
  items,
  state,
  hasMore,
  busy,
  onMore,
}: {
  items: HistoryItem[];
  state: string;
  hasMore: boolean;
  busy: boolean;
  onMore: () => void;
}) {
  return (
    <Card title="Lịch sử quyết định">
      {!items.length && (
        <p>
          {state === "LEGACY_WITHOUT_HISTORY"
            ? "Quyết định legacy chưa có lịch sử; không tạo lịch sử giả."
            : state === "UNKNOWN"
              ? "Chưa xác minh được lịch sử."
              : "Chưa có lịch sử quyết định."}
        </p>
      )}
      <ol className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="border-b pb-3">
            <p>
              <strong>Revision {item.revision}</strong> · {item.status} ·{" "}
              {date(item.decidedAt)}
            </p>
            <p>
              Người quyết định: {item.actor?.displayName || "Chưa xác định"} ·
              GVHD: {item.advisor?.fullName || "Chưa xác định"}
            </p>
            <p className="whitespace-pre-wrap">
              Nhận xét / lý do: {item.note || "Chưa có"}
            </p>
            <p className="whitespace-pre-wrap">
              Lý do thay đổi: {item.changeReason || "Chưa có"}
            </p>
            <p>
              Revision PDF tại thời điểm quyết định:{" "}
              {item.pdfRevision ?? "Chưa có / chưa xác định"}
            </p>
          </li>
        ))}
      </ol>
      {hasMore && (
        <Button
          className="mt-3"
          variant="secondary"
          disabled={busy}
          onClick={onMore}
        >
          {busy ? "Đang tải…" : "Xem lịch sử tiếp theo"}
        </Button>
      )}
    </Card>
  );
}

export function ConfirmationDecisionForm({
  context,
  busy,
  onSubmit,
}: {
  context: ConfirmationContext;
  busy: boolean;
  onSubmit: (form: DecisionForm) => void;
}) {
  const [status, setStatus] = useState<DecisionForm["status"]>(
    context.decision.status === "REJECTED" ? "REJECTED" : "CONFIRMED",
  );
  const [note, setNote] = useState(context.decision.note || "");
  const [changeReason, setChangeReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const gate =
    status === "CONFIRMED"
      ? context.readiness.confirm
      : context.readiness.reject;
  return (
    <Card title="Ghi quyết định UC17">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = { status, note, changeReason, reviewed };
          try {
            buildDecisionInput(context, form);
            setError("");
            onSubmit(form);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Dữ liệu không hợp lệ.");
          }
        }}
      >
        {error && <Notice tone="danger">{error}</Notice>}
        <fieldset disabled={busy} className="space-y-4">
          <Field label="Quyết định">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as DecisionForm["status"])
              }
            >
              <option value="CONFIRMED">Đồng ý cho bảo vệ</option>
              <option value="REJECTED">Từ chối cho bảo vệ</option>
            </select>
          </Field>
          <Field
            label={
              status === "REJECTED" ? "Lý do từ chối (bắt buộc)" : "Nhận xét"
            }
          >
            <textarea
              rows={4}
              maxLength={10000}
              required={status === "REJECTED"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Field
            label={`Lý do thay đổi${context.changeReasonRequiredForChanges ? " (bắt buộc)" : ""}`}
          >
            <textarea
              rows={3}
              maxLength={10000}
              required={context.changeReasonRequiredForChanges}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
          </Field>
          {!gate.allowed && (
            <Notice tone="warning">
              <Issues items={gate.blockers} />
            </Notice>
          )}
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            <span>
              Tôi đã xem lại hồ sơ và PDF hiện hành (nếu có) trong context này
              trước khi quyết định.
            </span>
          </label>
          <Button
            disabled={
              busy ||
              !reviewed ||
              !context.permissions.canDecide ||
              !gate.allowed ||
              !context.expectedContext ||
              context.expectedRevision === null
            }
          >
            {busy ? "Đang xử lý…" : "Gửi quyết định"}
          </Button>
        </fieldset>
        <p className="muted text-sm">
          Quyết định GVHD không đồng nghĩa Khoa đã duyệt bảo vệ và không tự cập
          nhật điều kiện bảo vệ hoặc điểm.
        </p>
      </form>
    </Card>
  );
}
