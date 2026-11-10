import { useState } from "react";
import { ReviewerAssignSchema, ReviewerFinalizeSchema } from "@doan/shared";
import type {
  ReviewerAllocation,
  ReviewerAssign,
  ReviewerFinalize,
  ReviewerView,
  ReviewerWorkspace,
} from "@doan/shared";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
} from "../../../shared/components/kit";
export const reviewerLabels: Record<string, string> = {
  NONE: "Chưa phân công",
  DRAFT: "Dự thảo",
  FINALIZED: "Đã chốt, còn hiệu lực",
  STALE: "Nguồn đã thay đổi",
  LEGACY_UNVERIFIED: "Phân công cũ chưa đối soát",
  FEASIBLE: "Có phương án hợp lệ",
  UNSAT: "Không có phương án thỏa ràng buộc",
  SEARCH_LIMIT: "Đã tới giới hạn tìm kiếm",
  BLOCKED: "Chưa đủ điều kiện đề xuất",
  UC20_SCHEMA_REQUIRED: "Cần migration UC20 đã duyệt và kiểm chứng",
  UC20_POLICY_REQUIRED: "Chưa có chính sách phản biện được duyệt",
  UC20_NOT_ENABLED: "Nhóm chưa bật ghi UC20",
  UC17_UC18_UC19_SCHEMA_REQUIRED: "Cần schema UC17–UC19 đã kiểm chứng",
  UPSTREAM_POLICY_OR_PERMISSION_REQUIRED: "Cần policy/quyền đọc UC18–UC19",
  TERM_ADVISOR_LOAD_UNVERIFIED: "Chưa xác minh được tải GVHD toàn kỳ",
  UC19_FINALIZED_CURRENT_REQUIRED: "Cần hội đồng UC19 đã chốt và còn hiệu lực",
  UC18_FINALIZED_CURRENT_REQUIRED:
    "Cần quyết định UC18 đã chốt và còn hiệu lực",
  OFFICIAL_ADVISOR_BINDING_REQUIRED: "Chưa khớp GVHD chính thức",
  ADVISOR_HISTORY_UNVERIFIED: "Lịch sử hướng dẫn chưa được xác minh",
  ADVISOR_CONFLICT: "GVHD không được phản biện sinh viên mình",
  FORMER_ADVISOR_CONFLICT:
    "Người từng hướng dẫn không được phản biện theo chính sách",
  FORMER_ADVISOR_PENDING_APPROVAL:
    "Chưa duyệt quy định cho người từng hướng dẫn",
  COMMITTEE_MEMBER_FORBIDDEN:
    "Chính sách không cho kiêm nhiệm thành viên hội đồng",
  COMMITTEE_MEMBERSHIP_PENDING_APPROVAL:
    "Chưa duyệt quy định kiêm nhiệm hội đồng/phản biện",
  LECTURER_INACTIVE: "Giảng viên không hoạt động",
  LECTURER_NOT_IN_ROSTER: "Giảng viên không thuộc roster kỳ",
  REVIEWER_DEPARTMENT_MISMATCH: "Giảng viên khác phạm vi bộ môn được duyệt",
  REVIEWER_TITLE_REQUIRED: "Chưa đạt chức danh theo chính sách",
  REVIEWER_AREA_MATCH_REQUIRED: "Chưa khớp chuyên môn được duyệt",
  REVIEW_CAPACITY_EXCEEDED: "Vượt tải phản biện",
  TOTAL_CAPACITY_EXCEEDED: "Vượt tổng tải GVHD + hội đồng + phản biện",
  REVIEWER_COUNT_REQUIRED: "Chưa đủ số phản biện theo chính sách",
  REVIEWER_SOURCE_CHANGED:
    "Nguồn phân công đã thay đổi; cần lưu lại dự thảo hợp lệ",
  REVIEWER_PROVENANCE_UNVERIFIED: "Chưa xác minh được lịch sử phân công",
  LEGACY_REVIEWER_RECONCILIATION_REQUIRED: "Cần đối soát phân công legacy",
  REVIEWER_NOT_IN_SCOPE_OR_ROSTER: "GVPB ngoài quyền hoặc roster",
  REVIEWER_FINALIZED_IMMUTABLE:
    "Đã chốt; chưa có quy trình thay thế được duyệt",
  FACULTY_PERMISSION_REQUIRED: "Cần quyền tương ứng của Khoa",
  REVIEWERS_SAVED: "Lưu/điều chỉnh dự thảo",
  REVIEWERS_FINALIZED: "Chốt phân công",
};
export const reviewerReason = (r: string) => reviewerLabels[r] ?? r;
export function ReviewerReasons({ values }: { values: string[] }) {
  return values.length ? (
    <Notice>{[...new Set(values)].map(reviewerReason).join("; ")}</Notice>
  ) : null;
}
export function ReviewerRows({
  items,
  workspace,
  selected,
  pending,
  choose,
  select,
}: {
  items: ReviewerView[];
  workspace?: ReviewerWorkspace;
  selected: string[];
  pending: boolean;
  choose: (id: string) => void;
  select: (id: string) => void;
}) {
  if (!items.length)
    return <Empty title="Không có hồ sơ trong phạm vi/bộ lọc" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Chọn</th>
            <th>Sinh viên / Đề tài</th>
            <th>Hội đồng</th>
            <th>GVHD</th>
            <th>GVPB</th>
            <th>Trạng thái</th>
            <th>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Chọn ${c.studentCode}`}
                  checked={selected.includes(c.id)}
                  disabled={
                    pending ||
                    !c.binding ||
                    ["FINALIZED", "LEGACY_UNVERIFIED"].includes(c.state)
                  }
                  onChange={() => choose(c.id)}
                />
              </td>
              <td>
                {c.studentCode} · {c.studentName}
                <p>{c.title}</p>
              </td>
              <td>{c.committeeCode ?? "Chưa có hội đồng chính thức"}</td>
              <td>{c.advisorName ?? "Chưa xác minh"}</td>
              <td>
                {c.reviewerIds
                  .map(
                    (id) =>
                      workspace?.lecturers.find((l) => l.id === id)?.name ??
                      "Giảng viên cần đối soát",
                  )
                  .join(", ") || "Chưa phân"}
              </td>
              <td>{reviewerLabels[c.state]}</td>
              <td>
                <Button variant="secondary" onClick={() => select(c.id)}>
                  Xem hồ sơ
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ReviewerLoads({
  workspace: w,
}: {
  workspace: ReviewerWorkspace;
}) {
  return (
    <Card title="Giảng viên trong phạm vi và tải toàn kỳ">
      {!w.lecturers.length ? (
        <Empty title="Không có giảng viên trong roster/phạm vi" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Giảng viên</th>
              <th>Phản biện</th>
              <th>Hướng dẫn + hội đồng</th>
              <th>Tổng tải</th>
            </tr>
          </thead>
          <tbody>
            {w.lecturers.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.code} · {l.name}
                </td>
                <td>{l.reviewLoad}</td>
                <td>{l.otherStudentDuties}</td>
                <td>{l.totalLoad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
export function ReviewerEditor({
  workspace: w,
  student: c,
  pending,
  save,
  finalize,
}: {
  workspace: ReviewerWorkspace;
  student: ReviewerView;
  pending: boolean;
  save: (b: ReviewerAssign) => void;
  finalize: (b: ReviewerFinalize) => void;
}) {
  const [chosen, setChosen] = useState(c.reviewerIds),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const assignDisabled = pending || !!c.blockers.assign.length || !c.binding;
  return (
    <Card title={`${c.studentCode} · ${c.studentName}`}>
      <p>
        {c.title} · Hội đồng {c.committeeCode ?? "chưa có"} · GVHD{" "}
        {c.advisorName ?? "chưa xác minh"}
      </p>
      <p>
        {reviewerLabels[c.state]} · Revision {c.revision}
      </p>
      <ReviewerReasons values={c.issues} />
      <ReviewerReasons values={c.blockers.assign} />
      {error && <Notice>{error}</Notice>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const b = ReviewerAssignSchema.safeParse({
            termId: w.termId,
            rosterHash: w.rosterHash,
            reason,
            placements: [{ ...c.binding, reviewerIds: chosen }],
          });
          if (!b.success) {
            setError("Cần lý do và chứng cứ hiện hành; không chọn trùng GVPB.");
            return;
          }
          setError("");
          save(b.data);
        }}
      >
        <fieldset disabled={assignDisabled}>
          <legend>
            Chọn GVPB — {w.policy?.reviewersPerStudent ?? "chờ duyệt"} người/đồ
            án
          </legend>
          {c.candidates.map((candidate) => {
            const l = w.lecturers.find((l) => l.id === candidate.lecturerId);
            return (
              <label key={candidate.lecturerId} className="block">
                <input
                  type="checkbox"
                  checked={chosen.includes(candidate.lecturerId)}
                  disabled={
                    !!candidate.reasons.length &&
                    !chosen.includes(candidate.lecturerId)
                  }
                  onChange={(e) =>
                    setChosen(
                      e.target.checked
                        ? [...chosen, candidate.lecturerId]
                        : chosen.filter((id) => id !== candidate.lecturerId),
                    )
                  }
                />
                {l?.code} · {l?.name ?? candidate.lecturerId} · Tải phản biện{" "}
                {l?.reviewLoad ?? 0}
                {candidate.reasons.length > 0 && (
                  <span>
                    {" "}
                    — {candidate.reasons.map(reviewerReason).join("; ")}
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>
        {!c.candidates.some((l) => !l.reasons.length) && (
          <Notice>
            Không có GVPB hợp lệ theo xung đột, tiêu chuẩn và tải hiện hành.
          </Notice>
        )}
        <Field label="Lý do phân công / điều chỉnh / chốt">
          <textarea
            required
            maxLength={4000}
            value={reason}
            disabled={pending}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={assignDisabled} loading={pending}>
          Lưu dự thảo phản biện
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={assignDisabled || !c.revision || !chosen.length}
          onClick={() => setChosen([])}
        >
          Gỡ các GVPB dự thảo
        </Button>
        <ReviewerReasons values={c.blockers.finalize} />
        <Button
          type="button"
          disabled={
            pending ||
            !!c.blockers.finalize.length ||
            !c.binding ||
            !reason.trim()
          }
          onClick={() => {
            const b = ReviewerFinalizeSchema.safeParse({
              termId: w.termId,
              rosterHash: w.rosterHash,
              reason,
              members: [c.binding],
            });
            if (b.success) finalize(b.data);
          }}
        >
          Chốt phân công phản biện
        </Button>
      </form>
      <h3>Lịch sử phân công</h3>
      {!c.history.length ? (
        <p>Chưa có lịch sử phân công phản biện.</p>
      ) : (
        <ul>
          {c.history.map((h) => (
            <li key={h.id}>
              {reviewerReason(h.action)} · Revision {h.revision} · {h.actor} ·{" "}
              {h.at} · {h.reason}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
export function ReviewerPreview({
  proposal: p,
  workspace: w,
  pending,
  blocked,
  apply,
}: {
  proposal: ReviewerAllocation;
  workspace?: ReviewerWorkspace;
  pending: boolean;
  blocked: boolean;
  apply: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Card title={`Đề xuất phản biện: ${reviewerLabels[p.status]}`}>
      <ReviewerReasons values={p.reasons} />
      <p>Phương án cần Khoa kiểm tra và áp dụng riêng.</p>
      <ul>
        {p.placements.map((c) => (
          <li key={c.termStudentId}>
            {w?.students.find((s) => s.id === c.termStudentId)?.studentCode ??
              "Hồ sơ được chọn"}{" "}
            · {w?.students.find((s) => s.id === c.termStudentId)?.studentName} →{" "}
            {c.reviewerIds
              .map(
                (id) =>
                  w?.lecturers.find((l) => l.id === id)?.name ??
                  "Giảng viên cần đối soát",
              )
              .join(", ")}
          </li>
        ))}
      </ul>
      <p>
        Tải dự kiến:{" "}
        {p.loads
          .map(
            (l) =>
              `${w?.lecturers.find((x) => x.id === l.lecturerId)?.name ?? "Giảng viên trong roster"}: ${l.reviews} phản biện / ${l.total} tổng`,
          )
          .join("; ")}
      </p>
      <Field label="Lý do áp dụng đề xuất">
        <textarea
          value={reason}
          maxLength={4000}
          disabled={pending}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <Button
        disabled={
          blocked ||
          pending ||
          p.status !== "FEASIBLE" ||
          !p.placements.length ||
          !reason.trim()
        }
        onClick={() => apply(reason)}
      >
        Áp dụng thành dự thảo
      </Button>
    </Card>
  );
}
