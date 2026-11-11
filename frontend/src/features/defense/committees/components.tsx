import { useState } from "react";
import { CommitteeSaveSchema } from "@doan/shared";
import type {
  CommitteeAllocation,
  CommitteeMemberInput,
  CommitteeSave,
  CommitteeView,
  CommitteeWorkspace,
} from "@doan/shared";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
} from "../../../shared/components/kit";
export const committeeLabels: Record<string, string> = {
  UC17_UC18_POLICY_REQUIRED: "Cần chính sách UC17–UC18 đã được duyệt",
  EMPTY_COMMITTEE_NOT_ALLOWED:
    "Chính sách chưa cho chốt hội đồng chưa có sinh viên",
  DRAFT: "Bản dự thảo",
  FINALIZED: "Đã chốt, còn hiệu lực",
  STALE: "Nguồn đã thay đổi, cần xử lý",
  LEGACY_UNVERIFIED: "Hội đồng cũ chưa đối soát",
  CHAIR: "Chủ tịch",
  SECRETARY: "Thư ký",
  MEMBER: "Ủy viên",
  FEASIBLE: "Có phương án hợp lệ",
  UNSAT: "Không có phương án thỏa ràng buộc",
  SEARCH_LIMIT: "Chưa tìm được phương án trong giới hạn tìm kiếm",
  BLOCKED: "Chưa đủ nguồn để đề xuất",
  UC19_NOT_ENABLED: "Nhóm chưa bật ghi UC19",
  UC19_SCHEMA_REQUIRED: "Cần migration UC19 đã duyệt và kiểm chứng",
  UC19_POLICY_REQUIRED: "Chưa có chính sách hội đồng được duyệt",
  UC17_UC18_SCHEMA_REQUIRED: "Cần schema và nguồn UC17–UC18 đã kiểm chứng",
  UC18_READ_PERMISSION_REQUIRED: "Cần quyền đọc nguồn UC18 của Khoa",
  FACULTY_PERMISSION_REQUIRED: "Cần quyền tương ứng của Khoa",
  COMMITTEE_FINALIZED: "Hội đồng đã chốt; chưa có quy trình mở lại được duyệt",
  COMMITTEE_SIZE_3_TO_5: "Hội đồng chính thức phải có 3–5 người",
  DUPLICATE_MEMBER: "Trùng thành viên",
  INVALID_MEMBER_ROLE: "Vai trò thành viên không hợp lệ",
  OFFICER_COUNTS_REQUIRED: "Chưa đủ cơ cấu Chủ tịch/Thư ký theo chính sách",
  MEMBER_NOT_QUALIFIED_OR_ROSTER:
    "Thành viên chưa đủ tiêu chuẩn hoặc không thuộc roster kỳ",
  COMMITTEE_STUDENT_LOAD_EXCEEDED: "Vượt số sinh viên/hội đồng đã duyệt",
  LECTURER_COMMITTEE_LOAD_EXCEEDED: "Giảng viên vượt số hội đồng được duyệt",
  LECTURER_STUDENT_LOAD_EXCEEDED: "Giảng viên vượt tải sinh viên được duyệt",
  ADVISOR_CONFLICT: "GVHD trùng một trong tất cả thành viên hội đồng",
  ELIGIBILITY_NOT_CURRENT: "Sinh viên chưa có UC18 đã chốt và còn hiệu lực",
  SOURCE_CHANGED: "Chứng cứ UC18/GVHD đã thay đổi",
  STUDENT_DEPARTMENT_MISMATCH: "Sinh viên khác bộ môn hội đồng",
  LEGACY_RECONCILIATION_REQUIRED: "Hội đồng legacy cần đối soát riêng",
  COMMITTEE_PROVENANCE_REQUIRED: "Thiếu lịch sử xác minh hội đồng",
  COMMITTEE_CREATED: "Tạo hội đồng",
  COMMITTEE_UPDATED: "Sửa hội đồng",
  COMMITTEE_STUDENTS_ASSIGNED: "Phân/chuyển sinh viên",
  COMMITTEE_STUDENT_REMOVED: "Gỡ sinh viên theo yêu cầu",
  LEGACY_SESSION_ASSIGNMENT_RECONCILIATION_REQUIRED:
    "Sinh viên đã có phân công phiên cũ; cần đối soát",
};
export const committeeReason = (code: string) =>
  committeeLabels[code.split(":")[0]] ?? code;
