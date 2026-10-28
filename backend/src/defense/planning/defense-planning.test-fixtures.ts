import { vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type {
  Uc18Finalization,
  Uc18FinalizationReader,
} from "../../common/contracts/uc18-finalization.port";
import { uc18Fixture } from "../../common/uc18-finalization/uc18-finalization.test-fixtures";
import { defenseListSnapshotHash } from "../../common/uc18-finalization/defense-list-snapshot";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { reviewFixture } from "../reviews/defense-review.test-fixtures";
import { DefensePlanningService } from "./defense-planning.service";
import type {
  DefensePlanningSession,
  DefensePlanningRepository,
} from "./defense-planning.repository";

export function planningFixture() {
  const f = reviewFixture();
  f.faculty();
  f.f.term.name = "Đợt kiểm thử";
  f.f.proposal.topic.title = "Đồ án";
  for (const action of ["read", "preview"])
    f.f.user.userRoles[0].role.rolePermissions.push({
      permission: { resource: "defense-planning", action },
    } as never);
  const captured = uc18Fixture();
  captured.snapshot.roster = {
    count: 1,
    members: [{ termStudentId: "member", studentId: "student" }],
  };
  captured.snapshot.students = [
    {
      ...captured.snapshot.students[0],
      termStudentId: "member",
      studentId: "student",
      pdf: f.f.snapshot.pdf!,
      confirmation: {
        ...captured.snapshot.students[0].confirmation!,
        snapshot: f.f.snapshot,
      },
    },
  ];
  captured.finalization.snapshot = captured.snapshot;
  captured.rehash();
  const state = {
    uc18: {
      state: "OPEN",
      scope: "TERM",
      termId: "term",
      revision: 1,
    } as Uc18Finalization,
  };
  const s = Object.assign(f.s, {
    candidates: vi.fn(async () =>
      ["chair", "secretary", "member-lecturer", "reviewer", "advisor"].map(
        (id) => ({
          lecturer: { id, fullName: id, departmentId: "department" },
        }),
      ),
    ),
    rooms: vi.fn(async () => [{ id: "room", code: "P101", capacity: 10 }]),
    committees: vi.fn(
      async () =>
        [] as {
          id: string;
          name: string;
          members: { lecturerId: string; role: string }[];
        }[],
    ),
    reviewers: vi.fn(
      async () =>
        [] as {
          id: string;
          proposalId: string;
          reviewerId: string;
          assignedAt: Date;
        }[],
    ),
    sessions: vi.fn(
      async () =>
        [] as {
          id: string;
          committeeId: string;
          roomId: string;
          scheduledAt: Date;
          durationMin: number;
          committeeStudents: { proposalId: string }[];
        }[],
    ),
    busySessions: vi.fn(
      async (_start: Date, _end: Date) =>
        [] as {
          id: string;
          committeeId: string;
          roomId: string;
          scheduledAt: Date;
          durationMin: number;
          committee: { members: { lecturerId: string }[] };
          committeeStudents: { proposalId: string }[];
        }[],
    ),
    readFinalization: vi.fn(async () => captured.finalization),
    bookingStudents: vi.fn(
      async (_ids: string[]) => [] as { id: string; studentId: string }[],
    ),
  });
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    read: vi.fn(
      async (
        work: (
          s: DefensePlanningSession,
          tx: Prisma.TransactionClient,
        ) => unknown,
      ) => work(s as unknown as DefensePlanningSession, tx),
    ),
  };
  const reader = { read: vi.fn(async () => state.uc18) };
  const rules = new DefenseConfirmationValidator(
    new ProposalReviewValidator(),
    new FinalReportValidator(),
    new SubmissionValidator(),
  );
  const service = new DefensePlanningService(
    repo as unknown as DefensePlanningRepository,
    reader as unknown as Uc18FinalizationReader,
    rules,
  );
  const committee = {
    key: "planned-committee",
    name: "Hội đồng đề xuất",
    members: [
      { lecturerId: "chair", role: "CHAIR" as const },
      { lecturerId: "secretary", role: "SECRETARY" as const },
      { lecturerId: "member-lecturer", role: "MEMBER" as const },
    ],
    proposalIds: ["proposal"],
  };
  const reviewers = [{ proposalId: "proposal", reviewerIds: ["reviewer"] }];
  const slot = {
    key: "slot",
    committeeKey: committee.key,
    proposalId: "proposal",
    roomId: "room",
    startsAt: "2026-11-02T02:00:00.000Z",
    endsAt: "2026-11-02T02:30:00.000Z",
  };
  const finalized = () => {
    captured.finalization.contentHash = defenseListSnapshotHash(
      captured.finalization.snapshot,
    );
    state.uc18 = {
      state: "FINALIZED",
      scope: "TERM",
      termId: "term",
      revision: 2,
      finalizedAt: captured.finalization.finalizedAt.toISOString(),
      finalizedByUserId: "faculty",
      evidence: {
        finalizationId: captured.finalization.id,
        version: 1,
        snapshotSchemaVersion: 1,
        contentHash: captured.finalization.contentHash,
        integrity: "VERIFIED",
        freshness: "NOT_CHECKED",
      },
    };
  };
  const input = async () => ({
    expectedContext: (await service.context("advisor-user", "term"))
      .expectedContext,
    committees: [structuredClone(committee)],
    reviewers: structuredClone(reviewers),
    slots: [structuredClone(slot)],
    includeReviewersAsAttendees: false,
  });
  return {
    f,
    s,
    repo,
    tx,
    reader,
    service,
    state,
    captured,
    finalized,
    input,
    committee,
    reviewers,
    slot,
  };
}
