import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FilePenLine,
  ArrowRight,
  Download,
  Eye,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import {
  Back,
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  Empty,
  Field,
  Modal,
  Notice,
  PageHeader,
  date,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import type { Topic, ProposalVersion } from "../../../shared/data/types";
import { topicService } from "../services/topic-service";
import { topicApi } from "../services/topic-api";
import {
  exportPdf,
  exportProposalPdf,
} from "../../../shared/services/export-service";
import { STEP3_API } from "../../registration/services/assignment-api";
import {
  ProposalDocument,
  proposalLines,
} from "../components/ProposalDocument";
export default function ProposalEditorPage() {
  const { termId, user } = useWorkspace();
  const [params] = useSearchParams();
  const studentId = user.studentId ?? params.get("student") ?? "";
  return (
    <ProposalEditor key={`${termId}:${studentId}`} studentId={studentId} />
  );
}
function ProposalEditor({ studentId }: { studentId: string }) {
  const navigate = useNavigate();
  const [handoff, setHandoff] = useState(false);
  const { db, user, termId, term } = useWorkspace();
  const action = useAction();
  const topic = db.topics.find(
    (t) => t.termId === termId && t.studentId === studentId,
  );
  const assignment = db.assignments.find(
    (a) => a.termId === termId && a.studentId === studentId && a.published,
  );
  const [form, setForm] = useState({
    title: topic?.title || "",
    objectives: topic?.objectives || "",
    scope: topic?.scope || "",
    technology: topic?.technology || "",
    expected: topic?.expected || "",
    plan: topic?.plan || [{ week: "1–3", content: "" }],
  });
  const [preview, setPreview] = useState(false);
  const [version, setVersion] = useState<ProposalVersion | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [degree, setDegree] = useState("Cử nhân");
  const [message, setMessage] = useState("");
  const [baseVersion, setBaseVersion] = useState(
    topic?.versions.slice(-1)[0]?.version ?? 0,
  );
  const readonly =
    !!topic?.workflowReady ||
    term.locked ||
    (!!topic &&
      ![
        "DRAFT",
        "REVISION",
        "REJECTED",
        ...(STEP3_API ? ["SUBMITTED"] : []),
      ].includes(topic.status));
  const display: Topic = {
    id: topic?.id || "preview",
    termId,
    studentId,
    lecturerId: assignment?.lecturerId || "",
    directionId: topic?.directionId || "",
    advisorAgreed: topic?.advisorAgreed || false,
    status: topic?.status || "DRAFT",
    versions: topic?.versions || [],
    groupId: topic?.groupId || "",
    comment: topic?.comment || "",
    ...form,
  };
  async function save(submit: boolean) {
    setMessage("");
    try {
      const saved = (await action.run(() =>
        topicService.save(termId, form, submit, studentId, baseVersion),
      )) as Topic | undefined;
      if (saved?.versions)
        setBaseVersion(saved.versions.slice(-1)[0]?.version ?? 0);
      setConfirm(false);
      setMessage(
        submit
          ? "Đề cương đã được nộp. Nội dung và phiên bản được giữ để bàn giao quy trình xét duyệt tiếp theo."
          : "Đã lưu nháp. Nếu thay đổi nội dung, cần GVHD thống nhất lại.",
      );
    } catch {
      setConfirm(false);
    }
  }
  if (!assignment)
    return (
      <>
        <PageHeader title="Lập đề cương" />
        <Card>
          <Empty
            title="Chưa có phân công được công bố"
            description="Đề cương được tạo sau khi Khoa công bố phân công GVHD."
            action={
              <Link className="btn btn-primary" to="/registration/result">
                <Eye size={16} aria-hidden="true" />
                Xem kết quả phân công
              </Link>
            }
          />
        </Card>
      </>
    );
  return (
    <>
      <Back to="/topic/my" />
      <PageHeader
        eyebrow="BƯỚC 03 · LẬP ĐỀ CƯƠNG"
        title="Đề cương đồ án tốt nghiệp"
        description="Một sinh viên · Một đề tài · Phiên bản đề cương theo từng đợt."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPreview(true)}>
              <Eye size={15} />
              Xem trước
            </Button>
            <Badge value={topic?.status || "DRAFT"} />
            {STEP3_API &&
              topic &&
              (topic.workflowReady ? (
                <Link
                  className="btn btn-primary"
                  to={`/topic/proposal/${topic.id}`}
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Mở đề cương & phiên bản
                </Link>
              ) : (
                <Button
                  disabled={action.pending}
                  onClick={() => setHandoff(true)}
                >
                  <ArrowRight size={16} aria-hidden="true" />
                  Chuyển sang xét duyệt & phiên bản
                </Button>
              ))}
          </>
        }
      />
      <div className="mb-6">
        {topic?.status === "SUBMITTED" && STEP3_API && (
          <Notice tone="warning">
            Lưu thay đổi sẽ chuyển hồ sơ đang chờ duyệt về nháp và tạo phiên bản
            mới. Phiên bản đã nộp được giữ nguyên; cần thống nhất và nộp lại.
          </Notice>
        )}
        <Notice tone={topic?.advisorAgreed ? "success" : "warning"}>
          {topic?.advisorAgreed
            ? "GVHD đã thống nhất đề tài. Bạn có thể hoàn thiện nội dung và nộp đề cương."
            : "Lưu nháp tên đề tài trước, sau đó GVHD xác nhận thống nhất tại trang Đề tài & đề cương. Bạn chỉ nộp được khi đã có xác nhận."}
          {readonly &&
            " Hồ sơ hiện chỉ xem vì đã nộp/được duyệt/chốt hoặc đợt đã khóa."}
        </Notice>
      </div>
      {message && (
        <div className="mb-5">
          <Notice tone="success">{message}</Notice>
        </div>
      )}
      {topic?.comment && (
        <div className="mb-5">
          <Notice tone="warning">Góp ý nhận được: {topic.comment}</Notice>
        </div>
      )}
      <div className="section-grid">
        <div className="stack">
          <Card title="Nội dung đề cương">
            <fieldset disabled={readonly || action.pending}>
              <div className="stack">
                {(
                  [
                    ["title", "Tên đề tài *"],
                    ["objectives", "Mục tiêu *"],
                    ["scope", "Nội dung và phạm vi *"],
                    ["technology", "Công nghệ, công cụ, ngôn ngữ *"],
                    ["expected", "Kết quả dự kiến *"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    {key === "title" || key === "technology" ? (
                      <input
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                        placeholder={
                          key === "title"
                            ? "Tên đề tài đã trao đổi với GVHD"
                            : "Ví dụ: React, NestJS, PostgreSQL"
                        }
                      />
                    ) : (
                      <textarea
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>
          </Card>
          <Card
            title="Bảng kế hoạch thực hiện"
            action={
              <Button
                variant="secondary"
                disabled={readonly}
                onClick={() =>
                  setForm({
                    ...form,
                    plan: [...form.plan, { week: "", content: "" }],
                  })
                }
              >
                <Plus size={15} />
                Thêm mốc
              </Button>
            }
          >
            <div className="stack">
              {form.plan.map((p, i) => (
                <div key={i} className="plan-row">
                  <Field label={`Thời gian (tuần) ${i + 1}`}>
                    <input
                      value={p.week}
                      disabled={readonly}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          plan: form.plan.map((x, n) =>
                            n === i ? { ...x, week: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Công việc">
                    <input
                      value={p.content}
                      disabled={readonly}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          plan: form.plan.map((x, n) =>
                            n === i ? { ...x, content: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </Field>
                  <button
                    aria-label={`Xóa mốc ${i + 1}`}
                    className="icon-btn self-end mb-1"
                    disabled={readonly || form.plan.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        plan: form.plan.filter((_, n) => n !== i),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <Button
                variant="secondary"
                disabled={readonly || action.pending}
                onClick={() => save(false)}
              >
                <Save size={15} />
                Lưu nháp
              </Button>
              <Button
                disabled={
                  readonly ||
                  action.pending ||
                  !topic?.advisorAgreed ||
                  !user.studentId
                }
                onClick={() => setConfirm(true)}
              >
                <Send size={15} />
                Nộp đề cương
              </Button>
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Hồ sơ sinh viên">
            <dl className="info-grid">
              <div className="col-span-2">
                <dt>Sinh viên</dt>
                <dd>
                  {db.students.find((s) => s.id === studentId)?.name} ·{" "}
                  {db.students.find((s) => s.id === studentId)?.code}
                </dd>
              </div>
              <div className="col-span-2">
                <dt>Giảng viên hướng dẫn</dt>
                <dd>
                  {
                    db.lecturers.find((l) => l.id === assignment.lecturerId)
                      ?.name
                  }
                </dd>
              </div>
              <div>
                <dt>Đợt đồ án</dt>
                <dd>{term.code}</dd>
              </div>
              <div>
                <dt>Hệ đào tạo</dt>
                <dd>{term.program}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Xuất biểu mẫu">
            <div className="stack">
              <Field label="Mẫu đề cương">
                <select
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                >
                  <option>Cử nhân</option>
                  <option>Kỹ sư</option>
                </select>
              </Field>
              <Button
                variant="secondary"
                disabled={action.pending}
                onClick={() =>
                  action
                    .run(() =>
                      exportProposalPdf(topic ?? display, degree, () =>
                        exportPdf(
                          "Đề cương đồ án tốt nghiệp",
                          proposalLines(db, display, degree),
                          `de-cuong-${db.students.find((s) => s.id === user.studentId)?.code}.pdf`,
                        ),
                      ),
                    )
                    .catch(() => {})
                }
              >
                <Download size={15} />
                Tải biểu mẫu PDF
              </Button>
              <p className="muted text-xs leading-6">
                PDF được xuất từ phiên bản đã lưu trên máy chủ. Thay đổi chưa
                lưu trong biểu mẫu không được đưa vào PDF.
              </p>
            </div>
          </Card>
          <Card title={`Lịch sử phiên bản (${topic?.versions.length || 0})`}>
            <DataTable
              rows={topic?.versions || []}
              pageSize={4}
              columns={[
                {
                  key: "version",
                  title: "Phiên bản",
                  render: (v) => (
                    <button
                      className="link-button"
                      onClick={() => setVersion(v)}
                    >
                      Phiên bản {v.version}
                    </button>
                  ),
                },
                { key: "date", title: "Ngày nộp", render: (v) => date(v.at) },
              ]}
            />
          </Card>
        </div>
      </div>
      {preview && (
        <Modal
          title="Xem trước biểu mẫu"
          wide
          onClose={() => setPreview(false)}
        >
          <ProposalDocument db={db} topic={display} degree={degree} />
        </Modal>
      )}
      {version && (
        <Modal
          title={`Phiên bản ${version.version} · ${date(version.at)}`}
          wide
          onClose={() => setVersion(null)}
        >
          <ProposalDocument
            db={db}
            topic={{
              ...display,
              ...version,
              status: version.status as Topic["status"],
            }}
            degree={degree}
          />
          {version.comment && <Notice>{version.comment}</Notice>}
          {STEP3_API && topic && (
            <Button
              onClick={() =>
                action
                  .run(() =>
                    exportProposalPdf(
                      topic,
                      degree,
                      async () => {},
                      version.version,
                    ),
                  )
                  .catch(() => {})
              }
            >
              <Download size={16} aria-hidden="true" />
              Tải PDF phiên bản {version.version}
            </Button>
          )}
        </Modal>
      )}
      {handoff && topic && (
        <Confirm
          title="Chuyển sang quản lý phiên bản?"
          description="Cần chốt phân công chính thức trước. Hệ thống giữ nguyên các phiên bản bước 3 và tạo bản nháp mới. Bạn cần bổ sung nội dung, thời gian và mốc thực hiện trước khi nộp xét duyệt."
          pending={action.pending}
          onClose={() => setHandoff(false)}
          onConfirm={async () => {
            const result = await action.run(() =>
              topicApi.prepareWorkflow(topic.id),
            );
            if (result) navigate(`/topic/proposal/${topic.id}`);
          }}
        />
      )}
      {confirm && (
        <Confirm
          title="Nộp đề cương?"
          description="Hệ thống lưu một phiên bản mới và khóa chỉnh sửa bản đã nộp. Quy trình nhóm/Khoa duyệt thuộc bước tiếp theo."
          onClose={() => setConfirm(false)}
          onConfirm={() => save(true)}
          pending={action.pending}
        />
      )}
    </>
  );
}
