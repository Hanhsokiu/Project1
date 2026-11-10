import { useState } from "react";
import {
  CommitteeGradeCommandSchema,
  committeeRubricTotal,
} from "@doan/shared";
import type {
  CommitteeGradeCommand,
  CommitteeGradeView,
  CommitteeGradeProgress,
} from "@doan/shared";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
} from "../../../shared/components/kit";
import { gradeLabels } from "../reviewer-grading/components";
export const committeeGradeLabels: Record<string, string> = {
  UC23_POLICY_NOT_EFFECTIVE:
    "Ngoài thời gian áp dụng chính sách chấm; phiếu đã chốt hợp lệ vẫn được lưu giữ",
  ...gradeLabels,
  CHAIR: "Chủ tịch",
  SECRETARY: "Thư ký",
  MEMBER: "Ủy viên",
  UC23_NOT_ENABLED: "Nhóm chưa bật ghi UC23",
  UC23_POLICY_REQUIRED:
    "Chưa có chính sách/rubric hội đồng được duyệt và còn hiệu lực",
  UC23_SCHEMA_REQUIRED: "Cần schema UC23 đã review",
  UC19_SCHEMA_REQUIRED: "Cần schema hội đồng UC19",
  COMMITTEE_NOT_CURRENT:
    "Hội đồng hoặc phân sinh viên chưa chốt/không còn hiệu lực",
  MEMBER_ROLE_NOT_AUTHORIZED: "Policy chưa cho vai trò này chấm",
  DUAL_REVIEWER_ROLE_UNVERIFIED:
    "Kiêm nhiệm phản biện/hội đồng chưa có phân công và policy UC20 hợp lệ",
  DEFENSE_PERFORMANCE_PRODUCER_REQUIRED:
    "Chưa có nguồn chính thức xác nhận đã bảo vệ; chưa được chốt phiếu",
  GRADE_SOURCE_CHANGED: "Hội đồng, lịch, PDF hoặc rubric đã đổi; cần đối soát",
  LEGACY_SCORE_RECONCILIATION_REQUIRED:
    "Phiếu cũ cần đối soát, không tự chuyển hoặc ghi đè",
  DEFENSE_PHASE_REQUIRED: "Cần giai đoạn bảo vệ đang mở",
};
export function CommitteeGradeRows({
  items,
  select,
}: {
  items: CommitteeGradeView[];
  select: (v: CommitteeGradeView) => void;
}) {
  if (!items.length)
    return <Empty title="Không có hồ sơ hội đồng trong phạm vi/bộ lọc" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Hội đồng / Vai trò</th>
            <th>Sinh viên / Đề tài</th>
            <th>Lịch / Thứ tự</th>
            <th>Trạng thái phiếu</th>
            <th>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={`${v.committeeId}:${v.termStudentId}:${v.lecturerId}`}>
              <td>
                {v.committeeCode}
                <p>
                  {v.lecturerName} · {committeeGradeLabels[v.memberRole]}
                </p>
              </td>
              <td>
                {v.studentCode} · {v.studentName}
                <p>{v.title}</p>
              </td>
              <td>
                {v.schedule
                  ? `${v.schedule.date} · ${v.schedule.period} · Lượt ${v.schedule.order}`
                  : "Chưa có lịch hiệu lực"}
              </td>
              <td>{committeeGradeLabels[v.state]}</td>
              <td>
                <Button variant="secondary" onClick={() => select(v)}>
                  Xem phiếu hội đồng
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function CommitteeProgressRows({
  items,
}: {
  items: CommitteeGradeProgress[];
}) {
  if (!items.length)
    return <Empty title="Chưa có tiến độ hội đồng trong phạm vi" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Hội đồng / Sinh viên</th>
            <th>Phiếu bắt buộc</th>
            <th>Chưa chấm</th>
            <th>Nháp</th>
            <th>Đã chốt</th>
            <th>Stale</th>
            <th>Bị chặn</th>
            <th>Còn thiếu</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={`${v.committeeId}:${v.termStudentId}`}>
              <td>
                {v.committeeCode} · {v.studentCode} · {v.studentName}
              </td>
              <td>{v.requiredCount ?? "Chưa xác minh"}</td>
              <td>{v.none}</td>
              <td>{v.draft}</td>
              <td>{v.finalized}</td>
              <td>{v.stale}</td>
              <td>{v.blocked}</td>
              <td>{v.missingRequired ?? "Chưa xác minh"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Tiến độ số phiếu; chưa phải điểm tổng hợp hoặc kết quả công bố.</p>
    </div>
  );
}
export function CommitteeGradeEditor({
  view,
  pending,
  download,
  submit,
}: {
  view: CommitteeGradeView;
  pending: boolean;
  download: () => Promise<void>;
  submit: (action: "save" | "finalize", body: CommitteeGradeCommand) => void;
}) {
  const [scores, setScores] = useState<Record<string, string>>(
      view.score?.criterionScores ?? {},
    ),
    [comment, setComment] = useState(view.comment ?? ""),
    [error, setError] = useState(""),
    [downloading, setDownloading] = useState(false);
  const blocked =
      pending || !!view.blockers.length || !view.report || !view.schedule,
    canEdit =
      (view.permissions.save || view.permissions.finalize) &&
      ["NONE", "DRAFT"].includes(view.state);
  let preview: string | null = null;
  try {
    if (view.policy)
      preview = committeeRubricTotal(
        view.policy,
        Object.fromEntries(Object.entries(scores).filter(([, v]) => v !== "")),
        true,
      ).totalScore;
  } catch {
    /* incomplete/invalid input is never treated as an official grade */
  }
  const send = (action: "save" | "finalize") => {
    const parsed = CommitteeGradeCommandSchema.safeParse({
      termId: view.termId,
      committeeId: view.committeeId,
      expectedRevision: view.revision,
      committeeRevision: view.committeeRevision,
      committeeEvidenceHash: view.committeeEvidenceHash,
      assignmentRevision: view.assignmentRevision,
      membershipHash: view.membershipHash,
      reportVersionId: view.report?.id,
      reportChecksum: view.report?.checksum,
      policyHash: view.policyHash,
      rubricHash: view.rubricHash,
      scheduleHash: view.schedule?.hash,
      criterionScores: Object.entries(scores)
        .filter(([, score]) => score !== "")
        .map(([criterionId, score]) => ({ criterionId, score })),
      comment,
    });
    if (!parsed.success) {
      setError(
        "Điểm hoặc phiên bản hồ sơ chưa hợp lệ; kiểm tra dữ liệu và tải lại.",
      );
      return;
    }
    setError("");
    submit(action, parsed.data);
  };
  return (
    <Card title={`${view.studentCode} · ${view.studentName}`}>
      <p>{view.title}</p>
      <p>
        {view.committeeCode} · {view.lecturerName} ·{" "}
        {committeeGradeLabels[view.memberRole]}
      </p>
      <p>
        {committeeGradeLabels[view.state]} · Revision {view.revision}
      </p>
      {view.schedule && (
        <p>
          {view.schedule.date} · {view.schedule.period} · Lượt{" "}
          {view.schedule.order} · {view.schedule.startAt}
        </p>
      )}
      {view.report ? (
        <p>
          PDF phiên bản {view.report.sequence} · {view.report.name}
        </p>
      ) : (
        <Notice>Chưa có PDF cuối hợp lệ.</Notice>
      )}
      <Button
        variant="secondary"
        disabled={!view.permissions.download || pending || downloading}
        onClick={async () => {
          setError("");
          setDownloading(true);
          try {
            await download();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Không tải được PDF.");
          } finally {
            setDownloading(false);
          }
        }}
      >
        {downloading ? "Đang tải PDF…" : "Tải PDF cuối"}
      </Button>
      {!!view.blockers.length && (
        <Notice>
          {view.blockers.map((b) => committeeGradeLabels[b] ?? b).join("; ")}
        </Notice>
      )}
      {!!view.finalizeBlockers.length && (
        <Notice>
          {view.finalizeBlockers
            .map((b) => committeeGradeLabels[b] ?? b)
            .join("; ")}
        </Notice>
      )}
      <p>
        Policy:{" "}
        {(canEdit ? view.policy?.version : view.gradedPolicyVersion) ??
          view.policy?.version ??
          "Chờ phê duyệt"}{" "}
        · Rubric:{" "}
        {(canEdit ? view.policy?.rubric.version : view.gradedRubric?.version) ??
          view.policy?.rubric.version ??
          "Chưa có rubric"}
      </p>
      <p>Phiếu riêng của giảng viên; chưa công bố cho sinh viên.</p>
      {canEdit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send("finalize");
          }}
        >
          {view.policy?.rubric.criteria.map((c) => (
            <Field
              key={c.id}
              label={`${c.name} · ${c.minScore}–${c.maxScore} · bước ${c.step} · trọng số ${c.weight}${c.required ? " · bắt buộc" : ""}`}
            >
              {c.description && <p>{c.description}</p>}
              <input
                inputMode="decimal"
                disabled={blocked}
                value={scores[c.id] ?? ""}
                onChange={(e) =>
                  setScores({ ...scores, [c.id]: e.target.value })
                }
              />
            </Field>
          ))}
          <p>
            Điểm phiếu tạm tính:{" "}
            <output>{preview ?? "Chưa có tổng hợp lệ"}</output>
          </p>
          <p>Tổng chính thức do backend kiểm và tính khi lưu.</p>
          <Field
            label={`Nhận xét${view.policy?.commentRequired ? " (bắt buộc khi chốt)" : ""}`}
          >
            <textarea
              value={comment}
              maxLength={12000}
              disabled={blocked}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          {view.policy?.draftAllowed && (
            <Button
              type="button"
              disabled={blocked || !view.permissions.save}
              onClick={() => send("save")}
            >
              Lưu nháp của tôi
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              blocked ||
              !view.permissions.finalize ||
              !!view.finalizeBlockers.length
            }
          >
            Chốt phiếu của tôi
          </Button>
          {pending && <Notice>Đang lưu phiếu…</Notice>}
        </form>
      ) : (
        <div>
          {view.score && (
            <>
              <p>Điểm phiếu: {view.score.totalScore ?? "Chưa đủ tiêu chí"}</p>
              <ul>
                {Object.entries(view.score.criterionScores).map(
                  ([id, score]) => (
                    <li key={id}>
                      {view.gradedRubric?.criteria.find((c) => c.id === id)
                        ?.name ?? id}
                      : {score}
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
          {view.comment !== null && <p>Nhận xét: {view.comment}</p>}
          <Notice>Chỉ đọc nội dung được cấp quyền.</Notice>
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
