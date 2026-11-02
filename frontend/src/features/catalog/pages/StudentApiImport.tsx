import {
  Download,
  FileUp,
  RotateCcw,
  X,
  FileSpreadsheet,
  CheckCircle2,
  CircleAlert,
  Upload,
  CheckCheck,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Confirm,
  DataTable,
  Notice,
  PageHeader,
  Stat,
  Badge,
} from "../../../shared/components/kit";
import { useAction } from "../../../shared/hooks/use-demo";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { downloadCsv } from "../services/import-file";
import { importApi, type ImportJobDto } from "../services/import-api";
import {
  ImportRules,
  ImportSourceCard,
  ImportSteps,
} from "../components/ImportSetup";

export default function StudentApiImport({
  onLecturer,
}: {
  onLecturer: () => void;
}) {
  const { term } = useWorkspace();
  const action = useAction();
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get("job") || "";
  const [job, setJob] = useState<ImportJobDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRequest, setHistoryRequest] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validOnly, setValidOnly] = useState(false);
  const [errorOnly, setErrorOnly] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const completed = job?.status === "DONE" || job?.status === "PARTIAL";
  function selectJob(id?: string) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set("job", id);
        else next.delete("job");
        return next;
      },
      { replace: true },
    );
  }
  useEffect(() => {
    let active = true;
    if (!jobId) {
      setJob(null);
      setHistoryError("");
      setHistoryLoading(false);
      return;
    }
    setJob(null);
    setHistoryError("");
    setHistoryLoading(true);
    importApi
      .get(jobId)
      .then((next) => {
        if (!active) return;
        if (next.termId !== term.id) {
          setHistoryError(
            "Kết quả import thuộc đợt khác. Hãy chọn đúng đợt hoặc tải tệp mới.",
          );
          return;
        }
        setJob(next);
        if (next.mode) setValidOnly(next.mode === "VALID_ONLY");
      })
      .catch((error: Error) => {
        if (active)
          setHistoryError(error.message || "Không tải được kết quả import.");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId, term.id, historyRequest]);
  async function preview() {
    if (!selectedFile || !term.id) return;
    try {
      const next = await action.run(() =>
        importApi.preview(selectedFile, term.id),
      );
      setJob(next as ImportJobDto);
      setHistoryError("");
      selectJob((next as ImportJobDto).id);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  async function commit() {
    if (!job) return;
    try {
      const next = await action.run(() =>
        importApi.confirm(job.id, validOnly ? "VALID_ONLY" : "STRICT"),
      );
      setJob(next as ImportJobDto);
      setConfirm(false);
    } catch {
      setConfirm(false);
    }
  }
  return (
    <div className="import-page">
      <PageHeader
        title="Import dữ liệu"
        description="Cập nhật danh sách từ tệp Excel hoặc CSV. Kiểm tra dữ liệu trước khi xác nhận nhập."
        actions={
          <Link className="btn btn-secondary" to="/catalog/students">
            <ArrowLeft size={16} aria-hidden="true" />
            Danh sách sinh viên
          </Link>
        }
      />
      <ImportSteps stage={completed ? 3 : job || historyLoading ? 2 : 1} />
      <div className="import-workspace">
        <ImportSourceCard
          kind="student"
          onKindChange={(value) => {
            if (value === "lecturer") onLecturer();
          }}
          term={term}
          file={selectedFile}
          onFileChange={(file) => {
            setSelectedFile(file);
            setJob(null);
            setHistoryError("");
            setValidOnly(false);
            setErrorOnly(false);
            selectJob();
          }}
          disabled={action.pending}
          requireTerm
          onTemplate={(format) => {
            action.run(() => importApi.template(format)).catch(() => {});
          }}
        >
          {!term.id && (
            <div className="mt-4">
              <Notice tone="warning">
                Tạo hoặc chọn một đợt trước khi tải và nhập danh sách sinh viên.
              </Notice>
            </div>
          )}
          <div className="import-source-footer">
            <p>
              <CheckCircle2 size={15} aria-hidden="true" />
              Chỉ lưu dữ liệu sau khi bạn xác nhận
            </p>
            <Button
              disabled={!selectedFile || !term.id || action.pending}
              onClick={preview}
            >
              <FileUp size={16} aria-hidden="true" />
              {action.pending ? "Đang xử lý…" : "Kiểm tra tệp"}
            </Button>
          </div>
          {action.error && (
            <div className="mt-4">
              <Notice tone="danger">{action.error.message}</Notice>
            </div>
          )}
        </ImportSourceCard>
        <ImportRules kind="student" contactsOptional />
      </div>
      {historyLoading && (
        <div className="mt-6">
          <Notice>Đang tải kết quả import…</Notice>
        </div>
      )}
      {historyError && (
        <div className="mt-6 space-y-3">
          <Notice tone="danger">{historyError}</Notice>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setHistoryRequest((value) => value + 1)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Thử tải lại kết quả
            </Button>
            <Button variant="ghost" onClick={() => selectJob()}>
              <X size={16} aria-hidden="true" />
              Bỏ qua kết quả này
            </Button>
          </div>
        </div>
      )}
      {job && (
        <div className="mt-6">
          <div className="stat-grid">
            <Stat
              label="Tổng dòng"
              value={job.totalRows}
              icon={<FileSpreadsheet size={18} aria-hidden="true" />}
            />
            <Stat
              label="Hợp lệ"
              value={job.validRows}
              icon={<CheckCircle2 size={18} aria-hidden="true" />}
            />
            <Stat
              label="Có lỗi"
              value={job.invalidRows}
              icon={<CircleAlert size={18} aria-hidden="true" />}
            />
            <Stat
              label={completed ? "Đã nhập thành công" : "Sẵn sàng nhập"}
              value={
                completed
                  ? job.successRows
                  : validOnly
                    ? job.validRows
                    : job.invalidRows
                      ? 0
                      : job.validRows
              }
              icon={
                completed ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : (
                  <Upload size={18} aria-hidden="true" />
                )
              }
            />
          </div>
          {completed && (
            <div className="mb-5">
              <Notice tone="success">
                Đã nhập {job.successRows} dòng; bỏ qua {job.skippedRows} dòng.
                Không tạo tài khoản mới hoặc đặt lại mật khẩu.
              </Notice>
            </div>
          )}
          <Card
            title="Kết quả kiểm tra"
            description={job.fileName}
            action={
              <Badge value={completed ? "COMPLETED" : "PENDING"}>
                {job.status === "DONE"
                  ? "Đã hoàn tất"
                  : job.status === "PARTIAL"
                    ? "Hoàn tất một phần"
                    : "Đã kiểm tra"}
              </Badge>
            }
          >
            <DataTable
              rows={
                errorOnly ? job.rows.filter((r) => r.errors.length) : job.rows
              }
              searchText={(r) =>
                `${r.rowNumber} ${r.values.studentCode} ${r.values.fullName} ${r.errors.map((e) => e.message).join(" ")}`
              }
              filters={
                <>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={errorOnly}
                      onChange={(e) => setErrorOnly(e.target.checked)}
                    />
                    Chỉ dòng có lỗi
                  </label>
                  <Button
                    variant="secondary"
                    disabled={!job.invalidRows}
                    onClick={() =>
                      downloadCsv(
                        job.rows
                          .filter((r) => r.errors.length)
                          .map((r) => ({
                            row: r.rowNumber,
                            ...r.values,
                            errors: r.errors.map((e) => e.message).join("; "),
                          })),
                        "loi-import-sinh-vien.csv",
                      )
                    }
                  >
                    <Download size={16} aria-hidden="true" />
                    Tải báo cáo lỗi
                  </Button>
                </>
              }
              columns={[
                { key: "row", title: "Dòng", render: (r) => r.rowNumber },
                {
                  key: "student",
                  title: "Sinh viên",
                  render: (r) => (
                    <div>
                      <strong>{r.values.studentCode}</strong>
                      <p>{r.values.fullName}</p>
                    </div>
                  ),
                },
                {
                  key: "program",
                  title: "Lớp / hệ / GPA",
                  render: (r) => (
                    <div>
                      {r.values.className}
                      <p>
                        {r.values.trainingSystemCode || "Theo đợt"} ·{" "}
                        {r.values.gpa ?? "—"}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "action",
                  title: "Thao tác",
                  render: (r) =>
                    ({
                      CREATE: "Tạo mới",
                      UPDATE: "Cập nhật",
                      SKIP: "Bỏ qua",
                      ERROR: "Có lỗi",
                    })[r.action] || r.action,
                },
                {
                  key: "errors",
                  title: "Kết quả",
                  render: (r) =>
                    r.errors.length ? (
                      <p className="text-wrap text-red-600">
                        {r.errors.map((e) => e.message).join("; ")}
                      </p>
                    ) : (
                      <Badge value="PASS">
                        {r.status === "IMPORTED"
                          ? "Đã nhập"
                          : r.status === "SKIPPED"
                            ? "Đã bỏ qua"
                            : "Hợp lệ"}
                      </Badge>
                    ),
                },
              ]}
            />
            <div className="p-5">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  disabled={completed || action.pending}
                  checked={validOnly}
                  onChange={(e) => setValidOnly(e.target.checked)}
                />
                Chỉ nhập dòng hợp lệ, bỏ qua dòng lỗi
              </label>
              <div className="form-actions">
                <Button
                  disabled={
                    completed ||
                    action.pending ||
                    !job.validRows ||
                    (!validOnly && job.invalidRows > 0)
                  }
                  onClick={() => setConfirm(true)}
                >
                  <CheckCheck size={16} aria-hidden="true" />
                  Xác nhận nhập
                </Button>
                <Button
                  variant="secondary"
                  disabled={action.pending}
                  onClick={() =>
                    action
                      .run(() => importApi.get(job.id))
                      .then((next) => setJob(next as ImportJobDto))
                      .catch(() => {})
                  }
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Tải lại kết quả
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {confirm && (
        <Confirm
          title="Xác nhận nhập sinh viên?"
          description={`Ghi ${validOnly ? job?.validRows : job?.totalRows} dòng theo kết quả kiểm tra. ${validOnly ? "Các dòng lỗi được bỏ qua." : "Toàn bộ tệp phải hợp lệ."}`}
          pending={action.pending}
          onClose={() => setConfirm(false)}
          onConfirm={commit}
        />
      )}
    </div>
  );
}
