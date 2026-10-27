import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Upload,
  GraduationCap,
  UserCheck,
  UserX,
  Users,
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
type StudentForm = Omit<Student, "id"> & { id?: string };
export default function StudentListPage() {
  const { db, term } = useWorkspace();
  const action = useAction();
  const [program, setProgram] = useState("");
  const [className, setClassName] = useState("");
  const [eligible, setEligible] = useState("");
  const [scope, setScope] = useState("all");
  const [form, setForm] = useState<StudentForm | null>(null);
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
    <>
      <PageHeader
        title="Danh sách sinh viên"
        description="Dữ liệu học vụ và thông tin liên hệ dùng chung trong từng hồ sơ đồ án cá nhân."
        actions={
          <>
            <Link className="btn btn-secondary" to="/catalog/import">
              <Upload size={15} />
              Import
            </Link>
            <Button
              onClick={() =>
                setForm({
                  code: "",
                  name: "",
                  email: "",
                  phone: "",
                  className: "",
                  program: programs.find((c) => c.active)?.name || "Chính quy",
                  departmentId: departments[0]?.id || "",
                  gpa: 3,
                  eligible: true,
                })
              }
            >
              <Plus size={15} />
              Thêm sinh viên
            </Button>
          </>
        }
      />
      <div className="stat-grid">
        <Stat
          icon={<GraduationCap size={18} />}
          label="Tổng sinh viên"
          value={db.students.length}
        />
        <Stat
          icon={<UserCheck size={18} />}
          label="Đủ điều kiện học vụ"
          value={
            db.students.filter((s) => s.eligible && hasEligibleGpa(s.gpa, 0))
              .length
          }
        />
        <Stat
          icon={<UserX size={18} />}
          label="Chưa đủ điều kiện"
          value={
            db.students.filter((s) => !s.eligible || !hasEligibleGpa(s.gpa, 0))
              .length
          }
        />
        <Stat
          icon={<Users size={18} />}
          label="Tham gia đợt hiện tại"
          value={term.studentIds.length}
          sub={term.code}
        />
      </div>
      <Card title="Hồ sơ sinh viên">
        <DataTable
          rows={rows}
          searchText={(s) => `${s.code} ${s.name} ${s.email} ${s.className}`}
          filters={
            <>
              <select
                aria-label="Phạm vi sinh viên"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="all">Toàn danh mục</option>
                <option value="term">Thuộc {term.code}</option>
              </select>
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
              <select
                aria-label="Lọc lớp"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              >
                <option value="">Mọi lớp</option>
                {[...new Set(db.students.map((s) => s.className))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Lọc điều kiện"
                value={eligible}
                onChange={(e) => setEligible(e.target.value)}
              >
                <option value="">Mọi điều kiện</option>
                <option value="YES">Đủ điều kiện</option>
                <option value="NO">Chưa đủ điều kiện</option>
              </select>
            </>
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
                  {s.email}
                  <small className="block muted mt-1">{s.phone}</small>
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
            {
              key: "edit",
              title: "Thao tác",
              render: (s) => (
                <Button variant="ghost" onClick={() => setForm({ ...s })}>
                  <Pencil size={14} />
                  Cập nhật
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {form && (
        <Modal
          title={form.id ? "Cập nhật sinh viên" : "Thêm sinh viên"}
          onClose={() => setForm(null)}
          wide
        >
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
              {form.id
                ? "Đổi thông tin sẽ đồng bộ tài khoản liên kết. Danh sách tham gia đợt được quản lý riêng."
                : "Tạo tài khoản username và mật khẩu mặc định bằng mã SV; sinh viên phải đổi mật khẩu khi đăng nhập lần đầu."}
            </Notice>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setForm(null)}
              >
                Hủy
              </Button>
              <Button disabled={action.pending}>Lưu sinh viên</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
