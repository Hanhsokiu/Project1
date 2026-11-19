import { useState } from "react";
import { AdvisorConfirmationSchema, AdvisorSummarySchema } from "@doan/shared";
import type {
  AdvisorConfirmation,
  AdvisorSummary,
  FinalDefenseView,
} from "@doan/shared";
import { Button, Field, Notice } from "../../../shared/components/kit";

const blockerText: Record<string, string> = {
  UC17_SCHEMA_REQUIRED: "Nhóm chưa triển khai đầy đủ schema và ràng buộc UC17.",
  UC17_POLICY_REQUIRED: "Đợt chưa có chính sách UC17 hợp lệ được phê duyệt.",
  UC17_NOT_ENABLED: "Nhóm chưa bật thao tác ghi UC17.",
  TERM_003: "Giai đoạn FINAL chưa mở, đã hết hạn hoặc đợt đã khóa.",
  INPUT_NOT_READY: "Đầu vào từ bước trước chưa được xác nhận hợp lệ.",
  OFFICIAL_ADVISOR_REQUIRED:
    "Chỉ GVHD chính thức của hồ sơ được thực hiện thao tác này.",
  TOPIC_NOT_AGREED: "GVHD cần xác nhận lại đề tài theo phân công hiện hành.",
  LEGACY_REPORT_RECONCILIATION_REQUIRED:
    "PDF cũ hoặc lần nộp dang dở cần được đối soát trước khi nộp tiếp.",
  OWNER_STUDENT_REQUIRED: "Chỉ sinh viên sở hữu hồ sơ được nộp PDF.",
  UPLOAD_PERMISSION_REQUIRED: "Tài khoản chưa có quyền nộp PDF cuối.",
  ADVISOR_PERMISSION_REQUIRED:
    "Tài khoản chưa có quyền lưu đánh giá hoặc quyết định này.",
  DOWNLOAD_PERMISSION_REQUIRED: "Tài khoản chưa có quyền tải PDF cuối.",
  FINAL_PDF_REQUIRED: "Sinh viên chưa nộp PDF đồ án cuối hợp lệ.",
  ADVISOR_SUMMARY_REQUIRED:
    "Cần lưu nhận xét và điểm cho PDF, phân công và chính sách hiện hành trước khi xác nhận.",
  SCORE_LOCKED: "Điểm GVHD đã khóa; không thể sửa đánh giá.",
  REPORT_LOCKED:
    "Chính sách đã duyệt không cho thay PDF sau quyết định của GVHD.",
};
export const finalBlockerLabel = (code: string, view: FinalDefenseView) =>
  code === "TERM_003" && view.writeWindow?.reason
    ? view.writeWindow.reason
    : (blockerText[code] ?? code);
export function ActionBlockedNotice({
  view,
  action,
  pending = false,
}: {
  view: FinalDefenseView;
  action: keyof FinalDefenseView["permissions"];
  pending?: boolean;
}) {
  if (pending) return <p role="status">Đang lưu hồ sơ, vui lòng chờ…</p>;
  if (view.permissions[action]) return null;
  const reasons = view.actionBlockers?.[action] ?? view.blockers ?? [];
  return (
    <Notice>
      <ul>
        {reasons.length ? (
          reasons.map((code) => (
            <li key={code}>{finalBlockerLabel(code, view)}</li>
          ))
        ) : (
          <li>Tài khoản chưa được phép thực hiện thao tác này.</li>
        )}
      </ul>
    </Notice>
  );
}

export const finalStatusLabel = (status: string) =>
  ({
    PENDING: "Chờ GVHD xác nhận",
    CONFIRMED: "GVHD đồng ý",
    REJECTED: "GVHD không đồng ý",
    STALE: "Cần GVHD xem xét lại",
    LEGACY_UNVERIFIED: "Quyết định cũ cần đối soát",
    HIDDEN: "Chưa được phép xem trạng thái",
  })[status] ?? status;
