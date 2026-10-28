import { HttpException } from "@nestjs/common";
import type {
  CommitteePlan,
  ReviewerPlan,
  ScheduleSlot,
  PlanningIssue,
  PlanningContext,
} from "@doan/shared";

export function planningError(
  status: number,
  code: string,
  message: string,
): never {
  throw new HttpException({ error: { code, message } }, status);
}
export const PLANNING_BLOCKERS: PlanningIssue[] = [
  {
    code: "OFFICIAL_WORKFLOW_REQUIRED",
    message:
      "Đây là API preview. Dùng panel workflow server để tải policy/capability, lưu draft và chốt/công bố theo nguồn UC18 V2 hiện hành.",
  },
];
type Facts = Pick<
  PlanningContext,
  "students" | "lecturers" | "rooms" | "term" | "source"
>;
export type BusySlot = {
  startsAt: string;
  endsAt: string;
  roomId: string;
  lecturerIds: string[];
  proposalIds: string[];
  studentIds?: string[];
};
const add = (
  rows: PlanningIssue[],
  code: string,
  message: string,
  target?: string,
) => rows.push({ code, message, ...(target ? { target } : {}) });
const duplicate = (ids: string[]) => ids.length !== new Set(ids).size;

export function checkCommittees(facts: Facts, committees: CommitteePlan[]) {
  const issues: PlanningIssue[] = [],
    warnings: PlanningIssue[] = [];
  const proposals = new Map(
    facts.students.filter((s) => s.proposalId).map((s) => [s.proposalId!, s]),
  );
  const lecturerIds = new Set(facts.lecturers.map((l) => l.id));
  if (duplicate(committees.map((c) => c.key)))
    add(issues, "DUPLICATE_COMMITTEE", "Mã phương án hội đồng bị trùng.");
  if (duplicate(committees.map((c) => c.name.trim().toLocaleLowerCase("vi"))))
    add(
      warnings,
      "DUPLICATE_COMMITTEE_NAME",
      "Tên hội đồng bị trùng; dùng mã dòng phân biệt khi đối soát.",
    );
  const allocated = new Set<string>();
  for (const c of committees) {
    if (c.members.length < 3 || c.members.length > 5)
      add(
        issues,
        "COMMITTEE_MEMBER_COUNT",
        "Đặc tả UC19 yêu cầu 3–5 giảng viên/hội đồng.",
        c.key,
      );
    if (duplicate(c.members.map((m) => m.lecturerId)))
      add(
        issues,
        "DUPLICATE_MEMBER",
        "Một giảng viên không giữ hai vị trí trong cùng hội đồng.",
        c.key,
      );
    for (const role of ["CHAIR", "SECRETARY"]) {
      const count = c.members.filter((m) => m.role === role).length;
      if (count < 1)
        add(
          issues,
          "COMMITTEE_ROLE_REQUIRED",
          "Cần có Chủ tịch và Thư ký phân biệt trong phương án.",
          c.key,
        );
      if (count > 1)
        add(
          warnings,
          "ROLE_MULTIPLICITY_NEEDS_POLICY",
          "Có nhiều người cùng chức danh Chủ tịch/Thư ký; cần xác nhận quy tắc cơ cấu trước khi chốt chính thức.",
          c.key,
        );
    }
    for (const m of c.members)
      if (!lecturerIds.has(m.lecturerId))
        add(
          issues,
          "LECTURER_OUT_OF_TERM",
          "Giảng viên không hoạt động/không thuộc roster đợt.",
          c.key,
        );
    for (const id of c.proposalIds) {
      const student = proposals.get(id);
      if (allocated.has(id))
        add(
          issues,
          "DUPLICATE_STUDENT_ALLOCATION",
          "Một hồ sơ bị phân nhiều lần trong phương án.",
          c.key,
        );
      allocated.add(id);
      if (!student) {
        add(
          issues,
          "PROPOSAL_OUT_OF_SCOPE",
          "Hồ sơ không thuộc nguồn danh sách được phép sử dụng.",
          c.key,
        );
        continue;
      }
      if (facts.source.kind === "UC18_FINALIZED" && student.admitted !== true)
        add(
          issues,
          "NOT_ADMITTED_BY_UC18",
          "Hồ sơ không thuộc tập sinh viên được UC18 cho phép bảo vệ.",
          c.key,
        );
      if (!student.advisor)
        add(
          issues,
          "OFFICIAL_ADVISOR_UNKNOWN",
          "Chưa xác minh được GVHD chính thức hiện hành.",
          c.key,
        );
      if (
        student.advisor &&
        c.members.some((m) => m.lecturerId === student.advisor!.id)
      )
        add(
          issues,
          "ADVISOR_COMMITTEE_CONFLICT",
          "GVHD không được ở hội đồng chấm sinh viên mình hướng dẫn.",
          c.key,
        );
      if (student.evidence === "STALE" || student.evidence === "UNKNOWN")
        add(
          warnings,
          "SOURCE_EVIDENCE_NEEDS_REVIEW",
          "Cần đối soát bằng chứng hiện hành với bản chốt; preview không sửa UC18.",
          c.key,
        );
    }
    if (c.maxStudents !== undefined && c.proposalIds.length > c.maxStudents)
      add(
        issues,
        "ASSUMED_CAPACITY_EXCEEDED",
        "Số hồ sơ vượt sức chứa giả định do người lập phương án nhập.",
        c.key,
      );
    if (c.maxStudents === undefined)
      add(
        warnings,
        "COMMITTEE_CAPACITY_UNCONFIGURED",
        "Chưa có giới hạn sinh viên/hội đồng được xác nhận; không tự đặt số mặc định.",
        c.key,
      );
  }
  if (!committees.length)
    add(warnings, "COMMITTEE_PLAN_EMPTY", "Phương án chưa có hội đồng.");
  const unallocated = facts.students.filter(
    (s) =>
      s.proposalId &&
      (facts.source.kind !== "UC18_FINALIZED" || s.admitted) &&
      !allocated.has(s.proposalId),
  );
  if (unallocated.length)
    add(
      warnings,
      "UNALLOCATED_STUDENTS",
      `Còn ${unallocated.length} hồ sơ trong nguồn chưa được phân vào phương án.`,
    );
  return { issues, warnings };
}

