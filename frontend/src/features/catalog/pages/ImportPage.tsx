import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CircleAlert,
  Pencil,
  CheckCheck,
  X,
  RotateCcw,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import type { ImportRow } from "../../../shared/data/types";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
  Stat,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { catalogService } from "../services/catalog-service";
import { downloadCsv, readImportFile } from "../services/import-file";
import { step1Api } from "../../../shared/data/snapshot-api";
import StudentApiImport from "./StudentApiImport";
import { exportExcel } from "../../../shared/services/export-service";
import {
  ImportRules,
  ImportSourceCard,
  ImportSteps,
} from "../components/ImportSetup";
export default function ImportPage() {
  const { db, term } = useWorkspace();
  const action = useAction();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = searchParams.get("type") === "lecturer" ? "lecturer" : "student";
  function setKind(value: "student" | "lecturer") {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("job");
        if (value === "lecturer") next.set("type", value);
        else next.delete("type");
        return next;
      },
      { replace: true },
    );
  }
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileName = selectedFile?.name || "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validOnly, setValidOnly] = useState(false);
  const [errorOnly, setErrorOnly] = useState(false);
  const [addToTerm, setAddToTerm] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [edit, setEdit] = useState<ImportRow | null>(null);
  const [result, setResult] = useState("");
  const valid = rows.filter((r) => !r.errors.length);
  const invalid = rows.length - valid.length;
  const sample =
    kind === "student"
      ? [
          {
            code: "001234567",
            name: "Nguyễn Văn Mẫu",
            email: "sinhvien.mau@st.utc.edu.vn",
            phone: "0912345678",
            className: "CNTT – K64",
            program: term.program,
            gpa: "3.20",
          },
        ]
      : [
          {
            code: "GV_DEMO_01",
            name: "ThS. Trần Văn Mẫu",
            email: "giangvien.mau@utc.edu.vn",
            phone: "0987654321",
            quota: "3",
          },
        ];
  function validate(values: Record<string, string>[]) {
    return catalogService.validateImport(
      values,
      kind,
      (kind === "student" ? db.students : db.lecturers).map((x) => x.code),
    );
  }
  async function upload(file: File | null) {
    setSelectedFile(file);
    setError("");
    setResult("");
    setRows([]);
    if (!file) return;
    setLoading(true);
    try {
      setRows(validate(await readImportFile(file, kind)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được tệp.");
    } finally {
      setLoading(false);
    }
  }
  async function commit() {
    try {
      const message = await action.run(() =>
        catalogService.importRows(
          validOnly ? valid : rows,
          kind,
          addToTerm ? term.id : undefined,
        ),
      );
      setResult(String(message));
      setRows([]);
      setConfirm(false);
    } catch {
      setConfirm(false);
    }
  }
  if (step1Api.imports && kind === "student")
    return <StudentApiImport onLecturer={() => setKind("lecturer")} />;
  return (
    <div className="import-page">
      <PageHeader
        title="Import dữ liệu"
        description="Cập nhật danh sách từ tệp Excel hoặc CSV. Kiểm tra dữ liệu trước khi xác nhận nhập."
        actions={
          <Link
            className="btn btn-secondary"
            to={kind === "student" ? "/catalog/students" : "/catalog/lecturers"}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Danh sách {kind === "student" ? "sinh viên" : "giảng viên"}
          </Link>
        }
      />
      {step1Api.imports && kind === "lecturer" && (
        <div className="mb-5">
          <Notice tone="warning">
            Import giảng viên hiện lưu dữ liệu demo trên trình duyệt. Để cập
            nhật danh mục chính thức, dùng form trong Đội ngũ giảng viên.
          </Notice>
        </div>
      )}
      <ImportSteps stage={result ? 3 : rows.length ? 2 : 1} />
      <div className="import-workspace">
        <ImportSourceCard
          kind={kind}
          onKindChange={(value) => {
            setKind(value);
            setRows([]);
            setSelectedFile(null);
            setError("");
            setResult("");
            setAddToTerm(false);
            setValidOnly(false);
            setErrorOnly(false);
          }}
          term={term}
          file={selectedFile}
          onFileChange={upload}
          disabled={loading || action.pending}
          maxSizeMb={4}
          onTemplate={(format) => {
            if (format === "csv") downloadCsv(sample, `mau-${kind}.csv`);
            else
              action
                .run(() =>
                  exportExcel(`Mẫu ${kind}`, sample, `mau-${kind}.xlsx`),
                )
                .catch(() => {});
          }}
        >
          {kind === "student" && (
            <label className="checkbox-row mt-4">
              <input
                type="checkbox"
                checked={addToTerm}
                onChange={(e) => setAddToTerm(e.target.checked)}
              />
              Đồng thời thêm SV hợp lệ vào danh sách tham gia {term.code}
            </label>
          )}
          {error && (
            <div className="mt-5">
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
          {result && (
            <div className="mt-5">
              <Notice tone="success">
                <CheckCircle2 className="inline mr-2" size={15} />
                {result}. Tài khoản và mật khẩu hiện có được giữ nguyên.
              </Notice>
            </div>
          )}
          <div className="import-source-footer">
            <p>
              <CheckCircle2 size={15} aria-hidden="true" />
              {loading
                ? "Đang kiểm tra nội dung tệp…"
                : "Tệp được kiểm tra tự động sau khi chọn"}
            </p>
          </div>
        </ImportSourceCard>
        <ImportRules kind={kind} />
      </div>
      {!!rows.length && (
        <div className="mt-6">
          <div className="stat-grid">
            <Stat
              label="Tổng dòng"
              value={rows.length}
              icon={<FileSpreadsheet size={18} aria-hidden="true" />}
            />
            <Stat
              label="Hợp lệ"
              value={valid.length}
              icon={<CheckCircle2 size={18} aria-hidden="true" />}
            />
            <Stat
              label="Có lỗi"
              value={invalid}
              icon={<CircleAlert size={18} aria-hidden="true" />}
            />
            <Stat
              label="Sẵn sàng nhập"
              value={validOnly ? valid.length : invalid ? 0 : rows.length}
              icon={<Upload size={18} aria-hidden="true" />}
            />
          </div>
          <Card title="Kết quả kiểm tra" description={fileName}>
            <DataTable
              rows={errorOnly ? rows.filter((r) => r.errors.length) : rows}
              searchText={(r) =>
                `${r.row} ${r.values.code} ${r.values.name} ${r.errors.join(" ")}`
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
                    disabled={!invalid}
                    onClick={() =>
                      downloadCsv(
                        rows
                          .filter((r) => r.errors.length)
                          .map((r) => ({
                            row: r.row,
                            ...r.values,
                            errors: r.errors.join("; "),
                          })),
                        `loi-import-${kind}.csv`,
                      )
                    }
                  >
                    <Download size={16} aria-hidden="true" />
                    Tải báo cáo lỗi
                  </Button>
                </>
              }
              columns={[
                { key: "row", title: "Dòng", render: (r) => r.row },
                {
                  key: "code",
                  title: "Mã / họ tên",
                  render: (r) => (
                    <div>
                      <strong>{r.values.code || "Thiếu mã"}</strong>
                      <small className="block mt-1">
                        {r.values.name || "Thiếu họ tên"}
                      </small>
                    </div>
                  ),
                },
                {
                  key: "contact",
                  title: "Liên hệ",
                  render: (r) => (
                    <div>
                      {r.values.email}
                      <small className="block mt-1">{r.values.phone}</small>
                    </div>
                  ),
                },
                {
                  key: "extra",
                  title: kind === "student" ? "Hệ / GPA" : "Quota",
                  render: (r) =>
                    kind === "student"
                      ? `${r.values.program} · ${r.values.gpa}`
                      : r.values.quota,
                },
                {
                  key: "status",
                  title: "Kết quả kiểm tra",
                  render: (r) =>
                    r.errors.length ? (
                      <p className="text-wrap text-red-600">
                        {r.errors.join("; ")}
                      </p>
                    ) : (
                      <Badge value="PASS">Hợp lệ</Badge>
                    ),
                },
                {
                  key: "edit",
                  title: "Thao tác",
                  render: (r) => (
                    <Button
                      variant="ghost"
                      onClick={() => setEdit({ ...r, values: { ...r.values } })}
                    >
                      <Pencil size={16} aria-hidden="true" />
                      Sửa dòng
                    </Button>
                  ),
                },
              ]}
            />
            <div className="p-5">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={validOnly}
                  onChange={(e) => setValidOnly(e.target.checked)}
                />
                Chỉ nhập dòng hợp lệ và bỏ qua dòng có lỗi ({invalid} dòng)
              </label>
              <div className="form-actions">
                <Button
                  disabled={
                    action.pending ||
                    !valid.length ||
                    (!validOnly && invalid > 0)
                  }
                  onClick={() => setConfirm(true)}
                >
                  <CheckCheck size={16} aria-hidden="true" />
                  Xác nhận nhập {validOnly ? valid.length : rows.length} dòng
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {confirm && (
        <Confirm
          title="Nhập dữ liệu vào danh mục?"
          description={`Nhập ${validOnly ? valid.length : rows.length} ${kind === "student" ? "sinh viên" : "giảng viên"}${addToTerm ? ` và thêm vào ${term.code}` : ""}. ${validOnly && invalid ? `${invalid} dòng lỗi được bỏ qua. ` : ""}Các mã đã tồn tại luôn được kiểm tra lại trước khi lưu.`}
          onClose={() => setConfirm(false)}
          onConfirm={commit}
          pending={action.pending}
        />
      )}
      {edit && (
        <Modal
          title={`Sửa dữ liệu dòng ${edit.row}`}
          onClose={() => setEdit(null)}
          wide
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const updated = rows.map((r) => (r.row === edit.row ? edit : r));
              const checked = validate(updated.map((r) => r.values));
              setRows(checked.map((r, i) => ({ ...r, row: updated[i].row })));
              setEdit(null);
            }}
          >
            <div className="form-grid">
              {Object.entries(edit.values).map(([key, value]) => (
                <Field key={key} label={key}>
                  <input
                    value={value}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        values: { ...edit.values, [key]: e.target.value },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEdit(null)}
              >
                <X size={16} aria-hidden="true" />
                Hủy
              </Button>
              <Button>
                <RotateCcw size={16} aria-hidden="true" />
                Kiểm tra lại
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
