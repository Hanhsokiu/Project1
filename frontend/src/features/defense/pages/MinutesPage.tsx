import { Eye, Download, Save } from "lucide-react";
import { useState } from "react";
import {
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
import { saveMinutes } from "../services/defense-service";
import { exportPdf } from "../../../shared/services/export-service";
function Content({ db }: { db: DemoDb }) {
  const s = useDefenseScope(db);
  const [selected, setSelected] = useState<Defense>();
  const [minutes, setMinutes] = useState("");
  const [revision, setRevision] = useState("");
  const editable = (d: Defense) =>
    s.faculty ||
    db.committees
      .find((c) => c.id === d.committeeId)
      ?.members.some(
        (m) =>
          m.lecturerId === s.user?.lecturerId &&
          ["CHAIR", "SECRETARY"].includes(m.role),
      );
  const pdf = (d: Defense) =>
    exportPdf("BIÊN BẢN BẢO VỆ ĐỒ ÁN TỐT NGHIỆP", [
      `Đợt: ${s.term.name}`,
      `Sinh viên: ${s.name(d.studentId)} · ${db.students.find((x) => x.id === d.studentId)?.code}`,
      `Đề tài: ${db.topics.find((t) => t.termId === s.term.id && t.studentId === d.studentId)?.title ?? ""}`,
      `Hội đồng: ${s.committeeName(d)}`,
      `Thời gian: ${date(d.date)} ${d.start}–${d.end}; phòng ${d.room}`,
      ...(db.committees
        .find((c) => c.id === d.committeeId)
        ?.members.map((m) => `${m.role}: ${s.lecturer(m.lecturerId)}`) ?? []),
      `Phản biện: ${s.lecturer(d.reviewerId)}`,
      "NỘI DUNG VÀ KẾT LUẬN",
      d.minutes || "Chưa lập biên bản",
      `Yêu cầu chỉnh sửa: ${d.revision || "Không"}`,
      "CHỦ TỊCH HỘI ĐỒNG                         THƯ KÝ",
      "(Ký và ghi rõ họ tên)                         (Ký và ghi rõ họ tên)",
    ]);
  return (
    <>
      <PageHeader
        title="Biên bản bảo vệ"
        description="Ghi diễn biến, câu hỏi, kết luận và các yêu cầu chỉnh sửa sau buổi bảo vệ."
      />
      <Notice>
        Giáo vụ, chủ tịch và thư ký được cập nhật biên bản. Thành viên liên quan
        được xem hồ sơ; biên bản đã công bố kết quả chỉ có thể đọc và xuất.
      </Notice>
      <Card title="Hồ sơ phiên bảo vệ">
        <DataTable
          rows={s.defenses.filter((d) => d.date)}
          searchText={(d) => `${s.name(d.studentId)} ${s.committeeName(d)}`}
          columns={[
            {
              key: "student",
              title: "Sinh viên",
              render: (d) => s.name(d.studentId),
            },
            {
              key: "session",
              title: "Phiên bảo vệ",
              render: (d) => (
                <div>
                  {date(d.date)} · {d.start}
                  <small className="block muted">{s.committeeName(d)}</small>
                </div>
              ),
            },
            {
              key: "minutes",
              title: "Biên bản",
              render: (d) => (d.minutes ? "Đã lập" : "Chưa lập"),
            },
            {
              key: "revision",
              title: "Yêu cầu chỉnh sửa",
              render: (d) => d.revision || "—",
            },
            {
              key: "action",
              title: "",
              render: (d) => (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelected(d);
                      setMinutes(d.minutes);
                      setRevision(d.revision);
                    }}
                  >
                    <Eye size={16} aria-hidden="true" />
                    Xem / cập nhật
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => s.exec(() => pdf(d))}
                  >
                    <Download size={16} aria-hidden="true" />
                    PDF
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {selected && (
        <Modal
          title={`Biên bản · ${s.name(selected.studentId)}`}
          onClose={() => setSelected(undefined)}
          wide
        >
          <Field label="Diễn biến, câu hỏi trao đổi và kết luận">
            <textarea
              rows={8}
              value={minutes}
              disabled={!editable(selected) || s.term.resultsPublished}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
          <Field label="Yêu cầu chỉnh sửa sau bảo vệ">
            <textarea
              rows={3}
              value={revision}
              disabled={!editable(selected) || s.term.resultsPublished}
              onChange={(e) => setRevision(e.target.value)}
            />
          </Field>
          <div className="dialog-actions">
            <Button
              variant="secondary"
              onClick={() =>
                s.exec(() => pdf({ ...selected, minutes, revision }))
              }
            >
              <Download size={16} aria-hidden="true" />
              Xuất PDF xem trước
            </Button>
            {editable(selected) && !s.term.resultsPublished && (
              <Button
                disabled={s.pending}
                onClick={() =>
                  s.exec(() => {
                    saveMinutes(selected.id, minutes, revision);
                    setSelected(undefined);
                  })
                }
              >
                <Save size={16} aria-hidden="true" />
                Lưu biên bản
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
export default function MinutesPage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
