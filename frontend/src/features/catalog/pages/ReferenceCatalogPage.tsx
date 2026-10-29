import { useState, type FormEvent } from "react";
import { X, Save, Plus, Pencil } from "lucide-react";
import type { CatalogItem } from "../../../shared/data/types";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  PageHeader,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { step1Api } from "../../../shared/data/snapshot-api";
import type { CatalogApiInput } from "../services/catalog-api";
import { catalogService } from "../services/catalog-service";
const kinds: { kind: CatalogItem["kind"]; label: string }[] = [
  { kind: "department", label: "Bộ môn" },
  { kind: "program", label: "Hệ đào tạo" },
  { kind: "direction", label: "Hướng đồ án" },
  { kind: "semester", label: "Kỳ học" },
];
export default function ReferenceCatalogPage() {
  const { db } = useWorkspace();
  const action = useAction();
  const [kind, setKind] = useState<CatalogItem["kind"]>("department");
  const [active, setActive] = useState("");
  const [form, setForm] = useState<CatalogApiInput | null>(null);
  const isApiForm =
    !!form && (form.kind === "semester" ? step1Api.term : step1Api.catalog);
  const rows = db.catalogs.filter(
    (c) => c.kind === kind && (!active || c.active === (active === "YES")),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      await action.run(() => catalogService.saveItem(form));
      setForm(null);
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <>
      <PageHeader
        title="Danh mục đào tạo"
        description="Quản lý bộ môn, hệ đào tạo, hướng đồ án và kỳ học sử dụng chung."
        actions={
          <Button
            onClick={() =>
              setForm({
                kind,
                code: "",
                name: "",
                active: true,
                academicYear: "2026-2027",
                semesterNumber: 1,
                startDate: "",
                endDate: "",
              })
            }
          >
            <Plus size={15} />
            Thêm danh mục
          </Button>
        }
      />
      <div className="tabs mb-6">
        {kinds.map((k) => (
          <button
            className={`tab ${kind === k.kind ? "active" : ""}`}
            key={k.kind}
            onClick={() => setKind(k.kind)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <Card title={kinds.find((k) => k.kind === kind)?.label}>
        <DataTable
          rows={rows}
          searchText={(c) => `${c.code} ${c.name}`}
          filters={
            <select
              aria-label="Trạng thái danh mục"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="YES">Đang sử dụng</option>
              <option value="NO">Ngừng sử dụng</option>
            </select>
          }
          columns={[
            {
              key: "code",
              title: "Mã",
              render: (c) => <strong>{c.code}</strong>,
            },
            { key: "name", title: "Tên danh mục", render: (c) => c.name },
            {
              key: "count",
              title: "Liên kết dữ liệu",
              render: (c) =>
                kind === "direction"
                  ? `${db.lecturers.filter((l) => l.directionIds.includes(c.id)).length} giảng viên`
                  : kind === "department"
                    ? `${db.lecturers.filter((l) => l.departmentId === c.id).length} GV · ${db.students.filter((s) => s.departmentId === c.id).length} SV`
                    : kind === "program"
                      ? `${db.students.filter((s) => s.program === c.name).length} SV · ${db.terms.filter((t) => t.program === c.name).length} đợt`
                      : `${db.terms.filter((t) => t.semester === c.name).length} đợt`,
            },
            {
              key: "active",
              title: "Trạng thái",
              render: (c) => (
                <Badge value={c.active ? "APPROVED" : "CANCELLED"}>
                  {c.active ? "Đang sử dụng" : "Ngừng sử dụng"}
                </Badge>
              ),
            },
            {
              key: "edit",
              title: "Thao tác",
              render: (c) => (
                <Button
                  variant="ghost"
                  disabled={step1Api.term && c.kind === "semester"}
                  onClick={() => setForm({ ...c })}
                >
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
          title={`${form.id ? "Cập nhật" : "Thêm"} ${kinds.find((k) => k.kind === form.kind)?.label.toLocaleLowerCase("vi")}`}
          onClose={() => setForm(null)}
        >
          <form onSubmit={save} className="stack">
            {(!isApiForm ||
              (form.kind !== "direction" && form.kind !== "semester")) && (
              <Field label="Mã danh mục">
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </Field>
            )}
            {step1Api.term && form.kind === "semester" && (
              <>
                <Field label="Năm học">
                  <input
                    required
                    pattern="[0-9]{4}-[0-9]{4}"
                    value={form.academicYear || ""}
                    onChange={(e) =>
                      setForm({ ...form, academicYear: e.target.value })
                    }
                    placeholder="2026-2027"
                  />
                </Field>
                <Field label="Học kỳ">
                  <select
                    value={form.semesterNumber || 1}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        semesterNumber: Number(e.target.value),
                      })
                    }
                  >
                    {[1, 2, 3].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ngày bắt đầu kỳ">
                  <input
                    required
                    type="date"
                    value={form.startDate || ""}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                  />
                </Field>
                <Field label="Ngày kết thúc kỳ">
                  <input
                    required
                    type="date"
                    min={form.startDate}
                    value={form.endDate || ""}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                  />
                </Field>
              </>
            )}
            <Field label="Tên danh mục">
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            {!isApiForm && (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                Đang sử dụng
              </label>
            )}
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
                Lưu danh mục
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
