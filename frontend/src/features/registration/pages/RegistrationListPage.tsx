import {
  ClipboardList,
  FileCheck2,
  FilePenLine,
  FileClock,
} from "lucide-react";
import {
  Badge,
  Card,
  DataTable,
  Notice,
  PageHeader,
  Person,
  Stat,
  date,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";

export default function RegistrationListPage() {
  const { db, term, termId } = useWorkspace();
  const rows = db.registrations.filter((r) => r.termId === termId);
  return (
    <>
      <PageHeader
        eyebrow="BƯỚC 02 · GIÁO VỤ"
        title="Danh sách đăng ký"
        description={`${term.name} · ${term.program}`}
      />
      <div className="stat-grid">
        <Stat
          label="Tổng đăng ký"
          value={rows.length}
          sub={`${term.studentIds.length} sinh viên trong đợt`}
          icon={<ClipboardList size={18} aria-hidden="true" />}
        />
        <Stat
          label="Đã nộp"
          value={rows.filter((r) => r.status === "SUBMITTED").length}
          icon={<FileCheck2 size={18} aria-hidden="true" />}
        />
        <Stat
          label="Bản nháp"
          value={rows.filter((r) => r.status === "DRAFT").length}
          icon={<FilePenLine size={18} aria-hidden="true" />}
        />
        <Stat
          label="Chưa đăng ký"
          value={
            term.studentIds.filter(
              (id) => !rows.some((r) => r.studentId === id),
            ).length
          }
          icon={<FileClock size={18} aria-hidden="true" />}
        />
      </div>
      <Notice>
        Nguyện vọng không giữ chỗ. Thời điểm nộp do máy chủ ghi nhận; sinh viên
        có thể sửa trong thời gian mở.
      </Notice>
      <Card title="Đăng ký trong đợt">
        <DataTable
          rows={rows}
          columns={[
            {
              key: "col1",
              title: "Sinh viên",
              render: (r) => {
                const s = db.students.find((s) => s.id === r.studentId);
                return <Person name={s?.name || r.studentId} sub={s?.code} />;
              },
            },
            {
              key: "col2",
              title: "Hướng",
              render: (r) =>
                db.catalogs.find((c) => c.id === r.directionId)?.name ||
                "Chưa chọn",
            },
            {
              key: "col3",
              title: "Nguyện vọng",
              render: (r) => (
                <>
                  {r.preferences.map((id, i) => (
                    <div key={id}>
                      NV{i + 1}:{" "}
                      {db.lecturers.find((l) => l.id === id)?.name || id}
                    </div>
                  ))}
                </>
              ),
            },
            {
              key: "col4",
              title: "Trạng thái",
              render: (r) => <Badge value={r.status} />,
            },
            {
              key: "col5",
              title: "Nộp hợp lệ",
              render: (r) => (r.submittedAt ? date(r.submittedAt) : "—"),
            },
          ]}
        />
      </Card>
    </>
  );
}