export function checkReviewers(
  facts: Facts,
  committees: CommitteePlan[],
  reviewers: ReviewerPlan[],
) {
  const result = checkCommittees(facts, committees);
  const allocated = new Set(committees.flatMap((c) => c.proposalIds));
  const students = new Map(facts.students.map((s) => [s.proposalId, s]));
  const lecturers = new Set(facts.lecturers.map((l) => l.id));
  if (duplicate(reviewers.map((r) => r.proposalId)))
    add(
      result.issues,
      "DUPLICATE_REVIEWER_ROW",
      "Hồ sơ bị lặp trong phương án phản biện.",
    );
  const workload = new Map<string, number>();
  for (const r of reviewers) {
    if (!allocated.has(r.proposalId))
      add(
        result.issues,
        "REVIEWER_WITHOUT_COMMITTEE",
        "Cần phân hồ sơ vào hội đồng trong phương án trước.",
        r.proposalId,
      );
    if (duplicate(r.reviewerIds))
      add(
        result.issues,
        "DUPLICATE_REVIEWER",
        "Phân công phản biện bị trùng.",
        r.proposalId,
      );
    const s = students.get(r.proposalId);
    if (!s)
      add(
        result.issues,
        "PROPOSAL_OUT_OF_SCOPE",
        "Hồ sơ không thuộc nguồn dữ liệu đợt.",
        r.proposalId,
      );
    if (!s?.advisor)
      add(
        result.issues,
        "OFFICIAL_ADVISOR_UNKNOWN",
        "Không được đoán GVHD khi kiểm tra xung đột phản biện.",
        r.proposalId,
      );
    for (const id of r.reviewerIds) {
      if (!lecturers.has(id))
        add(
          result.issues,
          "REVIEWER_OUT_OF_TERM",
          "GVPB không hoạt động/không thuộc roster đợt.",
          r.proposalId,
        );
      if (s?.advisor?.id === id)
        add(
          result.issues,
          "ADVISOR_REVIEWER_CONFLICT",
          "GVHD không được phản biện sinh viên mình hướng dẫn.",
          r.proposalId,
        );
      workload.set(id, (workload.get(id) ?? 0) + 1);
    }
  }
  for (const id of allocated)
    if (!reviewers.some((r) => r.proposalId === id && r.reviewerIds.length))
      add(
        result.warnings,
        "REVIEWER_MISSING",
        "Chưa có GVPB trong phương án cho hồ sơ.",
        id,
      );
  add(
    result.warnings,
    "REVIEWER_CARDINALITY_UNCONFIRMED",
    "Chỉ kiểm tra trùng và xung đột; không tự đặt số GVPB hoặc ngưỡng tải tối đa.",
  );
  return {
    ...result,
    workload: [...workload].map(([lecturerId, count]) => ({
      lecturerId,
      count,
    })),
  };
}

