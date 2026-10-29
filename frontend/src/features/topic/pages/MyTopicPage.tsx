import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  CheckCheck,
  Download,
  Eye,
  FilePenLine,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  Empty,
  Modal,
  Notice,
  PageHeader,
  Person,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { scopedStudentIds } from "../../../shared/data/access";
import type { Topic } from "../../../shared/data/types";
import { topicService } from "../services/topic-service";
import {
  exportPdf,
  exportProposalPdf,
} from "../../../shared/services/export-service";
import {
  ProposalDocument,
  proposalLines,
} from "../components/ProposalDocument";
export default function MyTopicPage() {
  const { db, user, termId, term } = useWorkspace();
  const action = useAction();
  const ids = scopedStudentIds(db, user, termId);
  const topics = db.topics.filter(
    (t) => t.termId === termId && ids.includes(t.studentId),
  );
  const [preview, setPreview] = useState<Topic | null>(null);
  const [agree, setAgree] = useState<Topic | null>(null);
  const [degree, setDegree] = useState("Cử nhân");
  const [filter, setFilter] = useState("");
  const own = topics.find((t) => t.studentId === user.studentId);
  return (
    <>
      <PageHeader
        eyebrow="BƯỚC 03 · ĐỀ TÀI & ĐỀ CƯƠNG"
        title={user.studentId ? "Đề tài đồ án của tôi" : "Đề tài & đề cương"}
        description="Sau công bố phân công, SV gặp GVHD thống nhất đề tài, lập đề cương và xuất theo biểu mẫu."
        actions={
          user.studentId ? (
            <Link
              className="btn btn-primary"
              to={
                own?.workflowReady
                  ? `/topic/proposal/${own.id}`
                  : "/topic/draft"
              }
            >
              <FilePenLine size={16} />
              {own ? "Mở đề cương" : "Tạo đề cương"}
            </Link>
          ) : user.lecturerId ? (
            <div className="actions">
              {db.assignments
                .filter(
                  (a) =>
                    a.termId === termId &&
                    a.lecturerId === user.lecturerId &&
                    a.published &&
                    !topics.some((t) => t.studentId === a.studentId),
                )
                .map((a) => (
                  <Link
                    key={a.id}
                    className="btn btn-secondary"
                    to={`/topic/draft?student=${a.studentId}`}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Tạo đề tài ·{" "}
                    {db.students.find((s) => s.id === a.studentId)?.code}
                  </Link>
                ))}
            </div>
          ) : null
        }
      />
      <div className="mb-6">
        <Notice>
          GVHD xác nhận thống nhất tên đề tài ở Bước 3. Việc nhóm giảng
          viên/Khoa duyệt đề cương thuộc quy trình sau đó.
        </Notice>
      </div>
      {!topics.length ? (
        <Card>
          <Empty
            title="Chưa có hồ sơ đề tài"
            description={
              term.assignmentPublished
                ? "Sinh viên có thể bắt đầu nhập tên đề tài và lưu nháp sau khi gặp GVHD."
                : "Đợi Khoa công bố phân công GVHD trước khi lập đề tài."
            }
            action={
              user.studentId && term.assignmentPublished ? (
                <Link className="btn btn-primary" to="/topic/draft">
                  <FilePenLine size={16} aria-hidden="true" />
                  Bắt đầu lập đề cương
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card title="Danh sách đề tài trong đợt">
          <DataTable
            rows={topics.filter(
              (t) =>
                !filter ||
                (filter === "agreed" ? t.advisorAgreed : !t.advisorAgreed),
            )}
            searchText={(t) =>
              `${t.title} ${db.students.find((s) => s.id === t.studentId)?.name} ${db.students.find((s) => s.id === t.studentId)?.code}`
            }
            filters={
              <select
                aria-label="Lọc thống nhất đề tài"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Tất cả xác nhận GVHD</option>
                <option value="agreed">Đã thống nhất</option>
                <option value="waiting">Chưa thống nhất</option>
              </select>
            }
            columns={[
              {
                key: "student",
                title: "Sinh viên",
                render: (t) => {
                  const s = db.students.find((s) => s.id === t.studentId);
                  return <Person name={s?.name || "—"} sub={s?.code} />;
                },
              },
              {
                key: "topic",
                title: "Đề tài",
                render: (t) => (
                  <div className="text-wrap">
                    <strong>{t.title}</strong>
                    <p className="muted text-xs mt-1">
                      {db.lecturers.find((l) => l.id === t.lecturerId)?.name}
                    </p>
                  </div>
                ),
              },
              {
                key: "agreement",
                title: "GVHD thống nhất",
                render: (t) => (
                  <Badge value={t.advisorAgreed ? "APPROVED" : "PENDING"}>
                    {t.advisorAgreed ? "Đã thống nhất" : "Chờ thống nhất"}
                  </Badge>
                ),
              },
              {
                key: "status",
                title: "Đề cương",
                render: (t) => <Badge value={t.status} />,
              },
              {
                key: "actions",
                title: "Thao tác",
                render: (t) => (
                  <div className="actions">
                    {user.lecturerId === t.lecturerId && (
                      <Link
                        className="btn btn-secondary"
                        to={
                          t.workflowReady
                            ? `/topic/proposal/${t.id}`
                            : `/topic/draft?student=${t.studentId}`
                        }
                      >
                        <Pencil size={16} aria-hidden="true" />
                        Chỉnh sửa đề tài
                      </Link>
                    )}
                    <button
                      className="icon-btn"
                      title="Xem đề cương"
                      aria-label={`Xem đề cương ${db.students.find((s) => s.id === t.studentId)?.code}`}
                      onClick={() => setPreview(t)}
                    >
                      <Eye size={17} />
                    </button>
                    {user.lecturerId === t.lecturerId && !t.advisorAgreed && (
                      <Button
                        variant="secondary"
                        disabled={term.locked}
                        onClick={() => setAgree(t)}
                      >
                        <CheckCheck size={16} aria-hidden="true" />
                        Thống nhất đề tài
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}
      {preview && (
        <Modal title="Xem trước đề cương" wide onClose={() => setPreview(null)}>
          <div className="actions justify-end mb-5">
            <select
              style={{ width: 160 }}
              aria-label="Loại biểu mẫu đề cương"
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
            >
              <option>Cử nhân</option>
              <option>Kỹ sư</option>
            </select>
            <Button
              disabled={action.pending}
              onClick={() =>
                action
                  .run(() =>
                    exportProposalPdf(preview, degree, () =>
                      exportPdf(
                        "Đề cương đồ án tốt nghiệp",
                        proposalLines(db, preview, degree),
                        `de-cuong-${db.students.find((s) => s.id === preview.studentId)?.code}.pdf`,
                      ),
                    ),
                  )
                  .catch(() => {})
              }
            >
              <Download size={15} />
              Tải PDF
            </Button>
          </div>
          <ProposalDocument db={db} topic={preview} degree={degree} />
        </Modal>
      )}
      {agree && (
        <Confirm
          title="Thống nhất đề tài với sinh viên?"
          description={`${agree.title}. Xác nhận này cho phép SV nộp đề cương. Nhóm/Khoa xét duyệt ở bước tiếp theo.`}
          onClose={() => setAgree(null)}
          onConfirm={async () => {
            try {
              await action.run(() => topicService.agree(agree.id, true));
              setAgree(null);
            } catch {
              // useAction displays the failure; keep the current form available for correction.
            }
          }}
          pending={action.pending}
        />
      )}
    </>
  );
}
