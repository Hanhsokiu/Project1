import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Confirm,
  DataTable,
  Field,
  Notice,
  PageHeader,
  Stat,
  Badge,
} from "../../../shared/components/kit";
import { useAction } from "../../../shared/hooks/use-demo";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { downloadCsv } from "../services/import-file";
import { importApi, type ImportJobDto } from "../services/import-api";

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
    <>
      <PageHeader
        title="Import dữ liệu"
        description="Tải mẫu, gửi tệp để kiểm tra từng dòng và xác nhận ghi dữ liệu."
      />
      <div className="section-grid">
        <Card title="1. Chọn nguồn dữ liệu">
          <div className="form-grid">
            <Field label="Loại danh sách">
              <select
                value="student"
                onChange={(e) => {
                  if (e.target.value === "lecturer") onLecturer();
                }}
              >
                <option value="student">Sinh viên</option>
                <option value="lecturer">Giảng viên</option>
              </select>
            </Field>
            <Field label="Đợt đang chọn">
              <input
                disabled
                value={
                  term.id ? `${term.code} · ${term.program}` : "Chưa chọn đợt"
                }
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <Button
              variant="secondary"
              disabled={action.pending}
              onClick={() =>
                action.run(() => importApi.template("csv")).catch(() => {})
              }
            >
              Tải mẫu CSV
            </Button>
            <Button
              variant="secondary"
              disabled={action.pending}
              onClick={() =>
                action.run(() => importApi.template("xlsx")).catch(() => {})
              }
            >
              Tải mẫu Excel
            </Button>
          </div>
          <Field
            label="Chọn tệp CSV hoặc XLSX"
            hint="Tệp được kiểm tra trên hệ thống trước khi ghi dữ liệu."
          >
            <input
              type="file"
              accept=".csv,.xlsx"
              disabled={!term.id || action.pending}
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] || null);
                setJob(null);
                setHistoryError("");
                selectJob();
              }}
            />
          </Field>
          <div className="mt-4">
            <Notice tone={term.id ? "info" : "warning"}>
              {term.id
                ? `Nhập sinh viên đủ điều kiện vào đợt ${term.code}. Hệ đào tạo và điều kiện học vụ được kiểm tra theo đợt.`
                : "Tạo hoặc chọn một đợt trước khi tải và nhập danh sách sinh viên."}
            </Notice>
          </div>
          <div className="mt-4">
            <Button
              disabled={!selectedFile || !term.id || action.pending}
              onClick={preview}
            >
              {action.pending ? "Đang xử lý…" : "Kiểm tra tệp"}
            </Button>
          </div>
          {action.error && (
            <div className="mt-4">
              <Notice tone="danger">{action.error.message}</Notice>
            </div>
          )}
        </Card>
        <Card title="Quy tắc nhập sinh viên">
          <div className="space-y-4 text-sm">
            <p>
              Dùng cột trong file mẫu. Mã sinh viên giữ nguyên số 0 đầu; GPA từ
              0 đến 4.
            </p>
            <p>
              Email và điện thoại có thể để trống. Sinh viên bổ sung thông tin
              khi đăng nhập.
            </p>
            <p>
              Sinh viên đã tồn tại được cập nhật theo kết quả xem trước; tài
              khoản cũ giữ nguyên mật khẩu.
            </p>
            <p>
              Khi nhập vào đợt, sinh viên phải đúng hệ và đủ điều kiện học vụ.
              Dòng không đạt được báo lý do cụ thể.
            </p>
            <Notice>
              Muốn sửa dữ liệu, cập nhật tệp và kiểm tra lại trước khi xác nhận.
              Kết quả kiểm tra được lưu thành một công việc import.
            </Notice>
          </div>
        </Card>
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
              Thử tải lại kết quả
            </Button>
            <Button variant="ghost" onClick={() => selectJob()}>
              Bỏ qua kết quả này
            </Button>
          </div>
        </div>
      )}
      {job && (
        <div className="mt-6">
          <div className="stat-grid">
            <Stat label="Tổng dòng" value={job.totalRows} />
            <Stat label="Hợp lệ" value={job.validRows} />
            <Stat label="Có lỗi" value={job.invalidRows} />
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
            />
          </div>
          {completed && (
            <div className="mb-5">
              <Notice tone="success">
                Đã nhập {job.successRows} dòng; bỏ qua {job.skippedRows} dòng.
                Tài khoản sinh viên mới bắt buộc đổi mật khẩu lần đầu.
              </Notice>
            </div>
          )}
          <Card
            title="2. Kết quả kiểm tra"
            description={`${job.fileName} · ${job.id}`}
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
    </>
  );
}
