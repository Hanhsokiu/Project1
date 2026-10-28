import type { GradeContext, GradingPolicy } from "@doan/shared";
export function gradeContextFixture(): GradeContext {
  return {
    termId: "term",
    proposalId: "proposal",
    kind: "REVIEWER",
    title: "Đồ án TEST",
    studentName: "SV TEST",
    expectedContext: "a".repeat(64),
    expectedRevision: 1,
    policyRevision: 1,
    grade: {
      configured: true,
      state: "DRAFT",
      revision: 1,
      draft: {
        values: { A: 8 },
        comment: "Nhận xét",
        questions: ["Câu 1?", "Câu 2?"],
      },
      total: 8,
      at: "2026-10-28T00:00:00Z",
    },
    rubric: [{ code: "A", label: "TEST", maxScore: 10 }],
    blockers: [],
    canSave: true,
    canSeal: true,
    window: {
      opensAt: "2026-10-01T00:00:00Z",
      closesAt: "2026-12-01T00:00:00Z",
      isLocked: false,
    },
    pdf: {
      finalReportId: "report",
      revision: 2,
      checksum: "b".repeat(64),
      originalName: "do-an.pdf",
    },
    source: {
      uc18Id: "root",
      committeeId: "c",
      reviewerId: "r",
      scheduleId: null,
    },
  };
}
export function gradePolicyFixture(): GradingPolicy {
  return {
    schemaVersion: 1,
    committeeRubric: [{ code: "A", label: "TEST", maxScore: 10 }],
    calculation: { state: "NEEDS_APPROVAL" },
    windows: Object.fromEntries(
      ["REVIEWER", "COMMITTEE", "PUBLICATION"].map((k) => [
        k,
        {
          opensAt: "2026-10-01T00:00:00Z",
          closesAt: "2026-12-01T00:00:00Z",
          isLocked: false,
        },
      ]),
    ) as GradingPolicy["windows"],
  };
}
