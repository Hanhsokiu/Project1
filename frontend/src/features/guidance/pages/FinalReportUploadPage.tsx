import { useState } from "react";
import FinalReportApiPage from "../final-reports/page";
import { finalReportApiEnabled } from "../final-reports/config";
import { CheckCircle2, FileCheck2, FileUp, UploadCloud } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  Empty,
  Field,
  FileLink,
  Modal,
  Notice,
  PageHeader,
  date,
  readFile,
} from "../../../shared/components/kit";
import type { DemoDb, StoredFile } from "../../../shared/data/types";
import { useAction } from "../../../shared/hooks/use-demo";
import { guidanceService, validatePdf } from "../services/guidance-service";
import {
  ActionError,
  GuidanceSelector,
  useGuidance,
} from "../components/guidance-kit";

function FinalContent({ db }: { db: DemoDb }) {
  const context = useGuidance(db);
  const { termId, studentId, student, own, topic, locked } = context;
  const action = useAction();
  const [file, setFile] = useState<StoredFile | null>(null);
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<StoredFile | null>(null);
  const [confirmUpload, setConfirmUpload] = useState(false);
  const report = db.finals.find(
    (f) => f.termId === termId && f.studentId === studentId,
  );
  const approved = !!topic && ["APPROVED", "LOCKED"].includes(topic.status);
  const canUpload = own && approved && !locked && !report?.confirmed;
  const versions = report ? [...report.revisions, report.file] : [];
  return (
    <>
      <PageHeader
        eyebrow="HƯỚNG DẪN ĐỒ ÁN / HỒ SƠ CUỐI KỲ"
        title="Báo cáo đồ án hoàn chỉnh"
        description="Nộp quyển PDF cuối cùng để GVHD xem xét điều kiện bảo vệ. Mỗi lần thay thế được giữ trong lịch sử."
      />
      <GuidanceSelector context={context} />
      {student && (
        <div className="grid xl:grid-cols-[1.15fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            <Card
              title="Bản báo cáo hiện tại"
              action={
                report && (
                  <Badge value={report.confirmed ? "APPROVED" : "SUBMITTED"}>
                    {report.confirmed
                      ? "GVHD đồng ý bảo vệ"
                      : "Đã nộp · chờ xác nhận"}
                  </Badge>
                )
              }
            >
              {report ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-indigo-50 p-5 flex items-center gap-4">
                    <FileCheck2
                      size={36}
                      className="text-indigo-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <strong className="break-words">
                        {report.file.name}
                      </strong>
                      <p className="muted text-sm mt-1">
                        Phiên bản {versions.length} · Nộp{" "}
                        {date(report.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <FileLink file={report.file} />
                    <Button
                      variant="secondary"
                      onClick={() => setPreview(report.file)}
                    >
                      Xem trước PDF
                    </Button>
                  </div>
                  {report.comment && (
                    <Notice tone={report.confirmed ? "success" : "warning"}>
                      <strong>Nhận xét GVHD</strong>
                      <p className="mt-1 whitespace-pre-wrap">
                        {report.comment}
                      </p>
                    </Notice>
                  )}
                  {report.confirmed && (
                    <Notice tone="success">
                      Hồ sơ đã được GVHD xác nhận. Sinh viên không thể thay tệp
                      cho đến khi xác nhận được thu hồi.
                    </Notice>
                  )}
                </div>
              ) : (
                <Empty
                  title="Chưa nộp PDF đồ án"
                  description="Sinh viên nộp bản hoàn chỉnh sau khi hoàn thiện báo cáo, sản phẩm và các yêu cầu của GVHD."
                />
              )}
            </Card>
            <Card
              title="Lịch sử phiên bản"
              description="Bản mới nhất được dùng để xét điều kiện và cung cấp cho người phản biện."
            >
              {versions.length ? (
                <div className="space-y-3">
                  {[...versions].reverse().map((version, index) => (
                    <div
                      className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3"
                      key={`${version.name}-${index}`}
                    >
                      <div>
                        <strong>Phiên bản {versions.length - index}</strong>
                        <p className="muted text-sm mt-1">
                          {index === 0 ? "Bản hiện tại" : "Bản đã thay thế"}
                        </p>
                      </div>
                      <FileLink file={version} />
                      <Button
                        variant="ghost"
                        onClick={() => setPreview(version)}
                      >
                        Xem
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Chưa có phiên bản được lưu.</p>
              )}
            </Card>
          </div>
          <Card
            title={report ? "Nộp bản cập nhật" : "Tải lên báo cáo PDF"}
            description="Tệp demo tối đa 4 MB. Kiểm tra tên tệp, MIME và chữ ký nội dung PDF."
          >
            {!approved && (
              <Notice tone="warning">
                Đề cương cần được phê duyệt trước khi nộp báo cáo hoàn chỉnh.
              </Notice>
            )}
            {canUpload ? (
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (file) setConfirmUpload(true);
                }}
              >
                <ActionError error={action.error} />
                {fileError && <Notice tone="danger">{fileError}</Notice>}
                <Field label="Chọn PDF từ thiết bị">
                  <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-7 space-y-4 text-center">
                    <UploadCloud
                      size={38}
                      className="mx-auto text-indigo-500"
                    />
                    <p className="text-sm muted">
                      Báo cáo tốt nghiệp hoàn chỉnh · .pdf
                    </p>
                    <input
                      aria-label="Chọn tệp PDF"
                      type="file"
                      accept=".pdf,application/pdf"
                      disabled={reading}
                      onChange={async (e) => {
                        const selected = e.target.files?.[0];
                        e.target.value = "";
                        if (!selected) return;
                        setFile(null);
                        setFileError("");
                        setReading(true);
                        try {
                          const stored = await readFile(selected);
                          validatePdf(stored);
                          setFile(stored);
                        } catch (error) {
                          setFileError((error as Error).message);
                        } finally {
                          setReading(false);
                        }
                      }}
                    />
                  </div>
                </Field>
                {reading && <p className="muted">Đang kiểm tra PDF…</p>}
                {file && (
                  <div className="rounded-xl border p-4 space-y-3">
                    <p className="text-emerald-700 text-sm flex gap-2 items-center">
                      <CheckCircle2 size={17} />
                      PDF hợp lệ · {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <FileLink file={file} />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setPreview(file)}
                    >
                      Kiểm tra bản xem trước
                    </Button>
                  </div>
                )}
                <Button disabled={!file || reading || action.pending}>
                  <FileUp size={16} />
                  {report ? "Nộp phiên bản mới" : "Nộp báo cáo hoàn chỉnh"}
                </Button>
              </form>
            ) : (
              <div className="mt-4">
                <Notice>
                  {own
                    ? report?.confirmed
                      ? "Bản báo cáo đã được xác nhận để bảo vệ."
                      : "Chưa thể nộp trong trạng thái hồ sơ hoặc đợt hiện tại."
                    : "Chỉ sinh viên trong hồ sơ được nộp PDF. GVHD và Giáo vụ có thể xem, tải báo cáo."}
                </Notice>
              </div>
            )}
          </Card>
        </div>
      )}
      {confirmUpload && file && (
        <Modal
          title="Xác nhận nộp báo cáo hoàn chỉnh"
          onClose={() => setConfirmUpload(false)}
        >
          <div className="space-y-4">
            <p>
              Tệp <strong>{file.name}</strong> sẽ trở thành báo cáo hiện tại.
              Bản trước được giữ trong lịch sử.
            </p>
            <ActionError error={action.error} />
            <div className="dialog-actions">
              <Button
                variant="secondary"
                onClick={() => setConfirmUpload(false)}
              >
                Kiểm tra lại
              </Button>
              <Button
                disabled={action.pending}
                onClick={() =>
                  action
                    .run(() =>
                      guidanceService.submitFinal(termId, studentId, file),
                    )
                    .then(() => {
                      setFile(null);
                      setConfirmUpload(false);
                    })
                    .catch(() => {})
                }
              >
                Xác nhận nộp PDF
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal wide title={preview.name} onClose={() => setPreview(null)}>
          <div className="space-y-4">
            <FileLink file={preview} />
            {preview.dataUrl && (
              <iframe
                title="Xem trước báo cáo PDF"
                className="w-full h-[65vh] rounded-lg border"
                src={preview.dataUrl}
              />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
export default function FinalReportUploadPage() {
  if (finalReportApiEnabled()) return <FinalReportApiPage />;
  return <DataBoundary>{(db) => <FinalContent db={db} />}</DataBoundary>;
}
