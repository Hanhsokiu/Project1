import { useState } from "react";
import { Download } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  PageHeader,
  date,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { scopedStudentIds } from "../../../shared/data/access";
import {
  exportPdf,
  exportProposalPdf,
} from "../../../shared/services/export-service";
import {
  ProposalDocument,
  proposalLines,
} from "../components/ProposalDocument";
export default function DossierPage() {
  const { db, user, termId } = useWorkspace();
  const action = useAction();
  const ids = scopedStudentIds(db, user, termId);
  const topics = db.topics.filter(
    (t) => t.termId === termId && ids.includes(t.studentId),
  );
  const [selected, setSelected] = useState(topics[0]?.id || "");
  const [degree, setDegree] = useState("Cử nhân");
  const topic = topics.find((t) => t.id === selected) || topics[0];
  return (
    <>
      <PageHeader
        eyebrow="BƯỚC 03 · HỒ SƠ ĐỀ TÀI"
        title="Hồ sơ & biểu mẫu đề cương"
        description="Bản đề cương dùng để in, xin chữ ký và bàn giao quy trình xét duyệt tiếp theo."
        actions={
          topic && (
            <Button
              disabled={action.pending}
              onClick={() =>
                action
                  .run(() =>
                    exportProposalPdf(topic, degree, () =>
                      exportPdf(
                        "Hồ sơ đề cương",
                        proposalLines(db, topic, degree),
                        `ho-so-${db.students.find((s) => s.id === topic.studentId)?.code}.pdf`,
                      ),
                    ),
                  )
                  .catch(() => {})
              }
            >
              <Download size={16} />
              Tải PDF
            </Button>
          )
        }
      />
      {!topic ? (
        <Card>
          <Empty title="Chưa có hồ sơ đề cương trong phạm vi của bạn" />
        </Card>
      ) : (
        <div className="stack">
          <Card>
            <div className="form-grid">
              <Field label="Hồ sơ sinh viên">
                <select
                  value={topic.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {db.students.find((s) => s.id === t.studentId)?.name} ·{" "}
                      {db.students.find((s) => s.id === t.studentId)?.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Loại biểu mẫu">
                <select
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                >
                  <option>Cử nhân</option>
                  <option>Kỹ sư</option>
                </select>
              </Field>
            </div>
            <div className="actions mt-5">
              <Badge value={topic.status} />
              <Badge value={topic.advisorAgreed ? "APPROVED" : "PENDING"}>
                {topic.advisorAgreed
                  ? "GVHD đã thống nhất"
                  : "GVHD chưa thống nhất"}
              </Badge>
              <span className="muted text-xs">
                {topic.versions.length} phiên bản · Nộp gần nhất{" "}
                {topic.versions.length
                  ? date(topic.versions[topic.versions.length - 1].at)
                  : "chưa nộp"}
              </span>
            </div>
          </Card>
          <ProposalDocument db={db} topic={topic} degree={degree} />
        </div>
      )}
    </>
  );
}
