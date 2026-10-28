import type { DefenseList, DefenseListFinalization } from "@prisma/client";
import {
  defenseListSnapshotHash,
  type DefenseListSnapshotV1,
} from "./defense-list-snapshot";

export function uc18Fixture() {
  const openedAt = new Date("2026-10-25T00:00:00.000Z");
  const finalizedAt = new Date("2026-10-26T00:00:00.000Z");
  const pdf = {
    finalReportId: "report",
    revision: 1,
    checksum: "a".repeat(64),
    originalName: "Do an.pdf",
    sizeBytes: 1024,
    submittedAt: openedAt.toISOString(),
  };
  const snapshot: DefenseListSnapshotV1 = {
    schemaVersion: 1,
    termId: "term",
    listRevision: 2,
    finalizationVersion: 1,
    finalizedAt: finalizedAt.toISOString(),
    finalizedByUserId: "faculty",
    roster: {
      count: 2,
      members: [
        { termStudentId: "member-1", studentId: "student-1" },
        { termStudentId: "member-2", studentId: "student-2" },
      ],
    },
    students: [
      {
        termStudentId: "member-1",
        studentId: "student-1",
        proposalId: "proposal",
        pdf,
        confirmation: {
          id: "decision",
          revision: 1,
          status: "CONFIRMED",
          advisorId: "advisor",
          decidedAt: openedAt.toISOString(),
          decidedByUserId: "advisor-user",
          snapshot: {
            schemaVersion: 1,
            assignment: { assignmentId: "assignment", revision: 0 },
            pdf,
          },
        },
        eligibility: {
          id: "eligibility",
          status: "ELIGIBLE",
          checkedAt: openedAt.toISOString(),
          note: null,
        },
        admitted: true,
        exclusionReasons: [],
      },
      {
        termStudentId: "member-2",
        studentId: "student-2",
        proposalId: null,
        pdf: null,
        confirmation: null,
        eligibility: null,
        admitted: false,
        exclusionReasons: [
          "MISSING_PROPOSAL",
          "MISSING_PDF",
          "MISSING_CONFIRMATION",
        ],
      },
    ],
  };
  const list: DefenseList = {
    workflowPolicy: null,
    workflowPolicyRevision: 0,
    workflowPolicyUpdatedAt: null,
    workflowPolicyUpdatedByUserId: null,
    termId: "term",
    state: "FINALIZED",
    revision: 2,
    openedAt,
    openedByUserId: "faculty",
    currentFinalizationId: "finalization",
    createdAt: openedAt,
    updatedAt: finalizedAt,
  };
  const finalization: DefenseListFinalization = {
    id: "finalization",
    termId: "term",
    version: 1,
    listRevision: 2,
    snapshotSchemaVersion: 1,
    snapshot,
    contentHash: defenseListSnapshotHash(snapshot),
    finalizedAt,
    finalizedByUserId: "faculty",
  };
  const rehash = () => {
    finalization.contentHash = defenseListSnapshotHash(finalization.snapshot);
  };
  const open = () => {
    list.state = "OPEN";
    list.currentFinalizationId = null;
  };
  return { list, finalization, snapshot, rehash, open };
}
