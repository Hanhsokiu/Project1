import type { ReportPreview, ReportStatistics } from "@doan/shared";
import { Card, Notice } from "../../../shared/components/kit";
const reasonNames: Record<string, string> = {
  UC25_POLICY_REQUIRED: "Chưa có chính sách báo cáo được phê duyệt.",
  UC25_NOT_ENABLED: "Nhóm chưa cho phép ghi audit/metadata để xuất file.",
  TEMPLATE_NOT_APPROVED:
    "Mẫu chưa được Khoa phê duyệt; chỉ xem bản DRAFT theo quyền.",
  TEMPLATE_NOT_EFFECTIVE: "Mẫu nằm ngoài thời gian hiệu lực.",
  TEMPLATE_VERSION_MISMATCH: "Phiên bản mẫu đã thay đổi; tải lại.",
  NO_DATA: "Không có dữ liệu theo bộ lọc.",
  ONE_STUDENT_REQUIRED: "Chọn đúng một sinh viên để xuất đề cương.",
  DRAFT_NOT_ALLOWED: "Mẫu không cho phép bản DRAFT.",
  GRADE_STATISTICS_PERMISSION_REQUIRED:
    "Chưa có quyền xem thống kê tình trạng điểm.",
  SCORE_STATISTICS_PERMISSION_REQUIRED:
    "Chưa có quyền xem thống kê giá trị điểm.",
  PASS_RULE_OR_RELEASE_NOT_VERIFIED:
    "Chưa đủ quy định đạt hoặc kết quả được phép thống kê; không tự suy ngưỡng đạt.",
  SOURCE_NOT_CURRENT: "Nguồn chưa chốt hoặc không còn hiệu lực.",
  REPORT_SOURCE_CHANGED:
    "Nguồn hoặc quyền đã thay đổi; cần xem trước và xuất lại.",
  REPORT_LIMIT_EXCEEDED: "Dữ liệu vượt giới hạn; hãy thu hẹp bộ lọc.",
  EXPORT_EXPIRED_OR_FAILED: "Bản xuất đã hết hạn hoặc tạo thất bại.",
  GENERATION_FAILED: "Không tạo được file; chưa có bản xuất thành công.",
  ARTIFACT_HASH_MISMATCH: "File không khớp bản xuất; cần tạo lại.",
  REPORT_BUSY: "Máy chủ đang tạo báo cáo khác; thử lại sau.",
};
export function reportReason(code: string) {
  if (code.startsWith("MISSING_SOURCE:"))
    return "Còn thiếu nguồn được xác minh: " + code.slice(15);
  return reasonNames[code] ?? code;
}
export function ReportPreviewTable({ preview: p }: { preview: ReportPreview }) {
  return (
    <Card>
      <h2>
        {p.template.name} — {p.template.version}
      </h2>
      <p>
        {p.mode === "DRAFT"
          ? "DRAFT / CHƯA CHÍNH THỨC / CHƯA PHÊ DUYỆT"
          : p.blockers.length
            ? "Yêu cầu bản chính thức — chưa đủ điều kiện xuất"
            : "Dữ liệu được xác minh theo mẫu đã duyệt"}
      </p>
      <p>
        {p.count} dòng;{" "}
        {p.signatureStatus === "UNSIGNED" ? "chưa ký xác nhận" : ""}.{" "}
        {p.truncated
          ? "Chỉ xem trước 20 dòng đầu; file sẽ chứa toàn bộ trong giới hạn."
          : ""}
      </p>
      {p.blockers.map((b, i) => (
        <Notice key={i}>{reportReason(b)}</Notice>
      ))}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {p.template.columns.map((c) => (
                <th key={c}>{columnLabels[c] ?? c}</th>
              ))}
              <th>Nguồn</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((row, i) => (
              <tr key={i}>
                {p.template.columns.map((c) => (
                  <td className="whitespace-pre-wrap" key={c}>
                    {row.cells[c] || "—"}
                  </td>
                ))}
                <td>
                  {row.sourceState === "CURRENT"
                    ? "Hiện hành"
                    : row.sourceState}
                  {row.missing.length
                    ? " — thiếu: " + row.missing.join(", ")
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
export const columnLabels: Record<string, string> = {
  ORDER: "Thứ tự",
  STUDENT_CODE: "Mã sinh viên",
  FAMILY_NAME: "Họ đệm",
  GIVEN_NAME: "Tên",
  STUDENT_NAME: "Họ và tên",
  CLASS: "Lớp",
  TITLE: "Đề tài",
  RESEARCH_AREA: "Hướng",
  ADVISOR: "GVHD",
  REVIEWERS: "GVPB",
  COMMITTEE: "Hội đồng",
  LECTURER: "Giảng viên",
  ROLE: "Vai trò",
  DATE: "Ngày bảo vệ",
  PERIOD: "Buổi",
  ROOM: "Phòng",
  ADVISOR_SCORE: "Điểm GVHD",
  REVIEWER_SCORE: "Điểm phản biện",
  COMMITTEE_SCORE: "Điểm hội đồng",
  MEMBER_SCORES: "Điểm từng thành viên hội đồng",
  REVIEWER_SCORES: "Điểm từng GVPB",
  FINAL_SCORE: "Điểm cuối",
  RESULT: "Kết quả",
  COMMENTS: "Nhận xét",
  QUESTIONS: "Câu hỏi",
  CONCLUSION: "Kết luận",
  REVISION_REQUESTS: "Yêu cầu chỉnh sửa",
  STATE: "Trạng thái",
  SIGNATURE_STATUS: "Ký xác nhận",
};
const value = (v: number | string | null) =>
  v === null ? "Chưa xác minh / chưa được phép xem" : String(v);
export function ReportStatisticsPanel({
  statistics: s,
}: {
  statistics: ReportStatistics;
}) {
  const indicators: [string, number | string | null][] = [
    ["Sinh viên trong scope", s.students],
    ["Hồ sơ có đề tài", s.proposals],
    ["Giảng viên có nhiệm vụ hiện hành", s.lecturers],
    ["Hội đồng hiện hành", s.committees],
    ["Sinh viên đã có lịch", s.scheduledStudents],
    ["Phiên bảo vệ", s.sessions],
    ["Sinh viên có chứng cứ đủ điều kiện", s.eligibleStudents],
    ["Chưa xác minh điều kiện", s.unknownEligibility],
    ["Phân công phản biện", s.reviewerAssignments],
    ["Phiếu GVPB đã chốt/current", s.reviewerSheets],
    ["Phiếu hội đồng đã chốt/current", s.committeeSheets],
    ["Sinh viên có kết quả đã chốt/current", s.finalizedResults],
    ["Sinh viên có kết quả công bố/current", s.publishedResults],
    ["Điểm trung bình của kết quả được phép thống kê", s.average],
    ["Tỷ lệ đạt (%) trong kết quả được phép thống kê", s.passRate],
  ];
  return (
    <>
      <Card>
        <h2>Thống kê cùng phạm vi dữ liệu</h2>
        <dl>
          {indicators.map(([label, count]) => (
            <div key={label} className="flex justify-between gap-4 py-1">
              <dt>{label}</dt>
              <dd>{value(count)}</dd>
            </div>
          ))}
        </dl>
        {s.blockers.map((b, i) => (
          <Notice key={i}>{reportReason(b)}</Notice>
        ))}
      </Card>
      {[
        ["Theo lớp", s.byClass],
        ["Theo hội đồng", s.byCommittee],
        ["Theo bộ môn", s.byDepartment],
      ].map(([label, rows]) => (
        <Card key={String(label)}>
          <h3>{String(label)}</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th>Nhóm</th>
                <th>Sinh viên</th>
                <th>Đã chốt/current</th>
              </tr>
            </thead>
            <tbody>
              {(rows as ReportStatistics["byClass"]).map((r) => (
                <tr key={r.key}>
                  <td>{r.key}</td>
                  <td>{r.students}</td>
                  <td>{value(r.finalized)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
      <Card>
        <h3>Hướng nghiên cứu và tiến độ</h3>
        {s.researchAreas.map((r) => (
          <p key={r.key}>
            {r.key}: {r.students} sinh viên
          </p>
        ))}
        <p>
          {s.progress.completedTasks}/{s.progress.activeTasks} nhiệm vụ hoàn
          thành trong các kế hoạch đã xác minh; {s.progress.unknownStudents} hồ
          sơ chưa đủ chứng cứ tiến độ.
        </p>
      </Card>
      <Card>
        <h3>Tải giảng viên theo nhiệm vụ hiện hành</h3>
        {s.advisorLoads.map((l) => (
          <p key={l.lecturerId}>
            GVHD {l.name}: {l.students} sinh viên
          </p>
        ))}
        {s.reviewerLoads.map((l) => (
          <p key={l.lecturerId}>
            GVPB {l.name}: {l.students} sinh viên
          </p>
        ))}
      </Card>
      {s.distribution && (
        <Card>
          <h3>Phân bố theo khoảng điểm được duyệt</h3>
          {s.distribution.map((b) => (
            <p key={b.label}>
              {b.label}: {b.count}
            </p>
          ))}
        </Card>
      )}
    </>
  );
}