export function checkSchedule(
  facts: Facts,
  committees: CommitteePlan[],
  reviewers: ReviewerPlan[],
  slots: ScheduleSlot[],
  includeReviewers: boolean,
  busy: BusySlot[],
) {
  const result = checkReviewers(facts, committees, reviewers);
  const roomById = new Map(facts.rooms.map((r) => [r.id, r]));
  const committeeById = new Map(committees.map((c) => [c.key, c]));
  const allowedLecturers = new Set(facts.lecturers.map((l) => l.id));
  const attendees = (slot: ScheduleSlot) =>
    new Set(
      [
        ...(committeeById
          .get(slot.committeeKey)
          ?.members.map((m) => m.lecturerId) ?? []),
        ...(includeReviewers
          ? (reviewers.find((r) => r.proposalId === slot.proposalId)
              ?.reviewerIds ?? [])
          : []),
      ].filter((id) => allowedLecturers.has(id)),
    );
  const valid: ScheduleSlot[] = [];
  if (duplicate(slots.map((s) => s.key)))
    add(result.issues, "DUPLICATE_SLOT", "Mã dòng lịch bị trùng.");
  if (duplicate(slots.map((s) => s.proposalId)))
    add(
      result.issues,
      "DUPLICATE_STUDENT_SLOT",
      "Hồ sơ có nhiều dòng bảo vệ trong cùng phương án.",
    );
  const overlap = (a: number, b: number, c: number, d: number) =>
    a < d && c < b;
  for (const slot of slots) {
    const a = Date.parse(slot.startsAt),
      b = Date.parse(slot.endsAt),
      c = committeeById.get(slot.committeeKey),
      room = roomById.get(slot.roomId);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) {
      add(
        result.issues,
        "SCHEDULE_TIME_INVALID",
        "Giờ kết thúc phải sau giờ bắt đầu.",
        slot.key,
      );
      continue;
    }
    if (
      a < Date.parse(facts.term.startsAt) ||
      b > Date.parse(facts.term.endsAt)
    )
      add(
        result.issues,
        "SCHEDULE_OUTSIDE_TERM",
        "Thời gian nằm ngoài đợt tốt nghiệp.",
        slot.key,
      );
    if (!c || !c.proposalIds.includes(slot.proposalId))
      add(
        result.issues,
        "SCHEDULE_COMMITTEE_MISMATCH",
        "Hồ sơ không nằm trong hội đồng của phương án.",
        slot.key,
      );
    if (!room)
      add(
        result.issues,
        "ROOM_NOT_FOUND",
        "Phòng không thuộc danh mục được máy chủ cung cấp.",
        slot.key,
      );
    else if (
      !Number.isInteger(room.capacity) ||
      room.capacity <= 0 ||
      attendees(slot).size + 1 > room.capacity
    )
      add(
        result.issues,
        "ROOM_CAPACITY_EXCEEDED",
        "Phòng không đủ chỗ tối thiểu cho sinh viên và các giảng viên tham dự đã biết.",
        slot.key,
      );
    if (
      !reviewers.some(
        (r) => r.proposalId === slot.proposalId && r.reviewerIds.length,
      )
    )
      add(
        result.issues,
        "SCHEDULE_REVIEWER_MISSING",
        "Chưa có phản biện trong phương án; không đủ tiền đề lập lịch chính thức.",
        slot.key,
      );
    const people = attendees(slot);
    for (const previous of valid) {
      if (
        !overlap(
          a,
          b,
          Date.parse(previous.startsAt),
          Date.parse(previous.endsAt),
        )
      )
        continue;
      if (slot.roomId === previous.roomId)
        add(
          result.issues,
          "ROOM_TIME_CONFLICT",
          "Trùng thời gian sử dụng phòng trong phương án.",
          slot.key,
        );
      if (slot.committeeKey === previous.committeeKey)
        add(
          result.issues,
          "COMMITTEE_TIME_CONFLICT",
          "Hội đồng có hai lịch chồng nhau.",
          slot.key,
        );
      if (slot.proposalId === previous.proposalId)
        add(
          result.issues,
          "STUDENT_TIME_CONFLICT",
          "Sinh viên có hai lịch chồng nhau.",
          slot.key,
        );
      if ([...attendees(previous)].some((id) => people.has(id)))
        add(
          result.issues,
          "LECTURER_TIME_CONFLICT",
          "Giảng viên có hai lịch chồng nhau trong phương án.",
          slot.key,
        );
    }
    for (const existing of busy) {
      if (
        !overlap(
          a,
          b,
          Date.parse(existing.startsAt),
          Date.parse(existing.endsAt),
        )
      )
        continue;
      if (room && slot.roomId === existing.roomId)
        add(
          result.issues,
          "ROOM_ALREADY_BOOKED",
          "Phòng trùng với bản ghi lịch đã lưu; cần đối soát trước khi sử dụng.",
          slot.key,
        );
      const ownStudent = facts.students.find(
        (s) => s.proposalId === slot.proposalId,
      );
      if (
        ownStudent &&
        (existing.proposalIds.includes(slot.proposalId) ||
          existing.studentIds?.includes(ownStudent.studentId))
      )
        add(
          result.issues,
          "STUDENT_ALREADY_SCHEDULED",
          "Hồ sơ có bản ghi lịch khác đang trùng giờ.",
          slot.key,
        );
      if (existing.lecturerIds.some((id) => people.has(id)))
        add(
          result.issues,
          "LECTURER_ALREADY_BOOKED",
          "Giảng viên trùng với bản ghi lịch đã lưu; không tiết lộ dữ liệu của đợt khác.",
          slot.key,
        );
      // Client keys are temporary plan references, never authoritative DB IDs.
      // Existing committee participation conflicts are checked via scoped people.
    }
    valid.push(slot);
  }
  // Incomplete drafts remain previewable. Report coverage only for proposals
  // already visible to this actor, without inventing an official publish rule.
  const allocated = new Set(committees.flatMap((c) => c.proposalIds));
  const scheduled = new Set(valid.map((s) => s.proposalId));
  const unscheduled = facts.students.filter(
    (s) =>
      s.proposalId &&
      allocated.has(s.proposalId) &&
      !scheduled.has(s.proposalId) &&
      (facts.source.kind !== "UC18_FINALIZED" || s.admitted === true),
  );
  if (unscheduled.length)
    add(
      result.warnings,
      "SCHEDULE_STUDENTS_UNSCHEDULED",
      `Còn ${unscheduled.length} hồ sơ đã phân hội đồng trong nguồn được phép xem nhưng chưa có khoảng giờ bảo vệ hợp lệ trong phương án.`,
    );
  add(
    result.warnings,
    "LEGACY_SCHEDULE_NOT_PUBLICATION_PROOF",
    "Lịch cũ được dùng làm chứng cứ xung đột tiềm năng, không phải bằng chứng đã công bố.",
  );
  add(
    result.warnings,
    "SCHEDULE_ASSUMPTIONS_ONLY",
    `Giờ/phòng là đề xuất; GVPB ${includeReviewers ? "có" : "không"} được tính tham dự theo lựa chọn preview. Không tự áp dụng thứ tự alphabet hoặc thời lượng mặc định.`,
  );
  return result;
}
