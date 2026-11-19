import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ScheduleSaveSchema } from "@doan/shared";
import type {
  ScheduleCommand,
  ScheduleProposal,
  ScheduleSave,
  ScheduleSlot,
  ScheduleView,
  ScheduleWorkspace,
} from "@doan/shared";
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
} from "../../../shared/components/kit";
import { eligibilityError } from "../eligibility/components";
import { scheduleApi } from "./api";
export const scheduleLabels: Record<string, string> = {
  DRAFT: "Lịch dự thảo",
  FINALIZED: "Đã chốt, còn hiệu lực",
  STALE: "Nguồn đã thay đổi",
  LEGACY_UNVERIFIED: "Lịch cũ chưa đối soát",
  CANCELLED: "Đã hủy dự thảo",
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
  FEASIBLE: "Có phương án hợp lệ",
  UNSAT: "Không có phương án thỏa ràng buộc",
  SEARCH_LIMIT: "Đã tới giới hạn tìm kiếm",
  BLOCKED: "Chưa đủ điều kiện đề xuất",
  UC21_SCHEMA_REQUIRED: "Cần migration UC21 đã duyệt và kiểm chứng",
  UC21_POLICY_REQUIRED: "Chưa có chính sách lịch bảo vệ được duyệt",
  UC21_NOT_ENABLED: "Nhóm chưa bật ghi UC21",
  UPSTREAM_SCHEMA_REQUIRED: "Cần schema UC17–UC19 đã kiểm chứng",
  UPSTREAM_POLICY_OR_PERMISSION_REQUIRED:
    "Cần policy và quyền đọc nguồn UC18–UC19",
  REVIEWER_ATTENDANCE_PENDING_APPROVAL: "Chưa duyệt yêu cầu GVPB tham dự",
  UC20_CURRENT_REVIEWERS_REQUIRED:
    "Cần phân công UC20 đã chốt còn hiệu lực theo policy tham dự",
  DEFENSE_PHASE_REQUIRED: "Cần giai đoạn bảo vệ được cấu hình và chưa khóa",
  UC19_CURRENT_COMMITTEE_REQUIRED: "Cần hội đồng UC19 đã chốt còn hiệu lực",
  ROOM_NOT_ALLOWED: "Phòng chưa được cho phép hoặc thiếu sức chứa",
  ROOM_CHANGED: "Thông tin phòng đã thay đổi",
  SCHEDULE_PROVENANCE_UNVERIFIED: "Chưa xác minh được lịch sử phiên",
  GLOBAL_SCHEDULE_PROVENANCE_UNVERIFIED:
    "Có lịch hiện hữu chưa xác minh được nguồn, cần đối soát",
  LEGACY_RECONCILIATION_REQUIRED: "Lịch legacy cần đối soát riêng",
  SCHEDULE_POLICY_CHANGED: "Chính sách lịch đã thay đổi",
  SCHEDULE_SOURCE_CHANGED: "Nguồn UC18/UC19/UC20 đã thay đổi",
  SCHEDULE_GEOMETRY_CHANGED: "Thứ tự hoặc thời gian không còn khớp nguồn",
  SCHEDULE_IMMUTABLE: "Chỉ được điều chỉnh lịch dự thảo",
  FACULTY_PERMISSION_REQUIRED: "Cần quyền tương ứng của Khoa",
  PERSONAL_READ_ONLY: "Chỉ xem lịch cá nhân đã công bố",
  ROOM_CONFLICT: "Trùng phòng",
  COMMITTEE_CONFLICT: "Trùng lịch hội đồng",
  LECTURER_CONFLICT: "Trùng lịch thành viên/GVPB tham dự",
  STUDENT_CONFLICT: "Trùng lịch sinh viên",
  PROPOSAL_ALREADY_SCHEDULED: "Hồ sơ đã có lượt bảo vệ khác",
  DATE_NOT_APPROVED: "Ngày chưa được phê duyệt",
  OUTSIDE_SESSION_WINDOW: "Giờ bắt đầu ngoài cửa sổ buổi",
  SESSION_OVERFLOW: "Không đủ thời gian buổi",
  SESSION_CAPACITY_EXCEEDED: "Vượt số sinh viên được duyệt",
  OUTSIDE_DEFENSE_PHASE: "Lịch nằm ngoài giai đoạn bảo vệ/đợt",
  MANUAL_ORDER_NOT_APPROVED: "Chưa cho phép ngoại lệ thứ tự thủ công",
  FINALIZED_UNPUBLISHED_REQUIRED: "Cần lịch đã chốt và chưa công bố",
  PUBLICATION_NOT_OPEN: "Chưa đến thời điểm được công bố",
  SCHEDULE_SAVED: "Lưu/điều chỉnh dự thảo",
  SCHEDULE_FINALIZED: "Chốt lịch",
  SCHEDULE_PUBLISHED: "Công bố lịch",
  SCHEDULE_CANCELLED: "Hủy dự thảo",
  STUDENT_IDENTITY_REQUIRED: "Chưa khớp định danh sinh viên",
  FINALIZATION_PROVENANCE_REQUIRED: "Chưa xác minh được thông tin chốt",
};
export const scheduleReason = (v: string) =>
  scheduleLabels[v.split(":")[0]] ?? v;
