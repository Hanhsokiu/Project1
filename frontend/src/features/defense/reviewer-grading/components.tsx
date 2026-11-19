import { useState } from "react";
import { ReviewerGradeCommandSchema } from "@doan/shared";
import type { ReviewerGradeCommand, ReviewerGradeView } from "@doan/shared";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
} from "../../../shared/components/kit";
export const gradeLabels: Record<string, string> = {
  SCORE_PRECISION_UNSUPPORTED:
    "Policy yêu cầu độ chính xác vượt Decimal(4,1); cần review schema, không tự làm tròn",
  RUBRIC_RANGE_UNSUPPORTED:
    "Rubric vượt giới hạn 0–10 của SCORE_DETAIL; cần review schema",
  NONE: "Chưa chấm",
  DRAFT: "Bản nháp",
  FINALIZED: "Đã chốt",
  STALE: "Không còn hiệu lực",
  LEGACY_UNVERIFIED: "Điểm cũ cần đối soát",
  UC22_NOT_ENABLED: "Nhóm chưa bật ghi UC22",
  UC22_POLICY_REQUIRED: "Chưa có chính sách phản biện được duyệt",
  UC22_SCHEMA_REQUIRED: "Cần triển khai schema UC22 đã review",
  UC20_SCHEMA_REQUIRED: "Cần schema phân công phản biện UC20",
  REVIEWER_NOT_CURRENT: "Phân công phản biện không còn hiệu lực",
  FINAL_PDF_REQUIRED: "Chưa có PDF cuối hợp lệ",
  FILE_NOT_AVAILABLE: "Không đọc được PDF trên storage",
  FILE_INTEGRITY_FAILED: "PDF sai checksum",
  GRADE_SOURCE_CHANGED: "Nguồn phiếu đã thay đổi",
  PDF_OR_ASSIGNMENT_CHANGED_REVIEW_REQUIRED:
    "PDF hoặc phân công đã đổi; cần đối soát trước khi đánh giá lại",
  GRADE_FINALIZED_IMMUTABLE:
    "Phiếu đã chốt, chưa có quy trình sửa sau chốt được duyệt",
  UC21_CURRENT_SCHEDULE_REQUIRED:
    "Policy yêu cầu lịch UC21 đã chốt còn hiệu lực",
  UC21_PUBLISHED_REQUIRED: "Policy yêu cầu công bố lịch",
  GRADING_WINDOW_CLOSED: "Ngoài cửa sổ chấm theo lịch",
  RUBRIC_SOURCE_MISMATCH: "Rubric không khớp dữ liệu của đợt",
};
export function ReviewerGradeRows({
  items,
  select,
}: {
  items: ReviewerGradeView[];
  select: (v: ReviewerGradeView) => void;
}) {
  if (!items.length)
    return <Empty title="Không có hồ sơ phản biện trong phạm vi/bộ lọc" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Sinh viên / Đề tài</th>
            <th>GVHD / Hội đồng</th>
            <th>Lịch</th>
            <th>Phiếu</th>
            <th>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={`${v.termStudentId}:${v.reviewerId}`}>
              <td>
                {v.studentCode} · {v.studentName}
                <p>{v.title}</p>
              </td>
              <td>
                {v.advisorName ?? "Chưa xác minh GVHD"}
                <p>{v.committeeId ?? "Chưa xác minh hội đồng"}</p>
              </td>
              <td>
                {v.schedule
                  ? `${v.schedule.date} · ${v.schedule.period}`
                  : "Không yêu cầu lịch hoặc chưa có lịch được phép xem"}
              </td>
              <td>{gradeLabels[v.state]}</td>
              <td>
                <Button variant="secondary" onClick={() => select(v)}>
                  Xem phiếu phản biện
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ReviewerGradeEditor({
  view,
  pending,
  download,
  submit,
}: {
  view: ReviewerGradeView;
  pending: boolean;
  download: () => Promise<void>;
  submit: (action: "save" | "finalize", body: ReviewerGradeCommand) => void;
}) {
  const [score, setScore] = useState(view.score?.totalScore ?? ""),
    [criteria, setCriteria] = useState<Record<string, string>>(
      view.score?.criterionScores ?? {},
    ),
    [feedback, setFeedback] = useState(
      view.feedback ?? {
        comment: "",
        strengths: "",
        weaknesses: "",
        questions: "",
      },
    ),
    [downloaded, setDownloaded] = useState(false),
    [error, setError] = useState(""),
    [downloading, setDownloading] = useState(false);
  const blocked =
    pending || view.blockers.length > 0 || !view.report || !view.assignment;
  const send = (action: "save" | "finalize") => {
    const parsed = ReviewerGradeCommandSchema.safeParse({
      termId: view.termId,
      expectedRevision: view.revision,
      assignmentId: view.assignment?.assignmentId,
      assignmentRevision: view.assignment?.revision,
      assignmentEvidenceHash: view.assignment?.evidenceHash,
      reportVersionId: view.report?.id,
      reportChecksum: view.report?.checksum,
      policyHash: view.policyHash,
      rubricHash: view.rubricHash,
      scheduleHash: view.schedule?.hash ?? null,
      totalScore: score.trim() || null,
      criterionScores: Object.fromEntries(
        Object.entries(criteria).filter(([, v]) => v !== ""),
      ),
      ...feedback,
    });
    if (!parsed.success) {
      setError(
        "Kiểm tra điểm dạng số thập phân và binding hồ sơ; tải lại nếu nguồn đã đổi.",
      );
      return;
    }
    if (!downloaded) {
      setError("Hãy tải đúng PDF hiện hành trước khi lưu/chốt.");
      return;
    }
    setError("");
    submit(action, parsed.data);
  };
  return (
    <Card title={`${view.studentCode} · ${view.studentName}`}>
      <p>{view.title}</p>
      {view.proposalSummary && (
        <details>
          <summary>Đề cương đã chốt</summary>
          {Object.entries({
            "Mục tiêu": view.proposalSummary.objectives,
            "Phạm vi": view.proposalSummary.scope,
            "Nội dung": view.proposalSummary.mainContents,
            "Công cụ": view.proposalSummary.tools,
            "Kết quả dự kiến": view.proposalSummary.expectedResults,
          }).map(([label, text]) => (
            <p key={label}>
              <strong>{label}: </strong>
              {text}
            </p>
          ))}
        </details>
      )}
      <p>
        {gradeLabels[view.state]} · Revision {view.revision}
      </p>
      {view.report ? (
        <p>
          PDF phiên bản {view.report.sequence} · {view.report.name}
        </p>
      ) : (
        <Notice>Chưa có PDF cuối hợp lệ để phản biện.</Notice>
      )}
      <Button
        variant="secondary"
        disabled={!view.permissions.download || downloading || pending}
        onClick={async () => {
          setDownloading(true);
          setError("");
          try {
            await download();
            setDownloaded(true);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Không tải được PDF; tải lại hồ sơ.",
            );
          } finally {
            setDownloading(false);
          }
        }}
      >
        {downloading ? "Đang tải PDF…" : "Tải PDF cuối qua API private"}
      </Button>
      {downloaded && (
        <p>Đã tải PDF phiên bản hiện hành trong phiên làm việc này.</p>
      )}
      {!!view.blockers.length && (
        <Notice>
          {view.blockers.map((x) => gradeLabels[x] ?? x).join("; ")}
        </Notice>
      )}
      <p>
        Policy: {view.policy?.version ?? "Chờ phê duyệt"}. Điểm/nhận xét chưa
        công bố cho sinh viên.
      </p>
      {view.policy?.rubric && (
        <p>
          Rubric: {view.policy.rubric.version}; tổng quy đổi thang 10 chính xác,
          không tự làm tròn.
        </p>
      )}
      {view.permissions.save || view.permissions.finalize ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send("finalize");
          }}
        >
          {view.policy?.rubric?.criteria.map((c) => (
            <Field
              key={c.id}
              label={`${c.name} · trọng số ${c.weight} · tối đa ${c.maxScore} · bước ${c.step}`}
            >
              <input
                inputMode="decimal"
                value={criteria[c.id] ?? ""}
                disabled={blocked}
                onChange={(e) =>
                  setCriteria({ ...criteria, [c.id]: e.target.value })
                }
              />
            </Field>
          ))}
          <Field
            label={`Điểm tổng (0–10); bước ${view.policy?.scoreStep ?? "chờ phê duyệt"}`}
          >
            <input
              inputMode="decimal"
              value={score}
              disabled={blocked}
              onChange={(e) => setScore(e.target.value)}
            />
          </Field>
          {(
            [
              ["comment", "Nhận xét phản biện"],
              ["strengths", "Ưu điểm"],
              ["weaknesses", "Nhược điểm"],
              ["questions", "Câu hỏi phản biện"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={`${label}${view.policy?.requiredFeedback.includes(key) ? " (bắt buộc khi chốt)" : ""}`}
            >
              <textarea
                maxLength={12000}
                value={feedback[key]}
                disabled={blocked}
                onChange={(e) =>
                  setFeedback({ ...feedback, [key]: e.target.value })
                }
              />
            </Field>
          ))}
          {view.policy?.draftAllowed && (
            <Button
              type="button"
              disabled={blocked || !view.permissions.save || !downloaded}
              onClick={() => send("save")}
            >
              Lưu nháp
            </Button>
          )}
          <Button
            type="submit"
            disabled={blocked || !view.permissions.finalize || !downloaded}
          >
            Chốt phiếu phản biện
          </Button>
          {!downloaded && (
            <Notice>
              Tải và đọc PDF hiện hành trước khi lưu/chốt. Mỗi phiếu gắn đúng
              PDF và phân công.
            </Notice>
          )}
          {pending && <Notice>Đang lưu phiếu…</Notice>}
        </form>
      ) : (
        <div>
          {view.score && (
            <p>Điểm phản biện: {view.score.totalScore ?? "Chưa nhập"}</p>
          )}
          {view.feedback && (
            <div>
              {Object.values(view.feedback).map((v, i) => (
                <p key={i}>{v}</p>
              ))}
            </div>
          )}
          <Notice>
            Chế độ theo dõi/đã chốt hoặc chưa có quyền chấm. Nội dung được hiển
            thị theo quyền của tài khoản.
          </Notice>
        </div>
      )}
      {error && <Notice>{error}</Notice>}
      <ul>
        {view.history.map((h, i) => (
          <li key={`${h.revision}:${i}`}>
            Revision {h.revision} · {h.action} · {h.at}
          </li>
        ))}
      </ul>
    </Card>
  );
}
