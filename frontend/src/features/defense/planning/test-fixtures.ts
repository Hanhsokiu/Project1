import type {
  PlanningContext,
  PlanningPreview,
  SchedulePreviewInput,
} from "@doan/shared";
export function planningContextFixture(): PlanningContext {
  return {
    code: "DEFENSE_PLANNING_CONTEXT",
    asOf: "2026-10-27T00:00:00Z",
    expectedContext: "a".repeat(64),
    term: {
      id: "term",
      name: "Đợt thật",
      status: "IN_PROGRESS",
      locked: false,
      startsAt: "2026-09-01T00:00:00Z",
      endsAt: "2027-01-01T00:00:00Z",
    },
    uc18: { state: "OPEN" },
    source: {
      kind: "ROSTER_PREVIEW",
      finalizationId: null,
      version: null,
      rosterCount: 1,
      admittedCount: null,
    },
    students: [
      {
        termStudentId: "member",
        studentId: "student",
        proposalId: "proposal",
        title: "Đồ án API",
        code: "SV_API",
        name: "Sinh viên API",
        admitted: null,
        advisor: {
          id: "advisor",
          name: "GVHD hiện hành",
          assignmentId: "assignment",
          revision: 2,
        },
        evidence: "PRELIMINARY",
      },
    ],
    lecturers: [
      { id: "chair", name: "Giảng viên Chủ tịch", departmentId: "department" },
      {
        id: "secretary",
        name: "Giảng viên Thư ký",
        departmentId: "department",
      },
      {
        id: "member-lecturer",
        name: "Giảng viên Ủy viên",
        departmentId: "department",
      },
      {
        id: "reviewer",
        name: "Giảng viên Phản biện",
        departmentId: "department",
      },
    ],
    rooms: [{ id: "room", code: "P101", capacity: 10 }],
    capabilities: {
      canPreview: true,
      canCreateOfficial: false,
      canFinalize: false,
      canPublish: false,
    },
    blockers: [
      { code: "UC18_NOT_FINALIZED", message: "UC18 chưa chốt chính thức." },
    ],
  };
}
export function planningInputFixture(): SchedulePreviewInput {
  return {
    expectedContext: "a".repeat(64),
    committees: [
      {
        key: "committee",
        name: "Hội đồng",
        members: [
          { lecturerId: "chair", role: "CHAIR" },
          { lecturerId: "secretary", role: "SECRETARY" },
          { lecturerId: "member-lecturer", role: "MEMBER" },
        ],
        proposalIds: ["proposal"],
      },
    ],
    reviewers: [{ proposalId: "proposal", reviewerIds: ["reviewer"] }],
    slots: [
      {
        key: "slot",
        committeeKey: "committee",
        proposalId: "proposal",
        roomId: "room",
        startsAt: "2026-11-02T02:00:00Z",
        endsAt: "2026-11-02T02:30:00Z",
      },
    ],
    includeReviewersAsAttendees: false,
  };
}
export function previewFixture(): PlanningPreview {
  return {
    code: "DEFENSE_PLANNING_PREVIEW",
    stage: "COMMITTEES",
    mode: "PREVIEW_ONLY",
    persisted: false,
    expectedContext: "a".repeat(64),
    validForPreview: true,
    officialReady: false,
    source: planningContextFixture().source,
    issues: [],
    warnings: [],
    blockers: planningContextFixture().blockers,
    workload: [],
    slots: [],
  };
}