export function ScheduleReasons({ values }: { values: string[] }) {
  return values.length ? (
    <Notice>{[...new Set(values)].map(scheduleReason).join("; ")}</Notice>
  ) : null;
}
export const vietnamTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
export function ScheduleSlots({ slots }: { slots: ScheduleSlot[] }) {
  return !slots.length ? (
    <Empty title="Chưa có các lượt bảo vệ được xác minh" />
  ) : (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th>Thứ tự</th>
          <th>Sinh viên</th>
          <th>Giờ bắt đầu</th>
          <th>Giờ kết thúc</th>
        </tr>
      </thead>
      <tbody>
        {slots.map((s) => (
          <tr key={s.termStudentId}>
            <td>{s.order}</td>
            <td>
              {s.studentCode} · {s.studentName}
            </td>
            <td>{vietnamTime(s.startAt)}</td>
            <td>{vietnamTime(s.endAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function ScheduleRows({
  items,
  select,
}: {
  items: ScheduleView[];
  select: (id: string) => void;
}) {
  return !items.length ? (
    <Empty title="Không có lịch trong phạm vi/bộ lọc" />
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Ngày / Buổi</th>
            <th>Hội đồng</th>
            <th>Phòng</th>
            <th>Giờ</th>
            <th>Trạng thái</th>
            <th>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>
                {s.date} · {scheduleLabels[s.period] ?? s.period}
              </td>
              <td>{s.committeeCode}</td>
              <td>{s.roomName}</td>
              <td>
                {vietnamTime(s.startAt)} –{" "}
                {s.endAt ? vietnamTime(s.endAt) : "Chưa đối soát"}
              </td>
              <td>
                {scheduleLabels[s.state]} ·{" "}
                {s.publishedAt ? "Đã công bố" : "Chưa công bố"}
              </td>
              <td>
                <Button variant="secondary" onClick={() => select(s.id)}>
                  Xem lịch
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ScheduleEditor({
  workspace: w,
  current: c,
  pending,
  save,
}: {
  workspace: ScheduleWorkspace;
  current?: ScheduleView;
  pending: boolean;
  save: (id: string | null, b: ScheduleSave) => void;
}) {
  const [committeeId, setCommittee] = useState(
      c?.committeeId ?? w.sources[0]?.committeeId ?? "",
    ),
    [roomId, setRoom] = useState(c?.roomId ?? w.rooms[0]?.id ?? ""),
    [date, setDate] = useState(c?.date ?? w.policy?.allowedDates[0] ?? ""),
    [period, setPeriod] = useState<"MORNING" | "AFTERNOON">(
      c?.period === "AFTERNOON" ? "AFTERNOON" : "MORNING",
    ),
    [startTime, setStart] = useState(
      c?.startTime ?? w.policy?.periods.MORNING.start ?? "",
    ),
    [chosen, setChosen] = useState(c?.slots.map((s) => s.termStudentId) ?? []),
    [reason, setReason] = useState(""),
    [manual, setManual] = useState(c?.manualOrder ?? false),
    [error, setError] = useState("");
  const source = w.sources.find((s) => s.committeeId === committeeId),
    blocks = c
      ? c.blockers.update
      : [
          ...w.blockers,
          ...(!w.permissions.create ? ["FACULTY_PERMISSION_REQUIRED"] : []),
        ];
  const body = {
    termId: w.termId,
    rosterHash: w.rosterHash,
    expectedRevision: c?.revision ?? 0,
    reason,
    ...(source
      ? {
          committeeId: source.committeeId,
          committeeRevision: source.committeeRevision,
          committeeEvidenceHash: source.committeeEvidenceHash,
          sourceHash: source.sourceHash,
        }
      : {}),
    roomId,
    date,
    period,
    startTime,
    termStudentIds: chosen,
    ...(manual ? { manualOrder: chosen } : {}),
  };
  const identity = JSON.stringify({ ...body, reason: "" });
  const preview = useMutation({
    mutationFn: async () => {
      const parsed = ScheduleSaveSchema.parse({
        ...body,
        reason: reason.trim() || "Xem trước lịch chưa lưu",
      });
      return {
        identity,
        result: await scheduleApi.preview(c?.id ?? null, parsed),
      };
    },
  });
  const result =
    preview.data?.identity === identity ? preview.data.result : undefined;
  return (
    <Card title={c ? "Điều chỉnh dự thảo" : "Tạo lịch dự thảo"}>
      <ScheduleReasons values={blocks} />
      {error && <Notice>{error}</Notice>}
      {preview.error && <Notice>{eligibilityError(preview.error)}</Notice>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = ScheduleSaveSchema.safeParse(body);
          if (!parsed.success) {
            setError(
              "Cần chọn nguồn, phòng, sinh viên, ngày/buổi/giờ và nhập lý do.",
            );
            return;
          }
          if (!result || result.issues.length) {
            setError("Cần xem trước lịch hiện hành và xử lý xung đột.");
            return;
          }
          setError("");
          save(c?.id ?? null, parsed.data);
        }}
      >
        <fieldset disabled={pending || !!blocks.length}>
          <Field label="Hội đồng đã chốt">
            <select
              value={committeeId}
              onChange={(e) => {
                setCommittee(e.target.value);
                setChosen([]);
              }}
            >
              {!w.sources.length && (
                <option value="">Chưa có hội đồng đủ nguồn</option>
              )}
              {w.sources.map((s) => (
                <option key={s.committeeId} value={s.committeeId}>
                  {s.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phòng bảo vệ">
            <select value={roomId} onChange={(e) => setRoom(e.target.value)}>
              {!w.rooms.length && (
                <option value="">Chưa có phòng được duyệt</option>
              )}
              {w.rooms
                .filter(
                  (r) =>
                    !source || r.departmentIds.includes(source.departmentId),
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} · {r.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Ngày bảo vệ được phép">
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {w.policy?.allowedDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Buổi">
            <select
              value={period}
              onChange={(e) => {
                const p = e.target.value as "MORNING" | "AFTERNOON";
                setPeriod(p);
                setStart(w.policy?.periods[p].start ?? "");
              }}
            >
              <option value="MORNING">Sáng</option>
              <option value="AFTERNOON">Chiều</option>
            </select>
          </Field>
          <Field label="Giờ bắt đầu (giờ Việt Nam)">
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <p>Thứ tự tự động: Tên → Họ đệm → Họ → mã sinh viên.</p>
          <ScheduleReasons values={source?.issues ?? []} />
          {source?.students.map((s) => (
            <label className="block" key={s.termStudentId}>
              <input
                type="checkbox"
                checked={chosen.includes(s.termStudentId)}
                onChange={(e) =>
                  setChosen(
                    e.target.checked
                      ? [...chosen, s.termStudentId]
                      : chosen.filter((id) => id !== s.termStudentId),
                  )
                }
              />
              {s.studentCode} · {s.studentName}
            </label>
          ))}
          {w.policy?.manualOrderAllowed && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={manual}
                  onChange={(e) => setManual(e.target.checked)}
                />
                Ngoại lệ điều chỉnh thứ tự — cần lý do khi lưu
              </label>
              {manual && (
                <ol>
                  {chosen.map((id, i) => (
                    <li key={id}>
                      {
                        source?.students.find((s) => s.termStudentId === id)
                          ?.studentName
                      }
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!i}
                        onClick={() =>
                          setChosen((ids) => {
                            const next = [...ids];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            return next;
                          })
                        }
                      >
                        Lên
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          <Field label="Lý do tạo / điều chỉnh">
            <textarea
              value={reason}
              maxLength={4000}
              required
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </fieldset>
        <Button
          type="button"
          variant="secondary"
          disabled={
            pending ||
            preview.isPending ||
            !w.policy ||
            !source ||
            !chosen.length
          }
          onClick={() => preview.mutate()}
        >
          Xem trước giờ và thứ tự
        </Button>
        {preview.isPending && <Notice>Đang kiểm tra lịch…</Notice>}
        {result && (
          <>
            <ScheduleSlots slots={result.slots} />
            <ScheduleReasons values={result.issues} />
          </>
        )}
        <Button
          type="submit"
          disabled={
            pending ||
            !!blocks.length ||
            !result ||
            !!result.issues.length ||
            !reason.trim()
          }
          loading={pending}
        >
          Lưu lịch dự thảo
        </Button>
      </form>
    </Card>
  );
}
export function ScheduleDetail({
  workspace: w,
  schedule: c,
  pending,
  transition,
}: {
  workspace: ScheduleWorkspace;
  schedule: ScheduleView;
  pending: boolean;
  transition: (
    action: "finalize" | "publish" | "cancel",
    b: ScheduleCommand,
  ) => void;
}) {
  const [reason, setReason] = useState("");
  const body: ScheduleCommand = {
    termId: w.termId,
    rosterHash: w.rosterHash,
    reason,
    members: [
      { id: c.id, expectedRevision: c.revision, evidenceHash: c.evidenceHash },
    ],
  };
  return (
    <Card
      title={`${c.committeeCode} · ${c.date} · ${scheduleLabels[c.period] ?? c.period}`}
    >
      <p>
        {c.roomName} · Giờ Việt Nam · {scheduleLabels[c.state]}
      </p>
      <ScheduleReasons values={c.issues} />
      <ScheduleSlots slots={c.slots} />
      <p>
        Chốt bởi {c.finalizedBy ?? "Chưa chốt"} · {c.finalizedAt ?? ""} · Phiên
        bản {c.revision}
      </p>
      <p>Công bố: {c.publishedAt ?? "Chưa công bố"}</p>
      {w.mode === "FACULTY" && (
        <>
          <Field label="Lý do chốt / công bố / hủy dự thảo">
            <textarea
              value={reason}
              maxLength={4000}
              disabled={pending}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {(["finalize", "publish", "cancel"] as const).map((a) => (
            <div key={a}>
              <ScheduleReasons
                values={a === "cancel" ? c.blockers.update : c.blockers[a]}
              />
              <Button
                disabled={
                  pending ||
                  !reason.trim() ||
                  !!(a === "cancel" ? c.blockers.update : c.blockers[a]).length
                }
                variant={a === "cancel" ? "danger" : "primary"}
                onClick={() => transition(a, body)}
              >
                {a === "finalize"
                  ? "Chốt lịch"
                  : a === "publish"
                    ? "Công bố lịch"
                    : "Hủy lịch dự thảo"}
              </Button>
            </div>
          ))}
          <h3>Lịch sử</h3>
          <ul>
            {c.history.map((h) => (
              <li key={h.id}>
                {scheduleReason(h.action)} · {h.actor} · {h.at} · Phiên bản{" "}
                {h.revision} · {h.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
export function ScheduleProposalPreview({
  workspace: w,
  proposal: p,
  pending,
  apply,
}: {
  workspace: ScheduleWorkspace;
  proposal: ScheduleProposal;
  pending: boolean;
  apply: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Card title={`Đề xuất lịch: ${scheduleLabels[p.status]}`}>
      <ScheduleReasons values={p.reasons} />
      <p>Chưa lưu. Khoa xem trước và áp dụng riêng.</p>
      {p.previews.map((s, i) => (
        <div key={i}>
          <p>
            {w.sources.find((c) => c.committeeId === s.committeeId)?.code} ·{" "}
            {w.rooms.find((r) => r.id === s.roomId)?.name} · {s.date} ·{" "}
            {scheduleLabels[s.period]}
          </p>
          <ScheduleSlots slots={s.slots} />
        </div>
      ))}
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
          pending ||
          p.status !== "FEASIBLE" ||
          !p.sessions.length ||
          !!w.blockers.length ||
          !w.permissions.create ||
          !reason.trim() ||
          p.rosterHash !== w.rosterHash
        }
        onClick={() => apply(reason)}
      >
        Áp dụng thành lịch dự thảo
      </Button>
    </Card>
  );
}
