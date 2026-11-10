// TEST_ONLY. Never imported by the runtime API page.
import type {
  ReportPreview,
  ReportStatistics,
  ReportTemplate,
} from "@doan/shared";
export function reportTemplate(): ReportTemplate {
  return {
    code: "XLSX_OFFICIAL_RESULTS",
    version: "TEST_ONLY_V1",
    name: "Bảng kết quả kiểm thử",
    format: "XLSX",
    engineVersion: "UC25_V1",
    owner: "TEST_ONLY",
    status: "DRAFT",
    approval: null,
    effectiveFrom: null,
    effectiveUntil: null,
    roles: ["FACULTY", "LECTURER"],
    columns: ["STUDENT_CODE", "STUDENT_NAME", "FINAL_SCORE", "STATE"],
    draftAllowed: true,
    requirePublished: true,
    allowMissing: [],
    signatureRoles: [],
    institution: null,
    dossierTemplateVersion: null,
  };
}
export function reportPreview(): ReportPreview {
  return {
    template: reportTemplate(),
    mode: "DRAFT",
    snapshotHash: "a".repeat(64),
    rows: [
      {
        cells: {
          STUDENT_CODE: "00001234",
          STUDENT_NAME: "Sinh viên kiểm thử",
          FINAL_SCORE: "8.4",
          STATE: "CURRENT",
        },
        missing: [],
        sourceState: "CURRENT",
      },
    ],
    count: 1,
    truncated: false,
    blockers: ["TEMPLATE_NOT_APPROVED"],
    canExport: false,
    signatureStatus: "UNSIGNED",
  };
}
export function reportStatistics(): ReportStatistics {
  return {
    termId: "term",
    students: 1,
    proposals: 1,
    lecturers: 5,
    committees: 1,
    scheduledStudents: 1,
    sessions: 1,
    eligibleStudents: 1,
    unknownEligibility: 0,
    reviewerAssignments: 1,
    reviewerSheets: 1,
    committeeSheets: 3,
    finalizedResults: 1,
    publishedResults: 1,
    average: "8.4",
    passRate: null,
    distribution: null,
    byClass: [{ key: "CNTT", students: 1, finalized: 1 }],
    byCommittee: [{ key: "H1", students: 1, finalized: 1 }],
    byDepartment: [{ key: "Bộ môn", students: 1, finalized: 1 }],
    researchAreas: [{ key: "Công nghệ", students: 1 }],
    advisorLoads: [],
    reviewerLoads: [],
    progress: { activeTasks: 2, completedTasks: 1, unknownStudents: 0 },
    snapshotHash: "b".repeat(64),
    blockers: ["PASS_RULE_OR_RELEASE_NOT_VERIFIED"],
  };
}