export function AdvisorSummaryForm({
  view,
  pending,
  submit,
}: {
  view: FinalDefenseView;
  pending: boolean;
  submit: (input: AdvisorSummary) => void;
}) {
  const [comment, setComment] = useState(view.summary?.comment ?? "");
  const [score, setScore] = useState(view.summary?.score?.toString() ?? "");
  const [criteria, setCriteria] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (view.policy?.rubric ?? []).map((r) => [
        r.key,
        view.summary?.criterionScores?.[r.key]?.toString() ?? "",
      ]),
    ),
  );
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const result = AdvisorSummarySchema.safeParse({
          expectedRevision: view.revision,
          reportVersionId: view.versions[0]?.id,
          comment,
          score: score.trim() ? Number(score) : NaN,
          criterionScores: Object.fromEntries(
            Object.entries(criteria).map(([k, v]) => [
              k,
              v.trim() ? Number(v) : NaN,
            ]),
          ),
        });
        if (!result.success) {
          setError(result.error.issues[0].message);
          return;
        }
        setError("");
        submit(result.data);
      }}
      className="space-y-4"
    >
      <fieldset
        disabled={pending || !view.permissions.review || !view.versions.length}
        className="space-y-4"
      >
        <Field label="Nhận xét tổng kết">
          <textarea
            aria-label="Nhận xét tổng kết"
            required
            maxLength={20000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Field>
        {view.policy?.rubric?.map((r) => (
          <Field
            key={r.key}
            label={`${r.label} (tối đa ${r.maxScore}; trọng số ${r.weight})`}
          >
            <input
              aria-label={r.label}
              type="number"
              required
              min="0"
              max={r.maxScore}
              step="any"
              value={criteria[r.key] ?? ""}
              onChange={(e) =>
                setCriteria({ ...criteria, [r.key]: e.target.value })
              }
            />
          </Field>
        ))}
        <Field label="Điểm hướng dẫn (thang 10)">
          <input
            aria-label="Điểm hướng dẫn"
            type="number"
            required
            min="0"
            max="10"
            step={view.policy?.scoreStep ?? "any"}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </Field>
        <p className="text-sm muted">
          Điểm không tự quyết định việc đồng ý bảo vệ. Sửa đánh giá đã xác nhận
          sẽ yêu cầu GVHD xác nhận lại.
        </p>
        <Button type="submit">Lưu nhận xét và điểm</Button>
      </fieldset>
      <ActionBlockedNotice view={view} action="review" pending={pending} />
      {error && <Notice tone="danger">{error}</Notice>}
    </form>
  );
}
export function AdvisorDecisionForm({
  view,
  pending,
  submit,
}: {
  view: FinalDefenseView;
  pending: boolean;
  submit: (input: AdvisorConfirmation) => void;
}) {
  const [status, setStatus] = useState<"CONFIRMED" | "REJECTED">(
    view.decision?.status === "REJECTED" ? "REJECTED" : "CONFIRMED",
  );
  const [reason, setReason] = useState(view.decision?.reason ?? "");
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = AdvisorConfirmationSchema.safeParse({
          expectedRevision: view.revision,
          reportVersionId: view.versions[0]?.id,
          status,
          reason,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setError("");
        submit(parsed.data);
      }}
      className="space-y-4"
    >
      <fieldset
        disabled={pending || !view.permissions.decide}
        className="space-y-4"
      >
        <Field label="Quyết định của GVHD">
          <select
            aria-label="Quyết định của GVHD"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="CONFIRMED">Đồng ý</option>
            <option value="REJECTED">Không đồng ý</option>
          </select>
        </Field>
        <Field
          label={
            status === "REJECTED"
              ? "Lý do không đồng ý (bắt buộc)"
              : "Ghi chú quyết định"
          }
        >
          <textarea
            aria-label="Lý do quyết định"
            required={status === "REJECTED"}
            maxLength={4000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Button type="submit">Lưu quyết định</Button>
      </fieldset>
      <ActionBlockedNotice view={view} action="decide" pending={pending} />
      {error && <Notice tone="danger">{error}</Notice>}
    </form>
  );
}
