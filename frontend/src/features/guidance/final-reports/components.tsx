import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Notice,
} from "../../../shared/components/kit";
import type { FinalReport, FinalReportContext } from "./contracts";
import { uploadBlockers, validateFinalReportFile } from "./validation";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";
function windowState(context: FinalReportContext) {
  const window = context.window;
  if (!window) return "NOT_CONFIGURED";
  if (window.locked) return "LOCKED";
  const now = Date.parse(context.serverNow),
    opens = Date.parse(window.opensAt),
    closes = Date.parse(window.closesAt);
  if (![now, opens, closes].every(Number.isFinite) || opens >= closes)
    return "UNKNOWN";
  return now < opens ? "NOT_OPEN" : now >= closes ? "CLOSED" : "OPEN";
}

export function FinalReportContextView({
  context,
}: {
  context: FinalReportContext;
}) {
  const window = context.window;
  return (
    <Card
      title="Cửa sổ nộp PDF cuối cùng"
      action={<Badge value={windowState(context)} />}
    >
      <p>
        Hồ sơ: {context.proposalId} · Đợt: {context.termId}
      </p>
      <p>
        Mốc: <strong>{context.code}</strong>
      </p>
      {window ? (
        <>
          <p>Bắt đầu: {date(window.opensAt)}</p>
          <p>Kết thúc: {date(window.closesAt)}</p>
          <p>
            Khóa: {window.locked ? "Có" : "Không"} · Revision cấu hình:{" "}
            {window.revision}
          </p>
        </>
      ) : (
        <Notice tone="warning">
          Chưa cấu hình cửa sổ nộp PDF. Không suy hạn từ phase FINAL hoặc cửa sổ
          UC17.
        </Notice>
      )}
      <p className="muted text-sm mt-2">
        Trạng thái theo thời gian máy chủ lúc {date(context.serverNow)}. Backend
        kiểm tra lại quyền và hạn nộp khi xử lý yêu cầu.
      </p>
      <p className="mt-3">
        Dung lượng tối đa:{" "}
        {(context.maxFileBytes / 1024 / 1024).toLocaleString("vi-VN")} MiB.
      </p>
      {context.temporarySizeLimit && (
        <p className="muted text-sm">
          Đây là giới hạn kỹ thuật tạm thời do backend cấu hình, chưa phải mức
          được nhóm chốt.
        </p>
      )}
    </Card>
  );
}

export function CurrentFinalReportView({
  report,
  busy,
  onDownload,
}: {
  report: FinalReport;
  busy: boolean;
  onDownload: () => void;
}) {
  return (
    <Card title="PDF hiện hành" action={<Badge value={report.state} />}>
      {report.state === "SUBMITTED" ? (
        <div className="space-y-3">
          <p className="break-words">
            <strong>{report.file.originalName}</strong>
          </p>
          <p>
            {report.file.sizeBytes.toLocaleString("vi-VN")} byte · Revision{" "}
            {report.revision}
          </p>
          <p>Nộp lúc: {date(report.submittedAt)}</p>
          <Button variant="secondary" disabled={busy} onClick={onDownload}>
            Tải PDF hiện hành
          </Button>
          <p className="muted text-sm">
            Tải qua endpoint riêng tư. Nếu PDF được thay ở thiết bị khác,
            endpoint trả bản hiện hành tại thời điểm tải.
          </p>
        </div>
      ) : report.state === "LEGACY_REQUIRES_RECONCILIATION" ? (
        <Notice tone="warning">
          Bản ghi PDF legacy cần đối soát. Không tạo liên kết từ đường dẫn cũ;
          có thể nộp bản mới nếu backend cho phép.
        </Notice>
      ) : (
        <p>Chưa nộp PDF cuối cùng.</p>
      )}
      <p className="muted text-sm mt-3">
        Mỗi hồ sơ chỉ giữ một PDF hiện hành. Không cung cấp lịch sử các bản PDF
        đã thay thế.
      </p>
    </Card>
  );
}

export function FinalReportUploadForm({
  context,
  metadata,
  busy,
  progress,
  onUpload,
}: {
  context: FinalReportContext;
  metadata: FinalReport;
  busy: boolean;
  progress: number;
  onUpload: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  const blockers = uploadBlockers(context, metadata);
  return (
    <Card
      title={
        metadata.state === "SUBMITTED"
          ? "Thay thế PDF hiện hành"
          : "Nộp PDF cuối cùng"
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!file || checking || busy || blockers.length) return;
          onUpload(file);
        }}
      >
        <Notice>
          Nộp lại trước hạn được phép kể cả khi GVHD đã CONFIRMED. Thao tác này
          không tự đổi quyết định UC17, điều kiện bảo vệ hoặc điểm.
        </Notice>
        {blockers.length > 0 && (
          <Notice tone="warning">
            <ul className="list-disc pl-5">
              {blockers.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <fieldset
          disabled={busy || checking || blockers.length > 0}
          className="space-y-4"
        >
          <Field
            label="Chọn một file PDF"
            hint="Tên file, MIME, dung lượng và cấu trúc PDF được kiểm tra sơ bộ; backend kiểm tra nội dung và checksum."
          >
            <input
              type="file"
              accept=".pdf,application/pdf"
              aria-label="Chọn tệp PDF cuối cùng"
              onChange={async (event) => {
                const files = event.currentTarget.files;
                const selected = files?.length === 1 ? files[0] : null;
                event.currentTarget.value = "";
                const ticket = ++selection.current;
                setFile(null);
                setError("");
                setChecking(false);
                if (!selected) return;
                setChecking(true);
                try {
                  await validateFinalReportFile(selected, context);
                  if (selection.current === ticket) setFile(selected);
                } catch (e) {
                  if (selection.current === ticket)
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Không kiểm tra được PDF.",
                    );
                } finally {
                  if (selection.current === ticket) setChecking(false);
                }
              }}
            />
          </Field>
          {file && (
            <p className="break-words">
              Đã chọn: {file.name} · {file.size.toLocaleString("vi-VN")} byte
            </p>
          )}
          <p className="muted text-sm">
            PDF cũ chỉ được thay thế khi backend lưu thành công. Kiểm tra kỹ tệp
            trước khi nộp.
          </p>
          <Button disabled={busy || checking || !file || blockers.length > 0}>
            {busy
              ? "Đang xử lý…"
              : metadata.state === "SUBMITTED"
                ? "Nộp PDF thay thế"
                : "Nộp PDF"}
          </Button>
        </fieldset>
        {checking && <p role="status">Đang kiểm tra sơ bộ tệp PDF…</p>}
        {progress > 0 && (
          <p role="status">
            Đang gửi file: {progress}%. Chờ backend xác nhận và tải lại dữ liệu.
          </p>
        )}
      </form>
    </Card>
  );
}
