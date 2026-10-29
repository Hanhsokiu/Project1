import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  X,
  Save,
  Plus,
  Pencil,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import type { Term } from "../../../shared/data/types";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
  Stat,
  date,
  labels,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { termService } from "../services/term-service";
type TermForm = Pick<
  Term,
  | "name"
  | "code"
  | "semester"
  | "program"
  | "start"
  | "end"
  | "registrationStart"
  | "registrationEnd"
> & { id?: string };
const dateTime = (value: string, end = false) => {
  if (value.length === 10) return `${value}T${end ? "23:59" : "00:00"}`;
  const explicit =
    value.endsWith("Z") ||
    value.endsWith("z") ||
    value.slice(10).includes("+") ||
    value.slice(10).includes("-");
  return explicit
    ? new Date(value)
        .toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })
        .replace(" ", "T")
        .slice(0, 16)
    : value.slice(0, 16);
};
export default function TermListPage() {
  const { db, setTermId } = useWorkspace();
  const action = useAction({ invalidateTerms: true });
  const navigate = useNavigate();
  const [program, setProgram] = useState("");
  const [status, setStatus] = useState("");
  const [semester, setSemester] = useState("");
  const [form, setForm] = useState<TermForm | null>(null);
  const programs = db.catalogs.filter((c) => c.kind === "program" && c.active);
  const semesters = db.catalogs.filter(
    (c) => c.kind === "semester" && c.active,
  );
  const rows = db.terms.filter(
    (t) =>
      (!program || t.program === program) &&
      (!status || t.status === status) &&
      (!semester || t.semester === semester),
  );
  function create() {
    const today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const endDate = new Date(`${today}T12:00:00+07:00`);
    endDate.setDate(endDate.getDate() + 120);
    const end = endDate.toISOString().slice(0, 10);
    const closeDate = new Date(today + "T12:00:00+07:00");
    closeDate.setDate(closeDate.getDate() + 14);
    const close = closeDate.toISOString().slice(0, 10);
    setForm({
      name: "",
      code: "",
      semester: semesters[0]?.name || "",
      program: programs[0]?.name || "Chính quy",
      start: today,
      end,
      registrationStart: `${today}T08:00`,
      registrationEnd: `${close}T17:00`,
    });
  }
  function edit(t: Term) {
    setForm({
      id: t.id,
      code: t.code,
      name: t.name,
      semester: t.semester,
      program: t.program,
      start: t.start,
      end: t.end,
      registrationStart: dateTime(t.registrationStart),
      registrationEnd: dateTime(t.registrationEnd, true),
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      const id = await action.run(() => termService.save(form));
      setForm(null);
      if (typeof id === "string") {
        setTermId(id);
        navigate(`/terms/${id}`);
      }
    } catch {
      // useAction displays the failure; keep the current form available for correction.
    }
  }
  return (
    <>
      <PageHeader
        title="Kỳ học & đợt đồ án"
        description="Tổ chức đợt theo từng hệ đào tạo, thiết lập kế hoạch và theo dõi vòng đời hồ sơ."
        actions={
          <Button onClick={create}>
            <Plus size={16} />
            Tạo đợt mới
          </Button>
        }
      />
      <div className="stat-grid">
        <Stat
          label="Tổng đợt"
          value={db.terms.length}
          icon={<CalendarDays />}
        />
        <Stat
          label="Đang mở đăng ký"
          value={
            db.terms.filter((t) => t.status === "OPEN_REGISTRATION").length
          }
          icon={<CalendarCheck size={18} aria-hidden="true" />}
        />
        <Stat
          label="Đang thực hiện"
          value={db.terms.filter((t) => t.status === "IN_PROGRESS").length}
          icon={<Clock size={18} aria-hidden="true" />}
        />
        <Stat
          label="Đã hoàn thành"
          value={db.terms.filter((t) => t.status === "COMPLETED").length}
          icon={<CheckCircle2 size={18} aria-hidden="true" />}
        />
      </div>
      <Card title="Danh sách đợt đồ án">
        <DataTable
          rows={rows}
          searchText={(t) => `${t.code} ${t.name} ${t.semester}`}
          filters={
            <>
              <select
                aria-label="Lọc hệ đào tạo"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">Mọi hệ đào tạo</option>
                {db.catalogs
                  .filter((c) => c.kind === "program")
                  .map((p) => (
                    <option key={p.id}>{p.name}</option>
                  ))}
              </select>
              <select
                aria-label="Lọc kỳ học"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                <option value="">Mọi kỳ học</option>
                {[...new Set(db.terms.map((t) => t.semester))].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select
                aria-label="Lọc trạng thái đợt"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Mọi trạng thái</option>
                {[
                  "DRAFT",
                  "OPEN_REGISTRATION",
                  "CLOSED_REGISTRATION",
                  "IN_PROGRESS",
                  "DEFENDING",
                  "COMPLETED",
                  "CANCELLED",
                ].map((s) => (
                  <option value={s} key={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            </>
          }
          columns={[
            {
              key: "name",
              title: "Đợt đồ án",
              render: (t) => (
                <Link to={`/terms/${t.id}`} onClick={() => setTermId(t.id)}>
                  <strong>{t.name}</strong>
                  <small className="block muted mt-1">{t.code}</small>
                </Link>
              ),
            },
            {
              key: "system",
              title: "Hệ / kỳ học",
              render: (t) => (
                <div>
                  {t.program}
                  <small className="block muted mt-1">{t.semester}</small>
                </div>
              ),
            },
            {
              key: "time",
              title: "Thời gian",
              render: (t) => (
                <div>
                  {date(t.start)} – {date(t.end)}
                  <small className="block muted mt-1">
                    Đăng ký đến {date(t.registrationEnd)}
                  </small>
                </div>
              ),
            },
            {
              key: "count",
              title: "Sinh viên / GV",
              render: (t) =>
                `${t.studentIds.length} SV · ${t.lecturers.length} GV`,
            },
            {
              key: "status",
              title: "Trạng thái",
              render: (t) => (
                <div>
                  <Badge value={t.status} />
                  {t.locked && <Badge value="LOCKED">Khóa dữ liệu</Badge>}
                </div>
              ),
            },
            {
              key: "edit",
              title: "Thao tác",
              render: (t) => (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={
                      t.locked || ["COMPLETED", "CANCELLED"].includes(t.status)
                    }
                    aria-label={`Sửa đợt ${t.code}`}
                    onClick={() => edit(t)}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Link
                    aria-label={`Mở đợt ${t.code}`}
                    className="btn btn-ghost"
                    to={`/terms/${t.id}`}
                    onClick={() => setTermId(t.id)}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {form && (
        <Modal
          title={form.id ? "Cập nhật đợt đồ án" : "Tạo đợt đồ án"}
          onClose={() => setForm(null)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Mã đợt">
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="DATN-2026-3"
                />
              </Field>
              <Field label="Tên đợt">
                <input
                  required
                  minLength={5}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Kỳ học">
                <select
                  required
                  value={form.semester}
                  onChange={(e) =>
                    setForm({ ...form, semester: e.target.value })
                  }
                >
                  <option value="">Chọn kỳ học</option>
                  {semesters.map((p) => (
                    <option key={p.id}>{p.name}</option>
                  ))}
                  {!semesters.some((p) => p.name === form.semester) &&
                    form.semester && <option>{form.semester}</option>}
                </select>
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
                    <option key={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ngày bắt đầu">
                <input
                  required
                  type="date"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
              </Field>
              <Field label="Ngày kết thúc">
                <input
                  required
                  type="date"
                  min={form.start}
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                />
              </Field>
              <Field label="Mở đăng ký (giờ Việt Nam)">
                <input
                  required
                  type="datetime-local"
                  value={form.registrationStart}
                  onChange={(e) =>
                    setForm({ ...form, registrationStart: e.target.value })
                  }
                />
              </Field>
              <Field label="Đóng đăng ký (giờ Việt Nam)">
                <input
                  required
                  type="datetime-local"
                  min={form.registrationStart}
                  value={form.registrationEnd}
                  onChange={(e) =>
                    setForm({ ...form, registrationEnd: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="mt-5">
              <Notice>
                Đợt mới ở trạng thái Nháp. Tiếp tục cấu hình giai đoạn, SV đủ
                điều kiện và GV/quota trước khi mở đăng ký. Thêm kỳ học ở Danh
                mục đào tạo nếu chưa có.
              </Notice>
            </div>
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
                Lưu đợt đồ án
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
