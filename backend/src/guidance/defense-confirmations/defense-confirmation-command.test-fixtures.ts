import { vi } from "vitest";
import { Prisma, type DefenseConfirmation } from "@prisma/client";
import { AuditService } from "../../common/audit/audit.service";
import { FileStorageService } from "../../common/storage/file-storage.service";
import { PrismaUc18FinalizationReader } from "../../common/uc18-finalization/prisma-uc18-finalization.reader";
import { Uc18FinalizationRepository } from "../../common/uc18-finalization/uc18-finalization.repository";
import { Uc18FinalizationValidator } from "../../common/uc18-finalization/uc18-finalization.validator";
import { uc18Fixture } from "../../common/uc18-finalization/uc18-finalization.test-fixtures";
import { PrismaService } from "../../prisma/prisma.service";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../final-reports/final-report.validator";
import { SubmissionValidator } from "../submissions/submission.validator";
import { DefenseConfirmationCommandService } from "./defense-confirmation-command.service";
import { DefenseConfirmationCommandRepository } from "./defense-confirmation-command.repository";
import { DefenseConfirmationCommandValidator } from "./defense-confirmation-command.validator";
import { DefenseConfirmationContextService } from "./defense-confirmation-context.service";
import { DefenseConfirmationRepository } from "./defense-confirmation.repository";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import { DefenseConfirmationProgressValidator } from "./defense-confirmation-progress.validator";
import { fixture, at, bytes } from "./defense-confirmation.test-fixtures";
import type { DefenseConfirmationPut } from "./defense-confirmation.dto";

