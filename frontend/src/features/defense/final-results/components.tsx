import { useState } from "react";
import type {
  FinalResultCommand,
  FinalResultState,
  FinalResultView,
} from "@doan/shared";
import { Button, Card, Field, Notice } from "../../../shared/components/kit";
export const resultStates: Record<FinalResultState, string> = {
  INCOMPLETE: "Chưa đủ dữ liệu",
  READY: "Đủ dữ liệu để tính thử",
  AWAITING_CONFIRMATION: "Chờ hội đồng xác nhận",
  CONFIRMED: "Hội đồng đã xác nhận — chờ Khoa chốt",
  FINALIZED: "Đã chốt — chưa công bố",
  PUBLISHED: "Đã công bố",
  STALE: "Nguồn đã thay đổi — cần Khoa xử lý",
  LEGACY_UNVERIFIED: "Kết quả cũ chưa xác minh",
};
const sourceNames: Record<string, string> = {
  ADVISOR_UC17: "GVHD (tổng kết UC17)",
  PROCESS_UC16: "Đánh giá giai đoạn UC16",
  REVIEWER: "Phản biện",
  COMMITTEE: "Hội đồng",
};
const reasons: Record<string, string> = {
  UC24_POLICY_REQUIRED: "Chưa có chính sách tổng hợp được duyệt.",
  UNSUPPORTED_POLICY: "Công thức hoặc quy trình chưa được hỗ trợ/phê duyệt.",
  INVALID_WEIGHTS: "Trọng số chưa hợp lệ.",
  ADVISOR_SOURCE_UNVERIFIED: "Chưa xác nhận nguồn điểm hướng dẫn.",
  UC16_OFFICIAL_GRADE_READER_REQUIRED:
    "Chưa có nguồn điểm quá trình chính thức để tổng hợp.",
  UC24_SCHEMA_REQUIRED: "Database chưa sẵn sàng cho kết quả bảo vệ.",
  UC17_UC23_SCHEMA_REQUIRED: "Các nguồn điểm chưa sẵn sàng.",
  UC24_NOT_ENABLED: "Thao tác ghi chưa được nhóm cho phép bật.",
  COMMITTEE_CONFIRMATION_REQUIRED: "Chưa đủ xác nhận của hội đồng.",
  COMMITTEE_CONFIRM_PERMISSION_REQUIRED:
    "Chỉ thành viên được phân quyền mới được xác nhận.",
  FACULTY_PERMISSION_REQUIRED: "Cần quyền và phạm vi quản lý của Khoa.",
  FINALIZED_CURRENT_RESULT_REQUIRED: "Cần kết quả đã chốt và còn hiệu lực.",
  FINALIZATION_WINDOW_CLOSED: "Ngoài mốc xác nhận/chốt kết quả.",
  PUBLICATION_WINDOW_CLOSED: "Chưa đến hoặc đã hết mốc công bố.",
  DEFENSE_PHASE_CLOSED: "Giai đoạn bảo vệ chưa mở hoặc đã khóa.",
  RESULT_SOURCE_CHANGED:
    "Nguồn đã thay đổi; cần Khoa xử lý, không tự tính lại kết quả cũ.",
  RESULT_IMMUTABLE: "Kết quả đã chốt được khóa.",
  ROLE_ALREADY_CONFIRMED: "Vai trò này đã xác nhận.",
  SEPARATION_OF_DUTIES_REQUIRED:
    "Cần người thực hiện khác theo quy định phân tách trách nhiệm.",
  RESULT_NOT_RELEASED: "Kết quả chưa được phép hiển thị.",
  LEGACY_RESULT_UNVERIFIED: "Kết quả cũ chưa có chứng cứ xác minh.",
  NOT_PERMITTED: "Không có quyền thực hiện.",
  SCHEDULE_NOT_CURRENT: "Lịch bảo vệ chưa chốt hoặc không còn hiệu lực.",
  COMMITTEE_NOT_CURRENT: "Hội đồng/phân công chưa có hiệu lực.",
  ADVISOR_GRADE_UNVERIFIED: "Điểm hoặc xác nhận của GVHD chưa được xác minh.",
  CONFIRMATION_NOT_CURRENT: "Xác nhận hội đồng không còn hiệu lực.",
};
export function resultReason(code: string) {
  if (code.startsWith("COMMITTEE_GRADE_MISSING"))
    return "Còn thiếu phiếu hội đồng bắt buộc.";
  if (code.startsWith("REVIEWER_GRADE_MISSING"))
    return "Còn thiếu phiếu phản biện bắt buộc.";
  if (code.includes("GRADE_UNVERIFIED"))
    return "Phiếu điểm chưa chốt hoặc không còn hiệu lực.";
  return reasons[code] ?? code;
}
export function FinalResultRows({
  items,
  select,
}: {
  items: FinalResultView[];
  select: (v: FinalResultView) => void;
}) {
  if (!items.length)
    return <Notice>Không có kết quả trong phạm vi được cấp quyền.</Notice>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {[
              "Sinh viên",
              "Hội đồng",
              "Trạng thái",
              "Phiếu hợp lệ / bắt buộc",
              "GVHD",
              "Phản biện",
              "Hội đồng",
              "Điểm cuối",
              "",
            ].map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((v) => {
            const score = v.savedCalculation ?? v.calculation;
            return (
              <tr key={v.termStudentId}>
                <td>
                  {v.studentCode} — {v.studentName}
                </td>
                <td>{v.committeeCode ?? "—"}</td>
                <td>{resultStates[v.state]}</td>
                <td>
                  {v.visibility === "STUDENT"
                    ? "—"
                    : `${v.validCount} / ${v.requiredCount ?? "chưa xác minh"}`}
                </td>
                <td>{score?.components.ADVISOR_UC17 ?? "—"}</td>
                <td>{score?.reviewerScore ?? "—"}</td>
                <td>{score?.committeeScore ?? "—"}</td>
                <td>
                  {score?.finalScore ?? "—"}
                  {v.state === "READY" ? " (dự kiến)" : ""}
                </td>
                <td>
                  <Button type="button" onClick={() => select(v)}>
                    Chi tiết
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function FinalResultDetail({
  value: v,
  pending,
  command,
  preview,
}: {
  value: FinalResultView;
  pending: boolean;
  command: (
    action: "confirm" | "finalize" | "publish",
    b: FinalResultCommand,
  ) => void;
  preview: () => void;
}) {
  const [reason, setReason] = useState("");
  const saved = v.savedCalculation,
    score = saved ?? v.calculation,
    displayedPolicy = saved ? v.savedPolicy : v.policy,
    displayedSources = saved ? v.savedSources : v.sources;
  return (
    <Card>
      <h2>
        {v.studentCode} — {v.studentName}
      </h2>
      <p>{v.title}</p>
      <p>{resultStates[v.state]}</p>
      {v.schedule && (
        <p>
          Lịch bảo vệ: {v.schedule.startAt} → {v.schedule.endAt}
        </p>
      )}
      {v.blockers.map((b, i) => (
        <Notice key={i}>{resultReason(b)}</Notice>
      ))}
      {score && (
        <>
          <p>
            {saved
              ? "Kết quả đã lưu"
              : v.visibility === "STUDENT"
                ? "Kết quả chính thức"
                : "Kết quả tính thử, chưa chốt"}
            : <strong>{score.finalScore}</strong>
          </p>
          <p>
            {score.isPassed === null
              ? "Chưa áp dụng quy định đạt/xếp loại."
              : score.isPassed
                ? "Đạt"
                : "Chưa đạt"}{" "}
            {score.classification ?? ""}
          </p>
        </>
      )}
      {v.visibility === "INTERNAL" && (
        <>
          <p>
            Phiếu hợp lệ: {v.validCount}/{v.requiredCount ?? "chưa xác minh"};
            còn thiếu: {v.missingCount ?? "chưa xác minh"}.
          </p>
          {!!displayedSources.length && (
            <table className="w-full">
              <thead>
                <tr>
                  <th>Nguồn điểm</th>
                  <th>Giảng viên</th>
                  <th>Vai trò</th>
                  <th>Điểm</th>
                  <th>Phiên bản</th>
                </tr>
              </thead>
              <tbody>
                {displayedSources.map((s) => (
                  <tr key={s.source + s.lecturerId}>
                    <td>{sourceNames[s.source]}</td>
                    <td>{v.lecturerNames[s.lecturerId] ?? s.lecturerId}</td>
                    <td>{s.role}</td>
                    <td>{s.totalScore}</td>
                    <td>{s.revision}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {displayedPolicy && (
            <div>
              <h3>Quy định {displayedPolicy.version}</h3>
              <p>{displayedPolicy.reference}</p>
              <p>
                {displayedPolicy.components
                  .map((c) => `${sourceNames[c.source]} × ${c.weight}`)
                  .join(" + ")}
              </p>
              <p>
                Tổng hợp phản biện: {displayedPolicy.reviewerAggregate.mode};
                hội đồng: {displayedPolicy.committeeAggregate.mode}. Làm tròn
                cuối: {displayedPolicy.finalRounding.mode},{" "}
                {displayedPolicy.finalRounding.decimalPlaces} chữ số; bước điểm{" "}
                {displayedPolicy.finalStep}.
              </p>
            </div>
          )}
          {v.confirmations.map((c) => (
            <p key={c.role}>
              Đã xác nhận: {c.role} — {c.actor}, {c.at}
            </p>
          ))}
          {v.finalizedAt && (
            <p>
              Khoa chốt: {v.finalizedBy}, {v.finalizedAt}
            </p>
          )}
          {v.publishedAt && (
            <p>
              Công bố: {v.publishedBy}, {v.publishedAt}
            </p>
          )}
          <Button type="button" disabled={pending} onClick={preview}>
            Tính thử / kiểm tra lại nguồn
          </Button>
          <Field label="Lý do xác nhận (nếu quy định yêu cầu)">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={4000}
              disabled={pending}
            />
          </Field>
          {(["confirm", "finalize", "publish"] as const).map((action) => (
            <div key={action}>
              <Button
                type="button"
                disabled={
                  pending ||
                  v.actions[action].length > 0 ||
                  (action === "confirm" &&
                    !!v.policy?.confirmation.reasonRequired &&
                    !reason.trim())
                }
                onClick={() =>
                  command(action, {
                    termId: v.termId,
                    expectedRevision: v.revision,
                    policyHash: v.policyHash,
                    evidenceHash: v.evidenceHash,
                    ...(reason.trim() ? { reason: reason.trim() } : {}),
                  })
                }
              >
                {
                  {
                    confirm: "Hội đồng xác nhận",
                    finalize: "Khoa chốt và khóa kết quả",
                    publish: "Công bố kết quả",
                  }[action]
                }
              </Button>
              {v.actions[action].map((b, i) => (
                <p className="text-sm text-slate-600" key={i}>
                  {resultReason(b)}
                </p>
              ))}
            </div>
          ))}
          {!!v.history.length && (
            <details>
              <summary>Lịch sử thao tác</summary>
              {v.history.map((h, i) => (
                <p key={i}>
                  {h.at} — {h.action} — {h.actor} — phiên bản {h.revision}
                </p>
              ))}
            </details>
          )}
        </>
      )}
    </Card>
  );
}
