// Synthetic in-memory persistence only. Never creates a PrismaClient or reads .env.
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import type {
  FileAsset,
  ScoreEntry,
  DefenseConfirmation,
} from "@prisma/client";
import { FinalDefenseService } from "../src/guidance/final-defense/final-defense.service";
import {
  FinalDefenseRepository,
  FinalDefenseSession,
} from "../src/guidance/final-defense/final-defense.repository";
import { FinalDefenseValidator } from "../src/guidance/final-defense/final-defense.validator";
import { ProposalReviewValidator } from "../src/topic/proposal-reviews/proposal-review.validator";
import type {
  ReviewPrincipal,
  ReviewProposal,
} from "../src/topic/proposal-reviews/proposal-review.repository";
import { SubmissionValidator } from "../src/guidance/submissions/submission.validator";
import { FileStorageService } from "../src/common/storage/file-storage.service";
import type { FinalDefensePolicy } from "@doan/shared";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";

export const ids = {
  student: "10000000-0000-4000-8000-000000000001",
  lecturer: "10000000-0000-4000-8000-000000000002",
  faculty: "10000000-0000-4000-8000-000000000003",
  outsider: "10000000-0000-4000-8000-000000000004",
  admin: "10000000-0000-4000-8000-000000000005",
  proposal: "20000000-0000-4000-8000-000000000001",
  term: "30000000-0000-4000-8000-000000000001",
};
export const syntheticPolicy: FinalDefensePolicy = {
  version: "synthetic-only-v1",
  approvedBy: ids.faculty,
  approvedAt: "2020-01-01T00:00:00Z",
  status: "APPROVED",
  scoreStep: 0.5,
  maxPdfBytes: 1024 * 1024,
  replacementAfterDecision: "INVALIDATE",
  rubric: null,
};
const all = [
  "defense-confirmation:read",
  "defense-confirmation:status-read",
  "final-report:read",
  "final-report:download",
];
const principal = (
  id: string,
  role: string,
  permissions: string[],
): ReviewPrincipal =>
  ({
    id,
    username: `synthetic-${role}`,
    email: "synthetic@example.invalid",
    phone: "0900000000",
    status: "ACTIVE",
    mustChangePassword: false,
    student:
      role === "STUDENT"
        ? {
            id: "student-profile",
            isActive: true,
            fullName: "Sinh viên tổng hợp",
            studentCode: "SYNTHETIC01",
            trainingSystem: { name: "Synthetic" },
          }
        : null,
    lecturer:
      role === "LECTURER"
        ? {
            id: id === ids.lecturer ? "official-advisor" : "other-advisor",
            isActive: true,
            fullName: "GV tổng hợp",
            researchAreas: [],
          }
        : null,
    userRoles: [
      {
        role: {
          name: role,
          rolePermissions: permissions.map((p) => {
            const [resource, action] = p.split(":");
            return { permission: { resource, action } };
          }),
        },
      },
    ],
  }) as unknown as ReviewPrincipal;
