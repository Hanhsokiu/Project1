import { useState } from "react";
import {
  Download,
  ArrowDownAZ,
  Megaphone,
  X,
  Save,
  CalendarDays,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  DataTable,
  Field,
  Modal,
  Notice,
  PageHeader,
  date,
} from "../../../shared/components/kit";
import type { Defense, DemoDb } from "../../../shared/data/types";
import { useDefenseScope } from "../components/DefenseScope";
import {
  publishDefenseSchedule,
  saveSchedule,
  scheduleConflicts,
  sortDefenseOrder,
} from "../services/defense-service";
import { exportExcel } from "../../../shared/services/export-service";
function Content({ db }: { db: DemoDb }) {
  const s = useDefenseScope(db);
  const [draft, setDraft] = useState<Defense>();
  const [filter, setFilter] = useState("");
  const [day, setDay] = useState("");
  const rows = s.defenses
    .filter(
      (d) =>
        (s.faculty || d.schedulePublished !== false) &&
        (!filter || d.committeeId === filter) &&
        (!day || d.date === day),
    )
    .sort((a, b) =>
      `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`),
    );
  const conflicts =
    draft && draft.date && draft.start && draft.end
      ? scheduleConflicts(db, draft)
      : [];
  return (
    <>
      <PageHeader
        title="Lịch bảo vệ đồ án"
        description="Quản lý ngày, phiên, phòng và thứ tự bảo vệ; kiểm tra trùng giảng viên và phòng."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                s.exec(() =>
                  exportExcel(
                    "Lịch bảo vệ",
                    rows.map((d) => ({
                      "Thứ tự": d.order,
                      "Sinh viên": s.name(d.studentId),
                      "Hội đồng": s.committeeName(d),
                      Ngày: d.date,
                      "Bắt đầu": d.start,
                      "Kết thúc": d.end,
                      Phòng: d.room,
                      "Phản biện": s.lecturer(d.reviewerId),
                    })),
                  ),
                )
              }
            >
              <Download size={16} aria-hidden="true" />
              Tải Excel
            </Button>
            {s.faculty && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => s.exec(() => sortDefenseOrder(s.term.id))}
                >
                  <ArrowDownAZ size={16} aria-hidden="true" />
                  Xếp Tên + Họ đệm
                </Button>
                <Button
                  disabled={
                    s.pending ||
                    !s.defenses.some(
                      (d) => d.date && d.schedulePublished === false,
                    )
                  }
                  onClick={() =>
                    s.exec(() => publishDefenseSchedule(s.term.id))
                  }
                >
                  <Megaphone size={16} aria-hidden="true" />
                  Công bố lịch
                </Button>
              </>
            )}
          </>
        }
      />
      <Notice>
        Thứ tự được xếp theo Tên + Họ đệm trong mỗi hội đồng, ngày và buổi
        sáng/chiều. Khung giờ hiện có được giữ thành các lượt; hệ thống từ chối
        nếu việc đổi thứ tự tạo trùng lịch giảng viên.
      </Notice>
      <Card title="Danh sách phiên bảo vệ" action={<CalendarDays size={20} />}>
        <DataTable
          rows={rows}
          searchText={(d) =>
            `${s.name(d.studentId)} ${d.room} ${s.committeeName(d)}`
          }
          filters={
            <>
              <select
                aria-label="Lọc hội đồng"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Tất cả hội đồng</option>
                {db.committees
                  .filter((c) => c.termId === s.term.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <input
                type="date"
                aria-label="Lọc ngày bảo vệ"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </>
          }
          columns={[
            { key: "order", title: "TT", render: (d) => d.order },
            {
              key: "student",
              title: "Sinh viên",
              render: (d) => s.name(d.studentId),
            },
            {
              key: "committee",
              title: "Hội đồng",
              render: (d) => s.committeeName(d),
            },
            {
              key: "time",
              title: "Thời gian",
              render: (d) =>
                d.date ? (
                  <div>
                    {date(d.date)}
                    <small className="block muted">
                      {d.start}–{d.end} · {d.start < "12:00" ? "Sáng" : "Chiều"}
                    </small>
                  </div>
                ) : (
                  <Badge>Chưa xếp lịch</Badge>
                ),
            },
            {
              key: "published",
              title: "Trạng thái",
              render: (d) => (
                <Badge
                  value={
                    d.date
                      ? d.schedulePublished === false
                        ? "DRAFT"
                        : "APPROVED"
                      : "PENDING"
                  }
                />
              ),
            },
            { key: "room", title: "Phòng", render: (d) => d.room },
            {
              key: "reviewer",
              title: "Phản biện",
              render: (d) => s.lecturer(d.reviewerId),
            },
            {
              key: "action",
              title: "",
              render: (d) =>
                s.faculty && (
                  <Button
                    variant="ghost"
                    onClick={() => setDraft(structuredClone(d))}
                  >
                    <CalendarDays size={16} aria-hidden="true" />
                    Xếp lịch
                  </Button>
                ),
            },
          ]}
        />
      </Card>
      {draft && (
        <Modal
          title={`Lịch bảo vệ · ${s.name(draft.studentId)}`}
          onClose={() => setDraft(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              s.exec(() => {
                saveSchedule(draft);
                setDraft(undefined);
              });
            }}
          >
            <Field label="Ngày bảo vệ">
              <input
                required
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Bắt đầu">
                <input
                  required
                  type="time"
                  value={draft.start}
                  onChange={(e) =>
                    setDraft({ ...draft, start: e.target.value })
                  }
                />
              </Field>
              <Field label="Kết thúc">
                <input
                  required
                  type="time"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </Field>
              <Field label="Phòng">
                <input
                  required
                  value={draft.room}
                  onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                />
              </Field>
              <Field label="Thứ tự">
                <input
                  required
                  type="number"
                  min={1}
                  value={draft.order}
                  onChange={(e) =>
                    setDraft({ ...draft, order: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            {conflicts.map((c) => (
              <Notice key={c} tone="danger">
                {c}
              </Notice>
            ))}
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraft(undefined)}
              >
                <X size={16} aria-hidden="true" />
                Hủy
              </Button>
              <Button disabled={s.pending || !!conflicts.length}>
                <Save size={16} aria-hidden="true" />
                Lưu lịch bảo vệ
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export default function SchedulePage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
