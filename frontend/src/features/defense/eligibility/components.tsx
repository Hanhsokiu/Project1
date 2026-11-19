import { useState } from "react";
import type {
  EligibilityDecision,
  EligibilityReview,
  EligibilityView,
} from "@doan/shared";
import {
  EligibilityDecisionSchema,
  EligibilityReviewSchema,
} from "@doan/shared";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
} from "../../../shared/components/kit";

export const eligibilityLabels: Record<string, string> = {
  CONFIRMED: "GVHD đồng ý",
  REJECTED: "GVHD không đồng ý",
  VERIFIED: "Đã xác minh",
  ELIGIBILITY_REVIEWED: "Khoa kiểm tra hồ sơ",
  ELIGIBILITY_DECIDED: "Khoa ra quyết định",
  ELIGIBILITY_FINALIZED:
    "Đã chốt danh sách; chưa có quy trình mở lại được duyệt",
  QUALIFIED: "Chứng cứ đầy đủ",
  NEGATIVE: "Có chứng cứ không đạt",
  PENDING: "Chờ xét",
  MISSING: "Thiếu chứng cứ",
  STALE: "Không còn hiệu lực",
  UNVERIFIED: "Chưa thể xác minh",
  NONE: "Khoa chưa xét",
  REVIEWED: "Khoa đã kiểm tra",
  DECIDED: "Khoa đã quyết định, chưa chốt",
  FINALIZED: "Khoa đã chốt",
  LEGACY_UNVERIFIED: "Dữ liệu cũ cần đối soát",
  ELIGIBLE: "Đủ điều kiện",
  INELIGIBLE: "Không đủ điều kiện",
  DEFERRED: "Hoãn xét",
  UC18_NOT_ENABLED: "Nhóm chưa bật ghi UC18",
  UC18_SCHEMA_REQUIRED: "Cần migration UC17/UC18 đã review",
  UC18_POLICY_REQUIRED: "Chưa có policy UC18 được duyệt",
  FACULTY_PERMISSION_REQUIRED: "Cần quyền UC18 của Khoa/Giáo vụ",
  CURRENT_REVIEW_REQUIRED: "Cần Khoa kiểm tra lại chứng cứ hiện hành",
  VERIFIED_QUALIFIED_EVIDENCE_REQUIRED: "Chưa đủ chứng cứ hợp lệ để chốt",
  FACULTY_ELIGIBLE_DECISION_REQUIRED: "Cần quyết định đủ điều kiện của Khoa",
  PROPOSAL_REQUIRED: "Chưa xác định hồ sơ đúng đợt",
  LEGACY_RECONCILIATION_REQUIRED:
    "Cần đối soát hồ sơ cũ theo quy trình được duyệt",
};
export function eligibilityError(error: unknown) {
  const e = error as { status?: number; message?: string };
  const prefix: Record<number, string> = {
    401: "Cần đăng nhập lại",
    403: "Không có quyền",
    404: "Không tìm thấy hồ sơ trong phạm vi",
    409: "Hồ sơ/chứng cứ đã đổi hoặc thao tác bị chặn; tải lại",
  };
  return [
    e?.status ? prefix[e.status] : "",
    e?.message ?? "Không xử lý được yêu cầu",
  ]
    .filter(Boolean)
    .join(": ");
}
export function EligibilityRows({
  items,
  select,
  chosen,
  toggle,
}: {
  items: EligibilityView[];
  select: (v: EligibilityView) => void;
  chosen: string[];
  toggle: (v: EligibilityView) => void;
}) {
  if (!items.length)
    return <Empty title="Không có hồ sơ trong phạm vi/bộ lọc" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Chọn chốt</th>
            <th>Sinh viên</th>
            <th>Đề tài / GVHD</th>
            <th>UC17 / PDF</th>
            <th>Kiểm tra chứng cứ</th>
            <th>Quyết định Khoa</th>
            <th>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.termStudentId}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Chọn ${v.studentCode}`}
                  checked={chosen.includes(v.termStudentId)}
                  disabled={!!v.actionBlockers.finalize.length}
                  onChange={() => toggle(v)}
                />
              </td>
              <td>
                {v.studentCode}
                <br />
                {v.studentName}
              </td>
              <td>
                {v.title}
                <br />
                {v.advisor ?? "Chưa có GVHD chính thức"}
              </td>
              <td>
                {eligibilityLabels[v.uc17] ?? v.uc17} /{" "}
                {eligibilityLabels[v.pdf] ?? v.pdf}
              </td>
              <td>{eligibilityLabels[v.preview]}</td>
              <td>
                {eligibilityLabels[v.official.state]}
                {["DECIDED", "FINALIZED"].includes(v.official.state) && (
                  <>: {eligibilityLabels[v.official.status]}</>
                )}
              </td>
              <td>
                <Button variant="secondary" onClick={() => select(v)}>
                  Xem chứng cứ
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function EligibilityEvidence({ view: v }: { view: EligibilityView }) {
  return (
    <Card title={`${v.studentCode} — ${v.studentName}`}>
      <p>
        {v.title} · GVHD: {v.advisor ?? "Chưa xác minh"}
      </p>
      <p>
        Kiểm tra chứng cứ: {eligibilityLabels[v.preview]}. Quyết định Khoa:{" "}
        {eligibilityLabels[v.official.state]}.
      </p>
      <p>
        PDF: {eligibilityLabels[v.pdf] ?? v.pdf}. GVHD:{" "}
        {eligibilityLabels[v.uc17] ?? v.uc17}. Phiên bản hồ sơ xét: {v.revision}
        .
      </p>
      <ul>
        {v.checks.map((c) => (
          <li key={c.key}>
            {eligibilityLabels[c.state]} — {c.message}
          </li>
        ))}
      </ul>
      {v.advisorSummary?.score !== undefined && (
        <p>Điểm GVHD: {v.advisorSummary.score}</p>
      )}
      {v.advisorSummary?.comment !== undefined && (
        <p>Nhận xét GVHD: {v.advisorSummary.comment}</p>
      )}
      <p>
        Điểm và nhận xét GVHD chỉ hiển thị khi được cấp quyền và bản đánh giá
        còn hiệu lực.
      </p>
      {v.academic && (
        <p>
          Học vụ: {v.academic.evidence.outcome} ·{" "}
          {v.academic.evidence.reference} · xác minh {v.academic.verifiedAt}
        </p>
      )}
      {v.official.reason && <p>Lý do Khoa: {v.official.reason}</p>}
      {v.downstream && (
        <Notice>
          Hồ sơ đã chốt và chứng cứ còn hiệu lực tại lần kiểm tra này.
        </Notice>
      )}
      <ul aria-label="Lịch sử Khoa">
        {v.history.map((h) => (
          <li key={h.id}>
            {h.at}: {eligibilityLabels[h.action] ?? h.action} · {h.actor} ·
            phiên bản {h.revision} ·{" "}
            {h.status ? eligibilityLabels[h.status] : ""}
            {h.reason && <> · {h.reason}</>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
export function EligibilityCommandForm({
  view,
  pending,
  submit,
}: {
  view: EligibilityView;
  pending: boolean;
  submit: (
    action: "review" | "decide",
    body: EligibilityReview | EligibilityDecision,
  ) => void;
}) {
  const [action, setAction] = useState<"review" | "decide">("review"),
    [error, setError] = useState("");
  const blocks = view.actionBlockers[action];
  return (
    <Card title="Khoa kiểm tra và quyết định">
      <p>
        Chứng cứ đầy đủ chỉ là kết quả kiểm tra. Chỉ Khoa có quyền quyết định và
        chốt.
      </p>
      <label>
        Thao tác
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value as typeof action);
            setError("");
          }}
        >
          <option value="review">Kiểm tra / xác minh học vụ</option>
          <option value="decide">Quyết định của Khoa</option>
        </select>
      </label>
      {blocks.length > 0 && (
        <Notice>
          {blocks.map((b) => eligibilityLabels[b] ?? b).join("; ")}
        </Notice>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const iso = (name: string) => {
            const value = new Date(String(data.get(name) ?? ""));
            return Number.isFinite(value.getTime()) ? value.toISOString() : "";
          };
          const base = {
            termId: view.termId,
            expectedRevision: view.revision,
            evidenceHash: view.evidenceHash,
            reason: String(data.get("reason") ?? ""),
          };
          let academic;
          if (action === "review" && data.get("source"))
            academic = {
              source: String(data.get("source")),
              reference: String(data.get("reference") ?? ""),
              outcome: String(data.get("academicOutcome")),
              effectiveFrom: iso("effectiveFrom"),
              validUntil: iso("validUntil"),
            };
          const parsed =
            action === "review"
              ? EligibilityReviewSchema.safeParse({
                  ...base,
                  ...(academic ? { academic } : {}),
                })
              : EligibilityDecisionSchema.safeParse({
                  ...base,
                  status: data.get("status"),
                });
          if (!parsed.success) {
            setError("Nhập đủ lý do, nguồn xác minh và thời hạn hợp lệ.");
            return;
          }
          setError("");
          submit(action, parsed.data);
        }}
      >
        <fieldset disabled={pending || !!blocks.length}>
          <Field label="Lý do / nội dung kiểm tra">
            <textarea name="reason" required maxLength={4000} />
          </Field>
          {action === "decide" ? (
            <Field label="Quyết định">
              <select name="status">
                <option value="ELIGIBLE">Đủ điều kiện</option>
                <option value="INELIGIBLE">
                  Không đủ điều kiện (cần chứng cứ phủ định)
                </option>
                <option value="DEFERRED">Hoãn xét</option>
              </select>
            </Field>
          ) : (
            <>
              <Field label="Nguồn học vụ đã được duyệt (để trống nếu chưa xác minh)">
                <select name="source">
                  <option value="">Không thêm chứng cứ học vụ</option>
                  {view.policy?.academicSources.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Số văn bản / tham chiếu chứng cứ">
                <input name="reference" maxLength={4000} />
              </Field>
              <Field label="Kết luận nguồn học vụ">
                <select name="academicOutcome">
                  <option value="PASS">Đạt</option>
                  <option value="FAIL">Không đạt</option>
                </select>
              </Field>
              <Field label="Có hiệu lực từ">
                <input name="effectiveFrom" type="datetime-local" />
              </Field>
              <Field label="Hết hiệu lực">
                <input name="validUntil" type="datetime-local" />
              </Field>
            </>
          )}
          <Button type="submit">
            {pending
              ? "Đang lưu…"
              : action === "review"
                ? "Lưu kiểm tra"
                : "Lưu quyết định Khoa"}
          </Button>
        </fieldset>
      </form>
      {error && <Notice>{error}</Notice>}
    </Card>
  );
}
