import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  CheckCircle2,
  CircleAlert,
  CalendarDays,
  X,
  Save,
  RotateCcw,
  Users,
  Pencil,
  Upload,
} from "lucide-react";
import type { Student } from "../../../shared/data/types";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
  Person,
  Stat,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { step1Api } from "../../../shared/data/snapshot-api";
import { catalogService } from "../services/catalog-service";
import { formatGpa, hasEligibleGpa } from "../../../shared/utils/gpa";
import "./catalog-directory.css";
type StudentForm = Student;
export default function StudentListPage() {
  const { db, user, term } = useWorkspace();
  const action = useAction();
  const manager = user.roles.some((r) => r === "ADMIN" || r === "FACULTY");
  const hasTerm = db.terms.some((t) => t.id === term.id);
  const [program, setProgram] = useState("");
  const [className, setClassName] = useState("");
  const [eligible, setEligible] = useState("");
  const [scope, setScope] = useState("all");
  const [form, setForm] = useState<StudentForm | null>(null);
  const [tableVersion, setTableVersion] = useState(0);
  const programs = db.catalogs.filter((c) => c.kind === "program");
  const departments = db.catalogs.filter((c) => c.kind === "department");
  const rows = db.students.filter(
    (s) =>
      (!program || s.program === program) &&
      (!className || s.className === className) &&
      (!eligible ||
        (eligible === "YES"
          ? s.eligible && hasEligibleGpa(s.gpa, 0)
          : !s.eligible || !hasEligibleGpa(s.gpa, 0))) &&
      (scope === "all" || term.studentIds.includes(s.id)),
  );
  function resetFilters() {
    setProgram("");
    setClassName("");
    setEligible("");
    setScope("all");
    setTableVersion((version) => version + 1);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      await action.run(() => catalogService.saveStudent(form));
      setForm(null);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <div className="catalog-directory">
      <PageHeader
        title="Danh sách sinh viên"
        description="Tra cứu và cập nhật thông tin học vụ, điều kiện tham gia đồ án và liên hệ của sinh viên."
        actions={
          manager && (
            <>
              <Link className="btn btn-secondary" to="/catalog/import">
                <Upload size={16} aria-hidden="true" />
                Import sinh viên
              </Link>
              {hasTerm && (
                <Link
                  className="btn btn-primary"
                  to={`/terms/${term.id}/roster`}
                >
                  <Users size={16} aria-hidden="true" />
                  Danh sách tham gia đợt
                </Link>
              )}
            </>
          )
        }
      />
      <div className="stat-grid">
        <Stat
          label="Tổng sinh viên"
          value={db.students.length}
          icon={<GraduationCap size={18} aria-hidden="true" />}
        />
        <Stat
          label="Đủ điều kiện học vụ"
          value={
            db.students.filter((s) => s.eligible && hasEligibleGpa(s.gpa, 0))
              .length
          }
          icon={<CheckCircle2 size={18} aria-hidden="true" />}
        />
        <Stat
          label="Chưa đủ điều kiện"
          value={
            db.students.filter((s) => !s.eligible || !hasEligibleGpa(s.gpa, 0))
              .length
          }
          icon={<CircleAlert size={18} aria-hidden="true" />}
        />
        <Stat
          label="Tham gia đợt hiện tại"
          value={term.studentIds.length}
          sub={term.code}
          icon={<CalendarDays size={18} aria-hidden="true" />}
        />
      </div>
      <Card
        title="Hồ sơ sinh viên"
        description={
          hasTerm
            ? `Đợt đang chọn: ${term.name}. Lọc phạm vi để xem sinh viên tham gia đợt này.`
            : "Tìm sinh viên theo mã, họ tên hoặc thông tin liên hệ."
        }
        action={
          <Button variant="ghost" onClick={resetFilters}>
            <RotateCcw size={15} aria-hidden="true" />
            Đặt lại bộ lọc
          </Button>
        }
      >
        <DataTable
          key={tableVersion}
          rows={rows}
          searchText={(s) => `${s.code} ${s.name} ${s.email} ${s.className}`}
          filters={
            <div className="catalog-filters catalog-filters-students">
              <Field label="Phạm vi danh sách">
                <select
                  aria-label="Phạm vi sinh viên"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="all">Toàn danh mục</option>
                  {hasTerm && (
                    <option value="term">Tham gia đợt đang chọn</option>
                  )}
                </select>
              </Field>
              <Field label="Hệ đào tạo">
                <select
                  aria-label="Lọc hệ đào tạo"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                >
                  <option value="">Mọi hệ đào tạo</option>
                  {programs.map((p) => (
                    <option key={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Lớp">
                <select
                  aria-label="Lọc lớp"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                >
                  <option value="">Mọi lớp</option>
                  {[...new Set(db.students.map((s) => s.className))]
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b, "vi"))
                    .map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                </select>
              </Field>
              <Field label="Điều kiện học vụ">
                <select
                  aria-label="Lọc điều kiện"
                  value={eligible}
                  onChange={(e) => setEligible(e.target.value)}
                >
                  <option value="">Mọi điều kiện</option>
                  <option value="YES">Đủ điều kiện</option>
                  <option value="NO">Chưa đủ điều kiện</option>
                </select>
              </Field>
            </div>
          }
          columns={[
            {
              key: "name",
              title: "Sinh viên",
              render: (s) => <Person name={s.name} sub={s.code} />,
            },
            {
              key: "class",
              title: "Lớp / hệ",
              render: (s) => (
                <div>
                  {s.className}
                  <small className="block muted mt-1">{s.program}</small>
                </div>
              ),
            },
            {
              key: "gpa",
              title: "GPA / 4",
              render: (s) => <strong>{formatGpa(s.gpa)}</strong>,
            },
            {
              key: "contact",
              title: "Liên hệ",
              render: (s) => (
                <div>
                  {s.email || "Chưa có email"}
                  <small className="block muted mt-1">
                    {s.phone || "Chưa có số điện thoại"}
                  </small>
                </div>
              ),
            },
            {
              key: "eligible",
              title: "Học vụ",
              render: (s) => (
                <Badge
                  value={
                    s.eligible && hasEligibleGpa(s.gpa, 0) ? "PASS" : "FAIL"
                  }
                >
                  {s.gpa === null
                    ? "Chưa có GPA"
                    : s.eligible
                      ? "Đủ điều kiện"
                      : "Chưa đủ điều kiện"}
                </Badge>
              ),
            },
            ...(manager
              ? [
                  {
                    key: "edit",
                    title: "Thao tác",
                    render: (s: Student) => (
                      <Button variant="ghost" onClick={() => setForm({ ...s })}>
                        <Pencil size={14} aria-hidden="true" />
                        Cập nhật
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      {form && (
        <Modal title="Cập nhật sinh viên" onClose={() => setForm(null)} wide>
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Mã sinh viên" hint="Lưu dạng chuỗi, giữ số 0 đầu.">
                <input
                  required
                  minLength={3}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </Field>
              <Field label="Họ và tên">
                <input
                  required
                  minLength={3}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Lớp">
                <input
                  required
                  value={form.className}
                  onChange={(e) =>
                    setForm({ ...form, className: e.target.value })
                  }
                />
              </Field>
              <Field label="Ngành học">
                <input
                  required
                  maxLength={200}
                  aria-label="Ngành học"
                  value={form.majorName || ""}
                  onChange={(e) =>
                    setForm({ ...form, majorName: e.target.value })
                  }
                />
              </Field>
              <Field label="Hệ đào tạo">
                <select
                  required
                  value={form.program}
                  onChange={(e) =>
                    setForm({ ...form, program: e.target.value })
                  }
                >
                  {programs.map((p) => (
                    <option
                      key={p.id}
                      disabled={!p.active && p.name !== form.program}
                    >
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              {!step1Api.catalog && (
                <Field label="Bộ môn">
                  <select
                    required
                    value={form.departmentId}
                    onChange={(e) =>
                      setForm({ ...form, departmentId: e.target.value })
                    }
                  >
                    {departments.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="GPA tích lũy (thang 4)">
                <input
                  required
                  type="number"
                  min={0}
                  max={4}
                  step="0.01"
                  value={form.gpa ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      gpa:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  required={!step1Api.catalog}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Số điện thoại">
                <input
                  required={!step1Api.catalog}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <label className="checkbox-row full">
                <input
                  type="checkbox"
                  checked={form.eligible}
                  onChange={(e) =>
                    setForm({ ...form, eligible: e.target.checked })
                  }
                />
                Đã được xác minh đủ điều kiện học vụ
              </label>
            </div>
            <Notice>
              Thông tin liên hệ được đồng bộ với tài khoản liên kết. Chọn sinh
              viên tham gia đồ án tại mục Danh sách tham gia đợt.
            </Notice>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setForm(null)}
              >
                <X size={16} aria-hidden="true" />
                Hủy
              </Button>
              <Button disabled={action.pending}>
                <Save size={16} aria-hidden="true" />
                Lưu sinh viên
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
