import { vi } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  DefenseAcademicEvidence,
  DefenseList,
  DefenseListFinalization,
  DefenseStageWorkflow,
  DefenseStageArtifact,
  IdempotencyRecord,
  Prisma,
} from "@prisma/client";
import type {
  DefenseStage,
  DefenseWorkflowPolicy,
  WorkflowCommand,
} from "@doan/shared";
import { planningFixture } from "../planning/defense-planning.test-fixtures";
import {
  at,
  earlier,
  bytes,
} from "../../guidance/defense-confirmations/defense-confirmation.test-fixtures";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import { PrismaUc18FinalizationReader } from "../../common/uc18-finalization/prisma-uc18-finalization.reader";
import { Uc18FinalizationRepository } from "../../common/uc18-finalization/uc18-finalization.repository";
import { Uc18FinalizationValidator } from "../../common/uc18-finalization/uc18-finalization.validator";
import type { AuditService } from "../../common/audit/audit.service";
import type { FileStorageService } from "../../common/storage/file-storage.service";
import {
  DefenseWorkflowSession,
  DefenseWorkflowRepository,
} from "./defense-workflow.repository";
import { DefenseWorkflowService } from "./defense-workflow.service";

export const approvedPolicy: DefenseWorkflowPolicy = {
  schemaVersion: 1,
  committeeSize: 3,
  committeeCapacity: 10,
  windows: Object.fromEntries(
    ["UC18", "COMMITTEES", "REVIEWERS", "SCHEDULE"].map((k) => [
      k,
      {
        opensAt: "2026-09-01T00:00:00Z",
        closesAt: "2027-01-01T00:00:00Z",
        isLocked: false,
      },
    ]),
  ) as DefenseWorkflowPolicy["windows"],
};
export function workflowFixture() {
  const base = planningFixture(),
    userId = "advisor-user";
  for (const action of [
    "read",
    "configure",
    "verify-academic",
    "manage",
    "finalize",
    "reopen",
    "publish",
  ])
    base.f.f.user.userRoles[0].role.rolePermissions.push({
      permission: { resource: "defense-workflow", action },
    } as never);
  base.f.f.user.userRoles[0].role.rolePermissions.push({
    permission: { resource: "defense-schedule", action: "read" },
  } as never);
  let state = {
    list: {
      termId: "term",
      state: "OPEN",
      revision: 1,
      openedAt: earlier,
      openedByUserId: userId,
      currentFinalizationId: null,
      createdAt: earlier,
      updatedAt: at,
      workflowPolicy: null,
      workflowPolicyRevision: 0,
      workflowPolicyUpdatedAt: null,
      workflowPolicyUpdatedByUserId: null,
    } as DefenseList,
    evidence: [] as DefenseAcademicEvidence[],
    stages: [] as DefenseStageWorkflow[],
    artifacts: [] as DefenseStageArtifact[],
    finalizations: [] as DefenseListFinalization[],
    idempotency: [] as IdempotencyRecord[],
    audit: [] as unknown[],
    notifications: [] as unknown[],
    events: [] as string[],
  };
  const fault = { at: "", time: at, cas: false };
  const fail = (where: string) => {
    if (fault.at === where) throw new Error(`Injected ${where} failure`);
  };
  const tx = {
    defenseList: { findUnique: vi.fn(async () => state.list) },
    defenseListFinalization: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          state.finalizations.find((f) => f.id === where.id) ?? null,
      ),
    },
  } as unknown as Prisma.TransactionClient;
  const session = Object.assign(base.s, {
    now: vi.fn(async () => fault.time),
    lock: vi.fn(async () => {
      state.events.push("TERM_FIRST");
    }),
    pdfLock: vi.fn(async () => undefined),
    resources: vi.fn(async (_keys: string[]) => undefined),
    list: vi.fn(async () => state.list),
    evidence: vi.fn(async () =>
      [...state.evidence].sort(
        (a, b) =>
          a.termStudentId.localeCompare(b.termStudentId) ||
          b.revision - a.revision,
      ),
    ),
    stages: vi.fn(async () => state.stages),
    artifacts: vi.fn(async () => state.artifacts),
    readFinalization: vi.fn(
      async (id: string) =>
        state.finalizations.find((f) => f.id === id) ?? null,
    ),
    finalizationVersion: vi.fn(async () =>
      Math.max(0, ...state.finalizations.map((f) => f.version)),
    ),
    listFinalizations: vi.fn(async () => state.finalizations),
    officialBookings: vi.fn(
      async () =>
        [] as (DefenseStageWorkflow & {
          currentArtifact: DefenseStageArtifact | null;
        })[],
    ),
    lecturerUsers: vi.fn(async (ids: string[]) =>
      ids.map((id) => ({ id, userId: `${id}-user` })),
    ),
    idempotency: vi.fn(
      async (actorId: string, method: string, route: string, key: string) =>
        state.idempotency.find(
          (i) =>
            i.actorId === actorId &&
            i.method === method &&
            i.route === route &&
            i.key === key,
        ) ?? null,
    ),
    newEvidence: vi.fn(
      async (data: Prisma.DefenseAcademicEvidenceUncheckedCreateInput) => {
        fail("history");
        state.evidence.push(data as DefenseAcademicEvidence);
      },
    ),
    policy: vi.fn(
      async (
        _id: string,
        rev: number,
        data: Prisma.DefenseListUncheckedUpdateManyInput,
      ) => {
        if (state.list.workflowPolicyRevision !== rev || fault.cas)
          return { count: 0 };
        state.list = { ...state.list, ...data } as DefenseList;
        return { count: 1 };
      },
    ),
    listCas: vi.fn(
      async (
        _id: string,
        rev: number,
        data: Prisma.DefenseListUncheckedUpdateManyInput,
      ) => {
        if (state.list.revision !== rev || fault.cas) return { count: 0 };
        state.list = { ...state.list, ...data } as DefenseList;
        return { count: 1 };
      },
    ),
    finalization: vi.fn(
      async (data: Prisma.DefenseListFinalizationUncheckedCreateInput) => {
        fail("artifact");
        state.finalizations.push(data as DefenseListFinalization);
      },
    ),
    createStage: vi.fn(
      async (data: Prisma.DefenseStageWorkflowUncheckedCreateInput) => {
        state.stages.push(data as DefenseStageWorkflow);
      },
    ),
    stageCas: vi.fn(
      async (
        _id: string,
        stage: DefenseStage,
        rev: number,
        data: Prisma.DefenseStageWorkflowUncheckedUpdateManyInput,
      ) => {
        const row = state.stages.find((r) => r.stage === stage);
        if (!row || row.revision !== rev || fault.cas) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    ),
    newArtifact: vi.fn(
      async (data: Prisma.DefenseStageArtifactUncheckedCreateInput) => {
        fail("artifact");
        state.artifacts.push(data as DefenseStageArtifact);
      },
    ),
    rememberCommand: vi.fn(
      async (data: Prisma.IdempotencyRecordUncheckedCreateInput) => {
        fail("idempotency");
        state.idempotency.push({
          ...data,
          createdAt: at,
          updatedAt: at,
        } as IdempotencyRecord);
      },
    ),
    notifyRecipients: vi.fn(async (...args: unknown[]) => {
      fail("notification");
      state.notifications.push(args);
    }),
  });
  let tail = Promise.resolve();
  const repo = {
    transaction: vi.fn(
      async <T>(
        write: boolean,
        work: (
          s: DefenseWorkflowSession,
          tx: Prisma.TransactionClient,
        ) => Promise<T>,
      ) => {
        const previous = tail;
        let unlock: () => void = () => undefined;
        if (write) {
          tail = new Promise<void>((r) => {
            unlock = r;
          });
          await previous;
        }
        const before = structuredClone(state);
        try {
          return await work(session as unknown as DefenseWorkflowSession, tx);
        } catch (error) {
          if (write) state = before;
          throw error;
        } finally {
          if (write) unlock();
        }
      },
    ),
  };
  const reader = new PrismaUc18FinalizationReader(
    new Uc18FinalizationRepository(),
    new Uc18FinalizationValidator(),
  );
  const audit = {
    log: vi.fn(async (event: unknown) => {
      fail("audit");
      state.audit.push(event);
    }),
  };
  const storage = { readPrivateFinalReport: vi.fn(async () => bytes) };
  const rules = new DefenseConfirmationValidator(
    new ProposalReviewValidator(),
    new FinalReportValidator(),
    new SubmissionValidator(),
  );
  const service = new DefenseWorkflowService(
    repo as unknown as DefenseWorkflowRepository,
    reader,
    rules,
    storage as unknown as FileStorageService,
    audit as unknown as AuditService,
  );
  const context = () => service.context(userId, "term");
  const command = async (revision: number): Promise<WorkflowCommand> => ({
    expectedRevision: revision,
    expectedContext: (await context()).expectedContext,
    requestId: randomUUID(),
  });
  const configured = async () =>
    service.configure(userId, "term", {
      ...(await command(state.list.workflowPolicyRevision)),
      policy: approvedPolicy,
    });
  const eligible = async () => {
    await configured();
    await service.academic(userId, "term", {
      ...(await command(0)),
      termStudentId: "member",
      verdict: "SATISFIED",
      sourceReference: "Xác nhận phòng đào tạo TEST",
      note: "",
    });
  };
  const finalized = async () => {
    await eligible();
    return service.finalizeList(
      userId,
      "term",
      await command(state.list.revision),
    );
  };
  const save = async (stage: DefenseStage) => {
    const draft =
      stage === "COMMITTEES"
        ? { committees: [{ ...base.committee, maxStudents: 10 }] }
        : stage === "REVIEWERS"
          ? { reviewers: base.reviewers }
          : { slots: [base.slot] };
    return service.saveStage(userId, "term", stage, {
      ...(await command(
        state.stages.find((s) => s.stage === stage)?.revision ?? 0,
      )),
      draft,
    });
  };
  const seal = async (stage: DefenseStage) =>
    service.sealStage(
      userId,
      "term",
      stage,
      "finalize",
      await command(state.stages.find((s) => s.stage === stage)!.revision),
    );
  const through = async (stage: DefenseStage) => {
    await finalized();
    for (const s of ["COMMITTEES", "REVIEWERS", "SCHEDULE"] as const) {
      await save(s);
      await seal(s);
      if (s === stage) break;
    }
  };
  return {
    base,
    session,
    repo,
    tx,
    reader,
    service,
    audit,
    storage,
    fault,
    userId,
    context,
    command,
    configured,
    eligible,
    finalized,
    save,
    seal,
    through,
    get state() {
      return state;
    },
  };
}
