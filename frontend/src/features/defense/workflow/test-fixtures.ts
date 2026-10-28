import type {
  DefenseWorkflowContext,
  DefenseWorkflowPolicy,
} from "@doan/shared";
export function policyFixture(): DefenseWorkflowPolicy {
  const w = {
    opensAt: "2026-10-01T00:00:00Z",
    closesAt: "2026-12-01T00:00:00Z",
    isLocked: false,
  };
  return {
    schemaVersion: 1,
    committeeSize: 3,
    committeeCapacity: 10,
    windows: {
      UC18: { ...w },
      COMMITTEES: { ...w },
      REVIEWERS: { ...w },
      SCHEDULE: { ...w },
    },
  };
}
export function officialContextFixture(): DefenseWorkflowContext {
  return {
    termId: "term",
    termName: "Đợt TEST",
    serverNow: "2026-10-28T00:00:00Z",
    expectedContext: "a".repeat(64),
    list: { state: "OPEN", revision: 1, finalizationId: null, version: null },
    policy: policyFixture(),
    policyRevision: 1,
    students: [
      {
        termStudentId: "member",
        studentId: "student",
        studentCode: "SV01",
        studentName: "Sinh viên TEST",
        proposalId: "proposal",
        title: "Đồ án TEST",
        departmentId: "department",
        advisorId: "advisor",
        advisorUserId: "advisor-user",
        admitted: false,
        reasons: ["ACADEMIC_UNKNOWN"],
        academicRevision: 0,
        academic: null,
      },
    ],
    stages: ["COMMITTEES", "REVIEWERS", "SCHEDULE"].map((stage) => ({
      stage: stage as "COMMITTEES" | "REVIEWERS" | "SCHEDULE",
      state: "ABSENT",
      revision: 0,
      draft: null,
      artifactId: null,
      version: null,
      sourceCurrent: false,
      capabilities: {
        save: false,
        finalize: false,
        publish: false,
        amend: false,
      },
    })),
    blockers: ["UC18_NOT_FINALIZED"],
    warnings: [],
    workload: [],
    suggestions: [],
    capabilities: {
      configure: true,
      verifyAcademic: true,
      finalize: true,
      reopen: false,
    },
  };
}
