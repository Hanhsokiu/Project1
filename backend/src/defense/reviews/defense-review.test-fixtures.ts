import { vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  fixture,
  at,
} from "../../guidance/defense-confirmations/defense-confirmation.test-fixtures";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { DefenseConfirmationReadValidator } from "../../guidance/defense-confirmations/defense-confirmation-read.validator";
import { DefenseConfirmationProgressValidator } from "../../guidance/defense-confirmations/defense-confirmation-progress.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import {
  DefenseReviewRepository,
  DefenseReviewSession,
} from "./defense-review.repository";
import { DefenseReviewService } from "./defense-review.service";
import type { Uc18FinalizationReader } from "../../common/contracts/uc18-finalization.port";

export function reviewFixture() {
  const f = fixture();
  f.user.userRoles[0].role.rolePermissions.push({
    permission: { resource: "defense-confirmation", action: "read" },
  } as never);
  const grant = {
    userId: f.user.id,
    termId: "term",
    allDepartments: true,
    pr2bGrantDepartmentGrantId: [] as { departmentId: string }[],
  };
  const data = {
    user: f.user as ReviewPrincipal | null,
    grants: [grant],
    members: [
      {
        id: "member",
        termId: "term",
        studentId: "student",
        student: f.proposal.student,
      },
    ],
    proposals: [
      { ...f.proposal, finalReport: f.report, defenseConfirmation: f.decision },
    ],
  };
  const s = {
    principal: vi.fn(async () => data.user),
    grants: vi.fn(async () => data.grants),
    term: vi.fn(async () => f.term),
    now: vi.fn(async () => at),
    members: vi.fn(async (_termId: string, studentId?: string) =>
      data.members.filter((m) => !studentId || m.studentId === studentId),
    ),
    dossiers: vi.fn(async (_termId: string, studentId?: string) =>
      data.proposals.filter((p) => !studentId || p.studentId === studentId),
    ),
    assignments: vi.fn(async () => [
      {
        ...f.registration,
        advisorAssignments: [
          {
            ...f.registration.advisorAssignment!,
            assignmentPlanId:
              f.registration.advisorAssignment!.assignmentPlan.id,
          },
        ],
      },
    ]),
    lecturerRoster: vi.fn(async () => [f.roster]),
    proposal: vi.fn(async () => f.proposal),
    advisor: vi.fn(async () => f.registration),
    roster: vi.fn(async () => f.roster),
    planFor: vi.fn(async () => f.plan),
    monitorTasks: vi.fn(async () => f.tasks),
    evaluations: vi.fn(async () => f.evaluations),
    terms: vi.fn(async () => [
      { id: "term", name: "Đợt", status: "IN_PROGRESS" },
    ]),
    studentTerms: vi.fn(async () => [{ termId: "term" }]),
    advisorTerms: vi.fn(async () => [
      { termId: "term", advisorAssignment: {} },
    ]),
  };
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    read: vi.fn(
      async (
        work: (
          s: DefenseReviewSession,
          tx: Prisma.TransactionClient,
        ) => unknown,
      ) => work(s as unknown as DefenseReviewSession, tx),
    ),
  };
  const uc18 = {
    read: vi.fn(async () => ({
      state: "UNKNOWN",
      termId: "term",
      scope: "TERM",
      reason: "NOT_CONFIGURED",
    })),
  };
  const rules = new DefenseConfirmationValidator(
    new ProposalReviewValidator(),
    new FinalReportValidator(),
    new SubmissionValidator(),
  );
  const service = new DefenseReviewService(
    repo as unknown as DefenseReviewRepository,
    rules,
    new DefenseConfirmationReadValidator(rules),
    new DefenseConfirmationProgressValidator(),
    uc18 as unknown as Uc18FinalizationReader,
  );
  function faculty(all = true) {
    f.user.userRoles[0].role.name = "FACULTY";
    f.user.userRoles[0].role.rolePermissions.push({
      permission: { resource: "defense-list", action: "read" },
    } as never);
    grant.allDepartments = all;
    return f.user;
  }
  return { f, data, s, repo, service, grant, faculty, uc18, tx };
}
