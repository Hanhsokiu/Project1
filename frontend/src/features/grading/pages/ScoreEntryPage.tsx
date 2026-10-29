import { Save, Send, Eye, Pencil } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  DataBoundary,
  DataTable,
  Empty,
  Field,
  FileLink,
  Modal,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import type { DemoDb } from "../../../shared/data/types";
import { useDefenseScope } from "../../defense/components/DefenseScope";
import {
  canScore,
  rubricKey,
  saveScore,
  type ScoreKind,
} from "../services/grading-service";
const roleNames: Record<ScoreKind, string> = {
  ADVISOR: "Điểm hướng dẫn",
  REVIEWER: "Điểm phản biện",
  COMMITTEE: "Điểm hội đồng",
};
function ScoreForm({
  db,
  studentId,
  kind,
  onClose,
}: {
  db: DemoDb;
  studentId: string;
  kind: ScoreKind;
  onClose: () => void;
}) {
  const s = useDefenseScope(db);
  const score = db.scores.find(
    (x) =>
      x.termId === s.term.id &&
      x.studentId === studentId &&
      x.lecturerId === s.user?.lecturerId &&
      x.kind === kind,
  );
  const criteria = db.rubrics[rubricKey(kind)];
  const [values, setValues] = useState<Record<string, number>>(
    score?.values ?? {},
  );
  const [comment, setComment] = useState(score?.comment ?? "");
  const [questions, setQuestions] = useState(score?.questions.join("\n") ?? "");
  const [confirm, setConfirm] = useState(false);
  const locked =
    score?.status === "SUBMITTED" ||
    score?.status === "LOCKED" ||
    s.term.resultsPublished ||
    s.term.locked;
  const total = Object.values(values).reduce((sum, n) => sum + n, 0);
  const final = db.finals.find(
    (f) => f.termId === s.term.id && f.studentId === studentId,
  );
  const topic = db.topics.find(
    (t) => t.termId === s.term.id && t.studentId === studentId,
  );
  const save = (submit: boolean) =>
    s.exec(() => {
      saveScore({
        termId: s.term.id,
        studentId,
        kind,
        values,
        comment,
        questions: questions.split("\n"),
        submit,
      });
      onClose();
    });
  return (
    <Modal
      title={`${roleNames[kind]} · ${s.name(studentId)}`}
      onClose={onClose}
      wide
    >
      <div className="mb-4">
        <strong>{topic?.title ?? "Chưa có đề tài"}</strong>
        <div className="flex gap-3 mt-3">
          {final ? (
            <FileLink file={final.file} />
          ) : (
            <span className="muted">Chưa có báo cáo final</span>
          )}
          {score && <Badge value={score.status} />}
        </div>
      </div>
      {criteria.map((c) => (
        <div
          className="flex items-center justify-between gap-4 border-b py-3"
          key={c.id}
        >
          <label htmlFor={`score-${c.id}`}>
            {c.name}
            <small className="block muted">Tối đa {c.max} điểm</small>
          </label>
          <input
            id={`score-${c.id}`}
            className="max-w-28"
            type="number"
            min={0}
            max={c.max}
            step={0.1}
            disabled={locked}
            value={values[c.id] ?? ""}
            onChange={(e) =>
              setValues((v) => {
                const next = { ...v };
                if (e.target.value === "") delete next[c.id];
                else next[c.id] = Number(e.target.value);
                return next;
              })
            }
          />
        </div>
      ))}
      <div className="flex justify-between py-4 text-lg font-bold">
        <span>Tổng điểm</span>
        <span>{total.toFixed(2)} / 10</span>
      </div>
      <Field label="Nhận xét và đánh giá">
        <textarea
          rows={4}
          disabled={locked}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Đánh giá nội dung, sản phẩm, tính thực tiễn và hạn chế..."
        />
      </Field>
      {kind === "REVIEWER" && (
        <Field
          label="Câu hỏi phản biện"
          hint="Tối thiểu 2 câu hỏi; mỗi câu trên một dòng."
        >
          <textarea
            rows={4}
            disabled={locked}
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
          />
        </Field>
      )}
      {locked ? (
        <Notice>
          Phiếu đã gửi/chốt hoặc kết quả đã công bố. Nội dung chỉ đọc.
        </Notice>
      ) : (
        <>
          {confirm && (
            <Notice tone="warning">
              Gửi phiếu sẽ khóa chỉnh sửa của giảng viên. Hãy kiểm tra điểm,
              nhận xét và câu hỏi trước khi xác nhận.
            </Notice>
          )}
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={s.pending}
              onClick={() => save(false)}
            >
              <Save size={16} aria-hidden="true" />
              Lưu nháp
            </Button>
            <Button
              disabled={s.pending}
              onClick={() => (confirm ? save(true) : setConfirm(true))}
            >
              <Send size={16} aria-hidden="true" />
              {confirm ? "Xác nhận gửi điểm" : "Gửi phiếu điểm"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
function Content({ db }: { db: DemoDb }) {
  const s = useDefenseScope(db);
  const [kind, setKind] = useState<ScoreKind>("ADVISOR");
  const [student, setStudent] = useState("");
  const rows = s.term.studentIds
    .filter((id) => canScore(db, s.user, s.term.id, id, kind))
    .map((id) => ({
      id,
      score: db.scores.find(
        (x) =>
          x.termId === s.term.id &&
          x.studentId === id &&
          x.kind === kind &&
          x.lecturerId === s.user?.lecturerId,
      ),
    }));
  return (
    <>
      <PageHeader
        title="Nhận xét và nhập điểm"
        description="Một giảng viên có thể đồng thời hướng dẫn, phản biện và chấm hội đồng ở các hồ sơ khác nhau."
        actions={
          <Link className="btn btn-secondary" to="/grading/rubric">
            <Eye size={16} aria-hidden="true" />
            Xem Rubric
          </Link>
        }
      />
      <div className="tabs mb-5">
        {(Object.keys(roleNames) as ScoreKind[]).map((k) => (
          <Button
            key={k}
            variant={kind === k ? "primary" : "secondary"}
            onClick={() => setKind(k)}
          >
            {roleNames[k]}
          </Button>
        ))}
      </div>
      <Notice>
        Chỉ hồ sơ được phân công cho tài khoản đang đăng nhập xuất hiện ở đây.
        Điểm nháp chưa được tổng hợp; điểm đã gửi cần Khoa chốt trước khi công
        bố.
      </Notice>
      <Card title={`${roleNames[kind]} · ${s.term.name}`}>
        {!s.user?.lecturerId ? (
          <Empty
            title="Tài khoản này không có nhiệm vụ chấm điểm"
            description="Sử dụng tài khoản giảng viên được phân công để nhập phiếu điểm."
          />
        ) : (
          <DataTable
            rows={rows}
            searchText={(r) =>
              `${s.name(r.id)} ${db.topics.find((t) => t.termId === s.term.id && t.studentId === r.id)?.title ?? ""}`
            }
            columns={[
              {
                key: "student",
                title: "Sinh viên",
                render: (r) => s.name(r.id),
              },
              {
                key: "topic",
                title: "Đề tài",
                render: (r) =>
                  db.topics.find(
                    (t) => t.termId === s.term.id && t.studentId === r.id,
                  )?.title ?? "—",
              },
              {
                key: "status",
                title: "Phiếu điểm",
                render: (r) =>
                  r.score ? (
                    <Badge value={r.score.status} />
                  ) : (
                    <Badge>Chưa nhập</Badge>
                  ),
              },
              {
                key: "total",
                title: "Điểm / 10",
                render: (r) => r.score?.total.toFixed(2) ?? "—",
              },
              {
                key: "action",
                title: "",
                render: (r) => (
                  <Button variant="secondary" onClick={() => setStudent(r.id)}>
                    <Pencil size={16} aria-hidden="true" />
                    {r.score?.status === "SUBMITTED" ||
                    r.score?.status === "LOCKED"
                      ? "Xem phiếu"
                      : "Nhập điểm"}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>
      {student && (
        <ScoreForm
          key={`${s.term.id}-${kind}-${student}`}
          db={db}
          studentId={student}
          kind={kind}
          onClose={() => setStudent("")}
        />
      )}
    </>
  );
}
export default function ScoreEntryPage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