type Report = NonNullable<Awaited<ReturnType<FinalDefenseSession["report"]>>>;
type Event = { id: string; userId: string; action: string; createdAt: Date; newValue: unknown };
type Replay = {
  actorId: string;
  route: string;
  key: string;
  payloadHash: string;
  result: unknown;
};
export function createFinalDefenseFixture() {
  const policy = structuredClone(syntheticPolicy);
  const users = new Map([
    [
      ids.student,
      principal(ids.student, "STUDENT", [...all, "final-report:create"]),
    ],
    [
      ids.lecturer,
      principal(ids.lecturer, "LECTURER", [
        ...all,
        ...[
          "review",
          "decide",
          "score-read",
          "comment-read",
          "rejection-read",
        ].map((p) => `defense-confirmation:${p}`),
      ]),
    ],
    [ids.faculty, principal(ids.faculty, "FACULTY", all)],
    [
      ids.outsider,
      principal(ids.outsider, "LECTURER", [
        ...all,
        "defense-confirmation:review",
      ]),
    ],
    [
      ids.admin,
      principal(ids.admin, "ADMIN", [...all, "defense-confirmation:review"]),
    ],
  ]);
  const now = Date.now();
  const p = {
    id: ids.proposal,
    studentId: "student-profile",
    termId: ids.term,
    status: "APPROVED",
    student: {
      id: "student-profile",
      studentCode: "SYNTHETIC01",
      fullName: "Sinh viên tổng hợp",
      userId: ids.student,
    },
    topic: {
      id: "topic",
      title: "Đề tài synthetic",
      termId: ids.term,
      pr2bTopicWorkflowTopicId: {
        termStudentId: "term-student",
        termId: ids.term,
        revision: 1,
        confirmedAt: new Date(now - 60000),
        confirmedByAdvisorId: "official-advisor",
        confirmedTopicRevision: 1,
        confirmedAssignmentRevision: 0,
        refTermStudentId: { termId: ids.term, studentId: "student-profile" },
      },
      researchArea: {
        pr2bResearchAreaWorkflowResearchAreaId: { departmentId: "department" },
      },
    },
  } as unknown as ReviewProposal;
  const assignment = {
    id: "assignment",
    advisorId: "official-advisor",
    advisor: { isActive: true },
    assignmentPlan: {
      id: "official-plan",
      termId: ids.term,
      status: "FINALIZED",
      pr2bAssignmentPlanWorkflowPlanId: {
        finalizedAt: new Date(now - 60000),
        finalizedByUserId: ids.faculty,
      },
    },
    pr2bAssignmentChangeAssignmentId: [] as {
      effectiveAt: Date;
      newAdvisorId: string;
      assignmentRevision: number;
    }[],
  };
  let state = {
    report: null as Report | null,
    decision: null as DefenseConfirmation | null,
    score: null as ScoreEntry | null,
    assets: new Map<string, FileAsset>(),
    events: [] as Event[],
    replay: new Map<string, Replay>(),
  };
  const control = {
    schemaReady: true,
    approved: true,
    writes: true,
    facultyDepartment: "department",
    locked: false,
    storageFailure: false,
    eventFailure: false,
    auditCalls: 0,
  };
  const bytes = new Map<string, Buffer>();
  const replayKey = (actor: string, route: string, key: string) =>
    [actor, route, key].join("|");
  const term = {
    id: ids.term,
    status: "IN_PROGRESS",
    isLocked: false,
    startDate: new Date(now - 3600000),
    endDate: new Date(now + 3600000),
    phases: [
      {
        id: "final-phase",
        code: "FINAL",
        startDate: new Date(now - 300000),
        endDate: new Date(now + 300000),
        isLocked: false,
      },
    ],
    pr2bTermWorkflowTermId: { officialAssignmentPlanId: "official-plan" },
  };
  const s = {
    principal: async (id: string) => users.get(id) ?? null,
    proposal: async (id: string) => (id === p.id ? p : null),
    proposals: async (where: { termId: string }) =>
      where.termId === ids.term ? [p] : [],
    candidateIds: async (where: { termId: string }) =>
      where.termId === ids.term ? [{ id: p.id }] : [],
    progressEvidence: async () => null,
    advisor: async () => ({ advisorAssignment: assignment }),
    roster: async () => ({}),
    term: async () => term,
    windowTerm: async () => ({ ...term, isLocked: control.locked }),
    grants: async () => [
      {
        termId: ids.term,
        allDepartments: false,
        pr2bGrantDepartmentGrantId: [
          { departmentId: control.facultyDepartment },
        ],
      },
    ],
    studentTerms: async () => [{ termId: ids.term }],
    advisorTerms: async () => [
      { termId: ids.term, advisorAssignment: assignment },
    ],
    terms: async () => [
      { id: ids.term, name: "Synthetic", code: "SYN", status: "IN_PROGRESS" },
    ],
    lock: async () => {},
    schemaReady: async () => control.schemaReady,
    policy: async () => ({
      value: control.approved ? JSON.stringify(policy) : "{}",
    }),
    report: async () => {
      if (state.report)
        for (const v of state.report.versions)
          v.fileAsset = state.assets.get(v.fileAssetId)!;
      return state.report;
    },
    legacyReport: async () => state.report,
    legacyDecision: async () => state.decision,
    finalDecision: async () => state.decision,
    advisorScore: async (_p: string, scorer: string) =>
      state.score?.scorerId === scorer ? state.score : null,
    events: async () => state.events,
    event: async (
      _user: string,
      _proposal: string,
      action: string,
      _old: unknown,
      value: unknown,
    ) => {
      control.auditCalls++;
      if (control.eventFailure) throw Error("Synthetic audit failure");
      state.events.push({
        id: randomUUID(),
        userId: _user,
        action,
        createdAt: new Date(),
        newValue: structuredClone(value),
      });
    },
    replay: async (actor: string, route: string, key: string) =>
      state.replay.get(replayKey(actor, route, key)) ?? null,
    remember: async (
      actorId: string,
      route: string,
      key: string,
      payloadHash: string,
      result: unknown,
    ) => {
      state.replay.set(replayKey(actorId, route, key), {
        actorId,
        route,
        key,
        payloadHash,
        result,
      });
    },
    advanceReport: async (_id: string, expected: number) => {
      if (state.report?.revision !== expected)
        throw Error("Synthetic compare-and-swap failure");
      state.report.revision++;
    },
    finalDb: {
      finalReport: {
        create: async ({ data }: { data: { proposalId: string } }) => {
          state.report = {
            id: randomUUID(),
            proposalId: data.proposalId,
            revision: 0,
            createdAt: new Date(),
            submittedAt: null,
            filePath: null,
            versions: [],
          };
          return state.report;
        },
        update: async ({ data }: { data: { submittedAt: Date } }) => {
          state.report!.submittedAt = data.submittedAt;
          return state.report;
        },
      },
      fileAsset: {
        create: async ({ data }: { data: FileAsset }) => {
          state.assets.set(data.id, data);
          return data;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<FileAsset>;
        }) => {
          Object.assign(state.assets.get(where.id)!, data);
          return state.assets.get(where.id);
        },
      },
      finalReportVersion: {
        create: async ({
          data,
        }: {
          data: { reportId: string; sequence: number; fileAssetId: string };
        }) => {
          const v = {
            ...data,
            id: randomUUID(),
            submittedAt: new Date(),
            fileAsset: state.assets.get(data.fileAssetId)!,
          };
          state.report!.versions.unshift(v);
          return v;
        },
      },
      scoreEntry: {
        upsert: async ({
          create,
          update,
        }: {
          create: ScoreEntry;
          update: Partial<ScoreEntry>;
        }) => {
          state.score = {
            ...(state.score ?? {
              id: randomUUID(),
              revision: -1,
              isLocked: false,
            }),
            ...(state.score ? update : create),
            revision: (state.score?.revision ?? -1) + 1,
          } as ScoreEntry;
          return state.score;
        },
      },
      defenseConfirmation: {
        upsert: async ({
          create,
          update,
        }: {
          create: DefenseConfirmation;
          update: Partial<DefenseConfirmation>;
        }) => {
          state.decision = {
            ...(state.decision ?? { id: randomUUID(), revision: -1 }),
            ...(state.decision ? update : create),
            revision: (state.decision?.revision ?? -1) + 1,
          } as DefenseConfirmation;
          return state.decision;
        },
        update: async ({ data }: { data: Partial<DefenseConfirmation> }) => {
          const rev = state.decision!.revision;
          Object.assign(state.decision!, data, { revision: rev + 1 });
          return state.decision;
        },
      },
      idempotencyRecord: {
        update: async ({
          where,
          data,
        }: {
          where: {
            actorId_method_route_key: {
              actorId: string;
              route: string;
              key: string;
            };
          };
          data: { result: unknown };
        }) => {
          const k = where.actorId_method_route_key;
          state.replay.get(replayKey(k.actorId, k.route, k.key))!.result =
            data.result;
        },
      },
    },
  } as unknown as FinalDefenseSession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: FinalDefenseSession) => Promise<T>) => fn(s),
    write: <T>(fn: (s: FinalDefenseSession) => Promise<T>) => {
      const task = queue.then(async () => {
        const before = structuredClone(state);
        try {
          return await fn(s);
        } catch (e) {
          state = before;
          throw e;
        }
      });
      queue = task.then(
        () => {},
        () => {},
      );
      return task;
    },
  } as unknown as FinalDefenseRepository;
  const storage = {
    savePrivateGuidance: async (key: string, value: Buffer) => {
      if (control.storageFailure) throw Error("Synthetic storage failure");
      if (bytes.has(key)) throw Error("Write-once collision");
      bytes.set(key, Buffer.from(value));
    },
    readPrivateGuidance: async (key: string) => {
      if (!bytes.has(key)) throw Error("Synthetic missing file");
      return bytes.get(key)!;
    },
  } as unknown as FileStorageService;
  const config = {
    get: () => (control.writes ? "true" : "false"),
  } as unknown as ConfigService;
  const service = new FinalDefenseService(
    repo,
    new ProposalReviewValidator(),
    new FinalDefenseValidator(),
    new SubmissionValidator(),
    storage,
    config,
    new GuidanceValidator(new ProposalReviewValidator()),
  );
  return {
    service,
    users,
    p,
    assignment,
    control,
    policy,
    bytes,
    get state() {
      return state;
    },
    term,
    session: s,
  };
}
export function syntheticFile() {
  // Envelope fixture for the inherited UC15 validator; not a full parser/AV claim.
  const buffer = Buffer.from(
    "%PDF-1.7\n1 0 obj\n<</Type /Catalog>>\nendobj\nstartxref\n0\n%%EOF\n",
  );
  return {
    originalname: "synthetic-final.pdf",
    mimetype: "application/pdf",
    buffer,
    size: buffer.length,
  } as Express.Multer.File;
}
