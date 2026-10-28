import { z } from "zod";
import {
  committeeDraftSchema,
  reviewerDraftSchema,
  scheduleDraftSchema,
  defenseWorkflowPolicySchema,
  type DefenseStage,
  type DefenseWorkflowPolicy,
  type CommitteePlan,
  type ReviewerPlan,
  type ScheduleSlot,
  type PlanningContext,
} from "@doan/shared";
import {
  checkCommittees,
  checkReviewers,
  checkSchedule,
  planningError,
  type BusySlot,
} from "../planning/defense-planning.policy";
import { defenseListSnapshotHash } from "../../common/uc18-finalization/defense-list-snapshot";

export const stages: DefenseStage[] = ["COMMITTEES", "REVIEWERS", "SCHEDULE"];
const id = z.string().trim().min(1).max(36),
  hash = z.string().regex(/^[0-9a-f]{64}$/),
  rev = z.number().int().positive();
export const stageSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    termId: id,
    stage: z.enum(["COMMITTEES", "REVIEWERS", "SCHEDULE"]),
    state: z.enum(["FINALIZED", "PUBLISHED"]),
    version: rev,
    workflowRevision: rev,
    sealedAt: z.string().datetime({ offset: true }),
    sealedByUserId: id,
    source: z.object({ id, revision: rev, hash }).strict(),
    upstream: z
      .object({
        id,
        stage: z.enum(["COMMITTEES", "REVIEWERS"]),
        revision: rev,
        hash,
      })
      .strict()
      .nullable(),
    policyRevision: rev,
    policy: defenseWorkflowPolicySchema,
    committees: committeeDraftSchema.shape.committees,
    reviewers: reviewerDraftSchema.shape.reviewers,
    slots: scheduleDraftSchema.shape.slots,
    rooms: z.array(
      z
        .object({
          id,
          code: z.string().min(1),
          capacity: z.number().int().positive(),
        })
        .strict(),
    ),
    students: z.array(
      z
        .object({
          proposalId: id,
          studentId: id,
          studentUserId: id,
          studentName: z.string(),
          title: z.string(),
          departmentId: id.nullable(),
          advisorId: id,
          advisorUserId: id,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((a, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    const ids = a.students.map((s) => s.proposalId);
    const exact = (values: string[]) =>
      values.length === ids.length &&
      unique(values) &&
      ids.every((id) => values.includes(id));
    if (
      !unique(ids) ||
      !unique(a.students.map((s) => s.studentId)) ||
      !unique(a.committees.map((c) => c.key))
    )
      fail("Duplicate captured entity");
    if (a.state === "PUBLISHED" && a.stage !== "SCHEDULE")
      fail("Invalid published stage");
    if (
      a.stage === "COMMITTEES"
        ? a.upstream !== null
        : a.upstream?.stage !==
          (a.stage === "REVIEWERS" ? "COMMITTEES" : "REVIEWERS")
    )
      fail("Invalid stage dependency");
    if (!exact(a.committees.flatMap((c) => c.proposalIds)))
      fail("Incomplete committee snapshot");
    for (const c of a.committees) {
      if (
        c.members.length !== a.policy.committeeSize ||
        !unique(c.members.map((m) => m.lecturerId)) ||
        c.members.filter((m) => m.role === "CHAIR").length !== 1 ||
        c.members.filter((m) => m.role === "SECRETARY").length !== 1 ||
        c.proposalIds.length > a.policy.committeeCapacity
      )
        fail("Invalid captured committee structure");
      if (
        c.proposalIds.some((p) =>
          c.members.some(
            (m) =>
              m.lecturerId ===
              a.students.find((s) => s.proposalId === p)?.advisorId,
          ),
        )
      )
        fail("Captured advisor conflict");
    }
    if (
      a.stage !== "COMMITTEES" &&
      (!exact(a.reviewers.map((r) => r.proposalId)) ||
        a.reviewers.some(
          (r) =>
            r.reviewerIds.length !== 1 ||
            r.reviewerIds[0] ===
              a.students.find((s) => s.proposalId === r.proposalId)?.advisorId,
        ))
    )
      fail("Invalid captured reviewers");
    if (a.stage === "SCHEDULE") {
      if (
        !exact(a.slots.map((s) => s.proposalId)) ||
        !unique(a.slots.map((s) => s.key)) ||
        !unique(a.rooms.map((r) => r.id))
      )
        fail("Invalid slot coverage");
      for (const s of a.slots)
        if (
          Date.parse(s.startsAt) >= Date.parse(s.endsAt) ||
          !a.rooms.some((r) => r.id === s.roomId) ||
          !a.committees.some(
            (c) =>
              c.key === s.committeeKey && c.proposalIds.includes(s.proposalId),
          )
        )
          fail("Invalid captured slot");
    }
  });
export type StageSnapshot = z.infer<typeof stageSnapshotSchema>;
export const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const hashJson = (value: unknown) =>
  defenseListSnapshotHash(json(value));
// Operational deadlines may be adjusted with CAS/audit without invalidating
// historical eligibility or a committee's approved structural configuration.
export function structuralPolicyHash(policy: DefenseWorkflowPolicy) {
  const {
    schemaVersion,
    committeeSize,
    committeeCapacity,
    reviewerWarningLoad,
  } = policy;
  return hashJson({
    schemaVersion,
    committeeSize,
    committeeCapacity,
    ...(reviewerWarningLoad === undefined ? {} : { reviewerWarningLoad }),
  });
}
export function requireRevision(expected: number, actual: number) {
  if (
    expected !== actual ||
    !Number.isInteger(actual) ||
    actual < 0 ||
    actual >= 2147483647
  )
    planningError(
      409,
      "REVISION_CONFLICT",
      "Revision đã thay đổi; hãy tải lại dữ liệu.",
    );
}
export function requireContext(expected: string, actual: string) {
  if (expected !== actual)
    planningError(
      409,
      "DEFENSE_CONTEXT_CHANGED",
      "Nguồn dữ liệu đã thay đổi; hãy tải lại và xem lại phương án.",
    );
}
export function workflowWindow(
  policy: DefenseWorkflowPolicy | null,
  key: "UC18" | DefenseStage,
  at: Date,
  term: { startDate: Date; endDate: Date; status: string; isLocked: boolean },
) {
  if (!policy)
    planningError(
      409,
      "WORKFLOW_POLICY_MISSING",
      "Chưa cấu hình policy và mốc thời gian riêng.",
    );
  const w = policy.windows[key];
  if (
    term.isLocked ||
    ["COMPLETED", "CANCELLED"].includes(term.status) ||
    at < term.startDate ||
    at >= term.endDate
  )
    planningError(
      409,
      "DEFENSE_TERM_CLOSED",
      "Đợt đã khóa, kết thúc hoặc ngoài thời gian thực hiện.",
    );
  if (w.isLocked || at < new Date(w.opensAt) || at >= new Date(w.closesAt))
    planningError(
      409,
      "DEFENSE_WINDOW_CLOSED",
      `Mốc ${key} chưa mở, đã hết hạn hoặc đang khóa.`,
    );
}
export function validatePolicyDates(
  policy: DefenseWorkflowPolicy,
  term: { startDate: Date; endDate: Date },
) {
  for (const w of Object.values(policy.windows))
    if (
      new Date(w.opensAt) < term.startDate ||
      new Date(w.closesAt) > term.endDate
    )
      planningError(
        422,
        "WORKFLOW_POLICY_OUTSIDE_TERM",
        "Mốc thời gian phải nằm trong đợt.",
      );
}
export function validateOfficialPlan(
  stage: DefenseStage,
  facts: Pick<
    PlanningContext,
    "term" | "source" | "students" | "lecturers" | "rooms"
  >,
  policy: DefenseWorkflowPolicy,
  committees: CommitteePlan[],
  reviewers: ReviewerPlan[],
  slots: ScheduleSlot[],
  busy: BusySlot[] = [],
) {
  const check =
    stage === "COMMITTEES"
      ? checkCommittees(facts, committees)
      : stage === "REVIEWERS"
        ? checkReviewers(facts, committees, reviewers)
        : checkSchedule(facts, committees, reviewers, slots, true, busy);
  const errors = [...check.issues];
  const add = (code: string, message: string) => errors.push({ code, message });
  const expected = facts.students
    .filter((s) => s.admitted === true)
    .map((s) => s.proposalId!);
  const exact = (ids: string[]) =>
    ids.length === expected.length &&
    new Set(ids).size === ids.length &&
    expected.every((id) => ids.includes(id));
  if (!exact(committees.flatMap((c) => c.proposalIds)))
    add(
      "COMMITTEE_COVERAGE",
      "Mỗi hồ sơ admitted phải được phân đúng một hội đồng.",
    );
  for (const c of committees) {
    if (
      c.members.length !== policy.committeeSize ||
      c.members.filter((m) => m.role === "CHAIR").length !== 1 ||
      c.members.filter((m) => m.role === "SECRETARY").length !== 1
    )
      add(
        "OFFICIAL_COMMITTEE_STRUCTURE",
        "Hội đồng phải đúng size cấu hình, một Chủ tịch và một Thư ký khác người.",
      );
    if (
      c.proposalIds.length > policy.committeeCapacity ||
      (c.maxStudents !== undefined &&
        c.maxStudents !== policy.committeeCapacity)
    )
      add(
        "COMMITTEE_CAPACITY",
        "Sức chứa phải theo cấu hình Khoa; không được vượt sức chứa.",
      );
  }
  if (stage !== "COMMITTEES") {
    if (
      !exact(reviewers.map((r) => r.proposalId)) ||
      reviewers.some((r) => r.reviewerIds.length !== 1)
    )
      add("REVIEWER_COVERAGE", "Mỗi hồ sơ admitted phải có đúng một GVPB.");
  }
  if (stage === "SCHEDULE" && !exact(slots.map((s) => s.proposalId)))
    add(
      "SCHEDULE_COVERAGE",
      "Mỗi hồ sơ admitted phải có đúng một khoảng giờ bảo vệ.",
    );
  if (errors.length)
    planningError(422, errors[0].code, errors.map((e) => e.message).join(" "));
  return check.warnings.filter(
    (w) =>
      ![
        "REVIEWER_CARDINALITY_UNCONFIRMED",
        "SCHEDULE_ASSUMPTIONS_ONLY",
        "COMMITTEE_CAPACITY_UNCONFIGURED",
      ].includes(w.code),
  );
}