export function commandFixture() {
  const facts = fixture(),
    uc18 = uc18Fixture();
  uc18.open();
  facts.user.userRoles[0].role.rolePermissions.push({
    permission: { resource: "defense-confirmation", action: "decide" },
  } as (typeof facts.user.userRoles)[0]["role"]["rolePermissions"][number]);
  const state = {
    user: facts.user as typeof facts.user | null,
    proposal: facts.proposal as typeof facts.proposal | null,
    term: facts.term as typeof facts.term | null,
    registration: facts.registration as typeof facts.registration | null,
    roster: facts.roster as typeof facts.roster | null,
    window: facts.window as typeof facts.window | null,
    report: facts.report as typeof facts.report | null,
    plan: facts.plan as typeof facts.plan | null,
    tasks: facts.tasks,
    list: uc18.list as typeof uc18.list | null,
    finalization: uc18.finalization,
    decision: null as DefenseConfirmation | null,
    history: [] as Prisma.DefenseConfirmationHistoryUncheckedCreateInput[],
    audits: [] as unknown[],
    notifications: [] as Prisma.NotificationCreateManyInput[],
    now: at,
    onLock: undefined as (() => void) | undefined,
    afterFileRead: undefined as (() => void) | undefined,
  };
  const events: string[] = [];
  const forbidden = vi.fn(() => {
    throw new Error("Out-of-scope mutation");
  });
  const raw = {
    $queryRaw: vi.fn(
      async (strings: TemplateStringsArray, ..._values: unknown[]) => {
        const sql = strings.join("?");
        events.push(sql);
        if (sql.includes('"THESIS_TERM"') && state.onLock) {
          const hook = state.onLock;
          state.onLock = undefined;
          hook();
        }
        return /timestamp\(\)/.test(sql) ? [{ at: state.now }] : [];
      },
    ),
    userAccount: {
      findUnique: vi.fn(async () => state.user),
      findMany: vi.fn(async (_args: Prisma.UserAccountFindManyArgs) => [
        { id: "faculty-user" },
      ]),
    },
    notification: {
      createMany: vi.fn(
        async ({ data }: { data: Prisma.NotificationCreateManyInput[] }) => {
          state.notifications.push(...structuredClone(data));
          return { count: data.length };
        },
      ),
    },
    proposal: {
      findUnique: vi.fn(async (args: { select?: unknown }) =>
        args.select
          ? state.proposal
            ? { termId: state.proposal.termId }
            : null
          : state.proposal,
      ),
    },
    thesisTerm: { findUnique: vi.fn(async () => state.term) },
    registration: {
      findUnique: vi.fn(async () =>
        state.registration
          ? {
              ...state.registration,
              term: {
                pr2bTermWorkflowTermId: state.term?.pr2bTermWorkflowTermId,
              },
              advisorAssignments: [
                {
                  ...state.registration.advisorAssignment!,
                  assignmentPlanId:
                    state.registration.advisorAssignment!.assignmentPlan.id,
                },
              ],
            }
          : null,
      ),
    },
    termLecturer: { findUnique: vi.fn(async () => state.roster) },
    defenseConfirmationWindow: {
      findUnique: vi.fn(async () => state.window),
      update: forbidden,
    },
    defenseList: {
      findUnique: vi.fn(async () => state.list),
      create: forbidden,
      update: forbidden,
    },
    defenseListFinalization: {
      findUnique: vi.fn(async () => state.finalization),
      create: forbidden,
    },
    finalReport: {
      findUnique: vi.fn(async () => structuredClone(state.report)),
      update: forbidden,
    },
    fileAsset: { create: forbidden, update: forbidden, delete: forbidden },
    guidancePlan: { findUnique: vi.fn(async () => state.plan) },
    task: { findMany: vi.fn(async () => state.tasks) },
    phaseEvaluation: {
      findMany: vi.fn(async () => facts.evaluations),
      update: forbidden,
    },
    taskProgressEvent: { findMany: vi.fn(async () => []) },
    defenseEligibility: {
      update: forbidden,
      create: forbidden,
      upsert: forbidden,
    },
    defenseConfirmation: {
      findUnique: vi.fn(async () => structuredClone(state.decision)),
      create: vi.fn(async ({ data }: { data: DefenseConfirmation }) => {
        events.push("decision-create");
        if (state.decision)
          throw new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "5.22.0",
          });
        state.decision = structuredClone(data);
        return structuredClone(data);
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; proposalId: string; revision: number };
          data: Partial<DefenseConfirmation>;
        }) => {
          events.push("decision-update");
          if (
            !state.decision ||
            state.decision.id !== where.id ||
            state.decision.proposalId !== where.proposalId ||
            state.decision.revision !== where.revision
          )
            return { count: 0 };
          Object.assign(state.decision, data);
          return { count: 1 };
        },
      ),
    },
    defenseConfirmationHistory: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: Prisma.DefenseConfirmationHistoryUncheckedCreateInput;
        }) => {
          events.push("history");
          state.history.push(structuredClone(data));
          return data;
        },
      ),
      update: forbidden,
      delete: forbidden,
    },
    auditLog: {
      create: vi.fn(
        async (entry: { data: Prisma.AuditLogUncheckedCreateInput }) => {
          events.push("audit");
          state.audits.push(structuredClone(entry));
          return entry;
        },
      ),
    },
  };
  const tx = raw as unknown as Prisma.TransactionClient;
  let queue = Promise.resolve();
  const prisma = {
    $transaction: vi.fn(
      (
        operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
        _options: unknown,
      ) => {
        // Deterministic unit simulation of parent-lock serialization and rollback.
        // This does not claim PostgreSQL constraints/triggers have been executed.
        const run = queue.then(async () => {
          const before = structuredClone({
            decision: state.decision,
            history: state.history,
            audits: state.audits,
            notifications: state.notifications,
          });
          try {
            return await operation(tx);
          } catch (e) {
            Object.assign(state, before);
            throw e;
          }
        });
        queue = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      },
    ),
  };
  const validator = new DefenseConfirmationValidator(
    new ProposalReviewValidator(),
    new FinalReportValidator(),
    new SubmissionValidator(),
  );
  const reader = new PrismaUc18FinalizationReader(
    new Uc18FinalizationRepository(),
    new Uc18FinalizationValidator(),
  );
  const repo = new DefenseConfirmationCommandRepository(
    prisma as unknown as PrismaService,
  );
  const readRepo = new DefenseConfirmationRepository(
    prisma as unknown as PrismaService,
  );
  const storage = {
    readPrivateFinalReport: vi.fn(async () => {
      events.push("file-read");
      state.afterFileRead?.();
      return bytes;
    }),
  };
  const contexts = new DefenseConfirmationContextService(
    readRepo,
    validator,
    new DefenseConfirmationProgressValidator(),
    storage as unknown as FileStorageService,
    reader,
  );
  const command = new DefenseConfirmationCommandValidator(validator);
  const audit = new AuditService({} as PrismaService),
    auditLog = vi.spyOn(audit, "log");
  const service = new DefenseConfirmationCommandService(
    repo,
    command,
    contexts,
    validator,
    reader,
    audit,
  );
  const input = (
    status: "CONFIRMED" | "REJECTED" = "CONFIRMED",
  ): DefenseConfirmationPut => {
    const assignment = state.registration?.advisorAssignment,
      report = state.report;
    return {
      status,
      ...(status === "REJECTED" ? { note: "Chưa hoàn thành báo cáo" } : {}),
      expectedRevision: state.decision?.revision ?? 0,
      expectedContext: {
        revision: state.decision?.revision ?? 0,
        assignment: {
          assignmentId: assignment?.id ?? "assignment",
          revision:
            assignment?.pr2bAssignmentChangeAssignmentId[0]
              ?.assignmentRevision ?? 0,
        },
        pdf: report?.fileAsset
          ? {
              finalReportId: report.id,
              revision: report.revision,
              checksum: report.fileAsset.checksum,
            }
          : null,
      },
    };
  };
  return {
    facts,
    state,
    events,
    raw,
    tx,
    prisma,
    validator,
    reader,
    repo,
    contexts,
    command,
    audit,
    auditLog,
    service,
    storage,
    forbidden,
    input,
  };
}