export function CommitteeReasons({ values }: { values: string[] }) {
  return values.length ? (
    <Notice>{values.map(committeeReason).join("; ")}</Notice>
  ) : null;
}
export function CommitteeRows({
  items,
  select,
}: {
  items: CommitteeView[];
  select: (id: string) => void;
}) {
  if (!items.length)
    return <Empty title="Không có hội đồng trong phạm vi/bộ lọc" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Mã / Tên</th>
            <th>Thành viên</th>
            <th>Sinh viên</th>
            <th>Trạng thái</th>
            <th>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                {c.code ?? "Chưa đối soát"} · {c.name}
              </td>
              <td>{c.members.length}</td>
              <td>{c.students.length}</td>
              <td>{committeeLabels[c.state]}</td>
              <td>
                <Button variant="secondary" onClick={() => select(c.id)}>
                  Xem hội đồng
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function CommitteeEditor({
  workspace: w,
  committee: c,
  pending,
  submit,
}: {
  workspace: CommitteeWorkspace;
  committee?: CommitteeView;
  pending: boolean;
  submit: (id: string | null, b: CommitteeSave) => void;
}) {
  const [members, setMembers] = useState<CommitteeMemberInput[]>(
      c?.members.map((m) => ({ lecturerId: m.lecturerId, role: m.role })) ?? [],
    ),
    [error, setError] = useState("");
  const blocks = c
    ? c.blockers.update
    : [
        ...w.blockers,
        ...(!w.permissions.create ? ["FACULTY_PERMISSION_REQUIRED"] : []),
      ];
  return (
    <Card title={c ? "Điều chỉnh hội đồng chưa chốt" : "Tạo hội đồng"}>
      <CommitteeReasons values={blocks} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            parsed = CommitteeSaveSchema.safeParse({
              termId: w.termId,
              expectedRevision: c?.revision ?? 0,
              rosterHash: w.rosterHash,
              reason: f.get("reason"),
              code: f.get("code"),
              name: f.get("name"),
              departmentId: f.get("departmentId"),
              members,
            });
          if (!parsed.success) {
            setError(
              "Nhập đầy đủ mã/tên/bộ môn/lý do và không chọn trùng giảng viên.",
            );
            return;
          }
          setError("");
          submit(c?.id ?? null, parsed.data);
        }}
      >
        <fieldset disabled={pending || !!blocks.length}>
          <Field label="Mã hội đồng">
            <input
              name="code"
              required
              maxLength={50}
              defaultValue={c?.code ?? ""}
            />
          </Field>
          <Field label="Tên hội đồng">
            <input
              name="name"
              required
              maxLength={255}
              defaultValue={c?.name ?? ""}
            />
          </Field>
          <Field label="Bộ môn">
            <select
              name="departmentId"
              required
              defaultValue={c?.departmentId ?? ""}
            >
              <option value="">Chọn bộ môn</option>
              {w.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          {members.map((m, i) => (
            <div key={i} className="flex gap-2">
              <label>
                Giảng viên
                <select
                  aria-label={`Giảng viên ${i + 1}`}
                  value={m.lecturerId}
                  onChange={(e) =>
                    setMembers((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, lecturerId: e.target.value } : x,
                      ),
                    )
                  }
                >
                  <option value="">Chọn giảng viên</option>
                  {w.lecturers.map((l) => (
                    <option
                      key={l.id}
                      value={l.id}
                      disabled={!l.active || !l.inRoster}
                    >
                      {l.code} — {l.name} · {l.committeeLoad} hội đồng /{" "}
                      {l.studentLoad} SV
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chức vụ
                <select
                  aria-label={`Chức vụ ${i + 1}`}
                  value={m.role}
                  onChange={(e) =>
                    setMembers((prev) =>
                      prev.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              role: e.target
                                .value as CommitteeMemberInput["role"],
                            }
                          : x,
                      ),
                    )
                  }
                >
                  {["CHAIR", "SECRETARY", "MEMBER"].map((r) => (
                    <option key={r} value={r}>
                      {committeeLabels[r]}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setMembers((prev) => prev.filter((_, j) => j !== i))
                }
              >
                Xóa thành viên
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={members.length >= 5}
            onClick={() =>
              setMembers((prev) => [
                ...prev,
                { lecturerId: "", role: "MEMBER" },
              ])
            }
          >
            Thêm thành viên
          </Button>
          <p>
            Chính thức: 3–5 giảng viên. Cơ cấu chức vụ, tiêu chuẩn và giới hạn
            tải lấy từ chính sách đã duyệt.
          </p>
          <Field label="Lý do tạo/điều chỉnh">
            <textarea name="reason" required maxLength={4000} />
          </Field>
          <Button type="submit">{pending ? "Đang lưu…" : "Lưu dự thảo"}</Button>
        </fieldset>
      </form>
      {error && <Notice>{error}</Notice>}
    </Card>
  );
}
export function CommitteeDetail({
  committee: c,
  pending,
  finalize,
  unassign,
}: {
  committee: CommitteeView;
  pending: boolean;
  finalize: (reason: string) => void;
  unassign: (id: string, revision: number, reason: string) => void;
}) {
  return (
    <Card title={`${c.code ?? "Legacy"} — ${c.name}`}>
      <p>
        {committeeLabels[c.state]} · Phiên bản {c.revision} · {c.members.length}{" "}
        giảng viên / {c.students.length} sinh viên.
      </p>
      <CommitteeReasons values={c.issues} />
      <ul>
        {c.members.map((m) => (
          <li key={m.lecturerId}>
            {m.name} — {committeeLabels[m.role]}
            {!m.valid && " · Chưa hợp lệ"}
          </li>
        ))}
      </ul>
      <ul>
        {c.students.map((s) => (
          <li key={s.termStudentId}>
            {s.studentCode} — {s.studentName} · GVHD:{" "}
            {s.advisorName ?? "Chưa xác minh"}
            <CommitteeReasons values={s.blockers} />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                unassign(
                  s.termStudentId,
                  s.revision,
                  String(new FormData(e.currentTarget).get("reason") ?? ""),
                );
              }}
            >
              <input
                name="reason"
                aria-label={`Lý do gỡ ${s.studentCode}`}
                required
                maxLength={4000}
                placeholder="Lý do gỡ sinh viên"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={pending || !!c.blockers.assign.length}
              >
                Gỡ theo yêu cầu
              </Button>
            </form>
          </li>
        ))}
      </ul>
      {!c.students.length && <p>Chưa phân sinh viên.</p>}
      <CommitteeReasons values={c.blockers.finalize} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          finalize(String(new FormData(e.currentTarget).get("reason") ?? ""));
        }}
      >
        <Field label="Lý do chốt hội đồng">
          <textarea name="reason" required maxLength={4000} />
        </Field>
        <Button
          type="submit"
          disabled={pending || !!c.blockers.finalize.length}
        >
          Chốt hội đồng
        </Button>
      </form>
      {c.downstream && (
        <Notice>
          Hội đồng đã chốt, nguồn còn hiệu lực tại lần kiểm tra này.
        </Notice>
      )}
      <ul aria-label="Lịch sử hội đồng">
        {c.history.map((h) => (
          <li key={h.id}>
            {h.at} · {committeeReason(h.action)} · {h.actor} · {h.reason}
          </li>
        ))}
      </ul>
    </Card>
  );
}
export function AllocationPreview({
  proposal: p,
  w,
  pending,
  apply,
}: {
  proposal: CommitteeAllocation;
  w: CommitteeWorkspace;
  pending: boolean;
  apply: (reason: string) => void;
}) {
  return (
    <Card title={`Đề xuất: ${committeeLabels[p.status]}`}>
      <p>
        Đề xuất chưa được lưu thành phân công. Kiểm tra lại trước khi áp dụng.
      </p>
      <CommitteeReasons values={p.reasons} />
      <ul>
        {p.placements.map((a) => (
          <li key={a.termStudentId}>
            {w.candidates.find((c) => c.termStudentId === a.termStudentId)
              ?.studentCode ?? "Hồ sơ"}{" "}
            →{" "}
            {w.committees.find((c) => c.id === a.committeeId)?.name ??
              "Hội đồng"}
          </li>
        ))}
      </ul>
      <ul>
        {p.loads.map((l) => (
          <li key={l.committeeId}>
            {w.committees.find((c) => c.id === l.committeeId)?.name}:{" "}
            {l.students} sinh viên
          </li>
        ))}
      </ul>
      <CommitteeReasons values={w.blockers} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(String(new FormData(e.currentTarget).get("reason") ?? ""));
        }}
      >
        <Field label="Lý do áp dụng đề xuất">
          <textarea name="reason" required maxLength={4000} />
        </Field>
        <Button
          type="submit"
          disabled={
            pending ||
            p.status !== "FEASIBLE" ||
            !p.placements.length ||
            !!w.blockers.length ||
            !w.permissions.assign ||
            p.rosterHash !== w.rosterHash
          }
        >
          Áp dụng phân công dự thảo
        </Button>
      </form>
    </Card>
  );
}
