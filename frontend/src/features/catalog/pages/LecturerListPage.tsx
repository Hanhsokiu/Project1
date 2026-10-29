import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  Users,
  Building2,
  UserCheck,
  ChartNoAxesColumnIncreasing,
  X,
  Save,
  Plus,
  Pencil,
} from "lucide-react";
import type { Lecturer } from "../../../shared/data/types";
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
import { catalogService } from "../services/catalog-service";
type LecturerForm = Omit<Lecturer, "id"> & { id?: string };
export default function LecturerListPage() {
  const { db, user, term } = useWorkspace();
  const action = useAction();
  const manager = user.roles.some((r) => r === "ADMIN" || r === "FACULTY");
  const [department, setDepartment] = useState("");
  const [direction, setDirection] = useState("");
  const [form, setForm] = useState<LecturerForm | null>(null);
  const departments = db.catalogs.filter((c) => c.kind === "department");
  const directions = db.catalogs.filter((c) => c.kind === "direction");
  const rows = db.lecturers.filter(
    (l) =>
      (!department || l.departmentId === department) &&
      (!direction || l.directionIds.includes(direction)),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      await action.run(() => catalogService.saveLecturer(form));
      setForm(null);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <>
      <PageHeader
        title="Đội ngũ giảng viên"
        description="Chuyên môn, liên hệ và năng lực hướng dẫn. Quota thực tế được cấu hình riêng theo đợt."
        actions={
          manager && (
            <>
              <Link className="btn btn-secondary" to="/catalog/import">
                <Upload size={16} aria-hidden="true" />
                Import giảng viên
              </Link>
              <Button
                onClick={() =>
                  setForm({
                    code: "",
                    name: "",
                    email: "",
                    phone: "",
                    departmentId: departments[0]?.id || "",
                    directionIds: [],
                    quota: 3,
                  })
                }
              >
                <Plus size={15} />
                Thêm giảng viên
              </Button>
            </>
          )
        }
      />
      <div className="stat-grid">
        <Stat
          label="Giảng viên"
          value={db.lecturers.length}
          icon={<Users size={18} aria-hidden="true" />}
        />
        <Stat
          label="Bộ môn"
          value={departments.length}
          icon={<Building2 size={18} aria-hidden="true" />}
        />
        <Stat
          label="Tham gia đợt"
          value={term.lecturers.length}
          icon={<UserCheck size={18} aria-hidden="true" />}
        />
        <Stat
          label="Tổng quota trong đợt"
          value={term.lecturers.reduce((a, l) => a + l.quota, 0)}
          icon={<ChartNoAxesColumnIncreasing size={18} aria-hidden="true" />}
        />
      </div>
      <Card title="Danh sách giảng viên">
        <DataTable
          rows={rows}
          searchText={(l) => `${l.code} ${l.name} ${l.email}`}
          filters={
            <>
              <select
                aria-label="Lọc bộ môn"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">Mọi bộ môn</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Lọc hướng chuyên môn"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="">Mọi hướng chuyên môn</option>
                {directions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </>
          }
          columns={[
            {
              key: "name",
              title: "Giảng viên",
              render: (l) => <Person name={l.name} sub={l.code} />,
            },
            {
              key: "department",
              title: "Bộ môn",
              render: (l) =>
                db.catalogs.find((c) => c.id === l.departmentId)?.name || "—",
            },
            {
              key: "areas",
              title: "Hướng chuyên môn",
              render: (l) => (
                <div className="flex flex-wrap gap-1 max-w-xs">
                  {l.directionIds.map((id) => (
                    <Badge key={id}>
                      {db.catalogs.find((c) => c.id === id)?.name || id}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              key: "quota",
              title: "Tải đợt / quota",
              render: (l) => {
                const quota = term.lecturers.find(
                  (x) => x.lecturerId === l.id,
                )?.quota;
                const count = db.assignments.filter(
                  (a) => a.termId === term.id && a.lecturerId === l.id,
                ).length;
                return (
                  <div>
                    <strong>
                      {count} / {quota ?? "—"}
                    </strong>
                    <small className="block muted mt-1">
                      Mặc định {l.quota} SV
                    </small>
                  </div>
                );
              },
            },
            {
              key: "contact",
              title: "Liên hệ",
              render: (l) => (
                <div>
                  {l.email}
                  <small className="block muted mt-1">{l.phone}</small>
                </div>
              ),
            },
            ...(manager
              ? [
                  {
                    key: "edit",
                    title: "Thao tác",
                    render: (l: Lecturer) => (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setForm({ ...l, directionIds: [...l.directionIds] })
                        }
                      >
                        <Pencil size={14} />
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
        <Modal
          title={form.id ? "Cập nhật giảng viên" : "Thêm giảng viên"}
          onClose={() => setForm(null)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Mã giảng viên">
                <input
                  required
                  minLength={2}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </Field>
              <Field label="Họ tên, học vị/chức danh">
                <input
                  required
                  minLength={3}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
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
              <Field label="Quota mặc định">
                <input
                  required
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.quota}
                  onChange={(e) =>
                    setForm({ ...form, quota: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Số điện thoại">
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <fieldset className="full">
                <legend className="text-sm mb-2">
                  Hướng chuyên môn có thể hướng dẫn
                </legend>
                {directions.map((d) => (
                  <label className="checkbox-row" key={d.id}>
                    <input
                      type="checkbox"
                      checked={form.directionIds.includes(d.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          directionIds: e.target.checked
                            ? [...form.directionIds, d.id]
                            : form.directionIds.filter((x) => x !== d.id),
                        })
                      }
                    />
                    {d.name}
                  </label>
                ))}
              </fieldset>
            </div>
            <Notice>
              Quota ở đây là mặc định khi thêm GV vào đợt. Thay quota một đợt
              tại danh sách tham gia; hệ thống kiểm tra tải phân công trước khi
              lưu.
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
                Lưu giảng viên
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
