import { useState, type ChangeEvent } from "react";
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
export default function ImportPage() {
  const { db, term } = useWorkspace();
  const action = useAction();
  const [kind, setKind] = useState<"student" | "lecturer">("student");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
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
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setResult("");
    setRows([]);
    setFileName(file.name);
    try {
      setRows(validate(await readImportFile(file, kind)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được tệp.");
    } finally {
      setLoading(false);
      event.target.value = "";
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
    <>
      <PageHeader
        title="Import dữ liệu"
        description="Tải mẫu, kiểm tra từng dòng rồi xác nhận nhập. Mã SV/GV được giữ ở dạng chuỗi."
      />
      {step1Api.imports && kind === "lecturer" && (
        <div className="mb-5">
          <Notice tone="warning">
            Import giảng viên hiện lưu dữ liệu demo trên trình duyệt. Để cập
            nhật danh mục chính thức, dùng form trong Đội ngũ giảng viên.
          </Notice>
        </div>
      )}
      <div className="section-grid">
        <Card title="1. Chọn nguồn dữ liệu">
          <div className="form-grid">
            <Field label="Loại danh sách">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as "student" | "lecturer");
                  setRows([]);
                  setFileName("");
                  setError("");
                  setResult("");
                  setAddToTerm(false);
                }}
              >
                <option value="student">Sinh viên</option>
                <option value="lecturer">Giảng viên</option>
              </select>
            </Field>
            <Field label="Đợt đang chọn">
              <input value={`${term.code} · ${term.program}`} disabled />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <Button
              variant="secondary"
              onClick={() => downloadCsv(sample, `mau-${kind}.csv`)}
            >
              <Download size={15} />
              Mẫu CSV
            </Button>
            <Button
              variant="secondary"
              disabled={action.pending}
              onClick={() =>
                action
                  .run(() =>
                    exportExcel(`Mẫu ${kind}`, sample, `mau-${kind}.xlsx`),
                  )
                  .catch(() => {})
              }
            >
              <FileSpreadsheet size={15} />
              Mẫu Excel
            </Button>
          </div>
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 cursor-pointer mt-6">
            <Upload size={27} className="text-slate-400" />
            <strong className="text-sm">
              {loading ? "Đang đọc tệp…" : "Chọn tệp CSV hoặc XLSX"}
            </strong>
            <small className="muted">
              Tối đa 4 MB · {fileName || "Chưa chọn tệp"}
            </small>
            <input
              type="file"
              accept=".csv,.xlsx"
              disabled={loading || action.pending}
              className="max-w-full text-sm"
              onChange={upload}
            />
          </label>
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
                {result}. Tài khoản mới bắt buộc đổi mật khẩu lần đầu.
              </Notice>
            </div>
          )}
        </Card>
        <div className="stack">
          <Card title="Quy tắc kiểm tra">
            <ul className="space-y-3 text-sm muted">
              <li>Đúng tên cột của file mẫu; các mã giữ số 0 đầu.</li>
              <li>Email/SĐT hợp lệ, mã không trùng trong tệp hoặc danh mục.</li>
              <li>
                SV có lớp/hệ đào tạo và GPA từ 0 đến 4; điều kiện học vụ demo
                dựa trên GPA ≥ 2.
              </li>
              <li>
                Quota GV là số nguyên không âm; chuyên môn được cập nhật trong
                danh mục sau import.
              </li>
              <li>
                Khi thêm SV vào đợt, hệ phải khớp và GPA phải đạt ngưỡng của
                đợt.
              </li>
            </ul>
          </Card>
          <Notice>
            Import lại sẽ báo các mã đã tồn tại. Không ghi đè liên hệ hoặc đặt
            lại mật khẩu của tài khoản cũ.
          </Notice>
        </div>
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
          <Card title="2. Kiểm tra & xác nhận" description={fileName}>
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
    </>
  );
}
