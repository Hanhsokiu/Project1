import { vi } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  Prisma,
  GradingPolicy,
  GradingPolicyRevision,
  GradingSheet,
  GradingSheetRevision,
  GradingResult,
  GradingResultRevision,
} from "@prisma/client";
import type {
  GradingDraft,
  GradingKind,
  GradingPolicy as Config,
  CalculationPolicy,
} from "@doan/shared";
import { workflowFixture } from "../../defense/workflow/defense-workflow.test-fixtures";
import { GradingRepository, GradingSession } from "./grading.repository";
import { GradingSourceReader } from "./grading-source.reader";
import { GradingService } from "./grading.service";
import {
  AdvisorGradeReader,
  CouncilResultConfirmationReader,
  type AdvisorGrade,
  type CouncilResultConfirmation,
} from "./advisor-grade.port";
import { DefenseConfirmationValidator } from "../../guidance/defense-confirmations/defense-confirmation.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../../guidance/final-reports/final-report.validator";
import { SubmissionValidator } from "../../guidance/submissions/submission.validator";
import type { FileStorageService } from "../../common/storage/file-storage.service";
import type { AuditService } from "../../common/audit/audit.service";
import type { ReviewPrincipal } from "../../topic/proposal-reviews/proposal-review.repository";
import { hashJson } from "./grading.policy";
import { gradeEvidenceHash } from "./grading-evidence";

export const calculationForTest: CalculationPolicy = {
  scheme: "UTC_40_60_V1",
  approvalReference: "UNIT TEST ONLY; NOT BUSINESS APPROVAL",
  quorum: "ALL_OFFICIAL_MEMBERS",
  rounding: {
    mode: "HALF_UP",
    processDecimals: 2,
    committeeDecimals: 3,
    finalDecimals: 2,
    passOn: "ROUNDED",
  },
  minimum: { process: 5, committee: 5, final: 5 },
};
export const configForTest: Config = {
  schemaVersion: 1,
  windows: Object.fromEntries(
    ["REVIEWER", "COMMITTEE", "PUBLICATION"].map((k) => [
      k,
      {
        opensAt: "2026-09-01T00:00:00Z",
        closesAt: "2027-01-01T00:00:00Z",
        isLocked: false,
      },
    ]),
  ) as Config["windows"],
  committeeRubric: [
    { code: "PRESENTATION", label: "Tiêu chí GIẢ LẬP", maxScore: 10 },
  ],
  calculation: { state: "NEEDS_APPROVAL" },
};
export async function gradingFixture(reviewerId = "reviewer") {
  const base = workflowFixture();
  base.base.reviewers[0].reviewerIds = [reviewerId];
  await base.through("SCHEDULE");
  base.base.f.f.term.status = "DEFENDING";
  base.fault.time = new Date("2026-11-02T02:10:00Z");
  type Policy = GradingPolicy & { current: GradingPolicyRevision | null };
  type Sheet = GradingSheet & { current: GradingSheetRevision | null };
  type Result = GradingResult & { current: GradingResultRevision | null };
  let state = {
    policy: null as Policy | null,
    policyHistory: [] as GradingPolicyRevision[],
    sheets: [] as Sheet[],
    sheetHistory: [] as GradingSheetRevision[],
    results: [] as Result[],
    resultHistory: [] as GradingResultRevision[],
  };
  const fault = { at: "", cas: false },
    fail = (at: string) => {
      if (fault.at === at) throw new Error(`Injected ${at} failure`);
    };
  const actions = [
    "read",
    "write",
    "seal",
    "configure",
    "read-results",
    "seal-results",
    "publish",
    "read-published",
  ];
  const actors = new Map<string, ReviewPrincipal>();
  for (const id of [
    "reviewer",
    "chair",
    "secretary",
    "member-lecturer",
    "advisor",
    "faculty",
    "student",
    "stranger",
  ]) {
    const u = structuredClone(base.base.f.f.user);
    u.id = `${id}-user`;
    u.status = "ACTIVE";
    u.mustChangePassword = false;
    u.lecturer = ["student", "faculty"].includes(id)
      ? null
      : { ...u.lecturer!, id, userId: u.id, isActive: true };
    u.student = id === "student" ? { ...base.base.f.f.proposal.student } : null;
    u.userRoles[0].role.name =
      id === "faculty" ? "FACULTY" : id === "student" ? "STUDENT" : "LECTURER";
    u.userRoles[0].role.rolePermissions = [
      ...actions.map((action) => ({
        permission: { resource: "grading", action },
      })),
      { permission: { resource: "official-report", action: "export" } },
      { permission: { resource: "official-report", action: "read" } },
    ] as never;
    actors.set(u.id, u);
  }
  const grant = {
      userId: "faculty-user",
      termId: "term",
      allDepartments: true,
      pr2bGrantDepartmentGrantId: [] as { departmentId: string }[],
    },
    session = Object.assign(base.session, {
      principal: vi.fn(async (id: string) => actors.get(id) ?? null),
      grants: vi.fn(async (id: string) => (id === grant.userId ? [grant] : [])),
      currentDecision: vi.fn(async () => base.base.f.f.decision),
      report: vi.fn(async () => base.base.f.f.report),
      roster: vi.fn(async (termId: string, lecturerId: string) => ({
        termId,
        lecturerId,
      })),
      lockGrading: vi.fn(async (_termId: string) => {
        await base.session.lock();
      }),
      policyRecord: vi.fn(async () => state.policy),
      gradingParameters: vi.fn(async (termId: string) =>
        Object.entries({
          advisor_weight_in_process: "0.5",
          reviewer_weight_in_process: "0.5",
          process_weight: "0.4",
          committee_weight: "0.6",
          min_pass_score: "5",
        }).map(([key, value], i) => ({
          id: `parameter-${i}`,
          termId,
          key,
          value,
          updatedAt: new Date("2026-09-01T00:00:00Z"),
        })),
      ),
      policyRevision: vi.fn(
        async (termId: string, revision: number) =>
          state.policyHistory.find(
            (h) => h.termId === termId && h.revision === revision,
          ) ?? null,
      ),
      artifact: vi.fn(
        async (id: string) =>
          base.state.artifacts.find((a) => a.id === id) ?? null,
      ),
      sheetRevisions: vi.fn(async (ids: string[]) =>
        state.sheetHistory
          .filter((h) => ids.includes(h.id))
          .map((h) => ({
            ...h,
            sheet: state.sheets.find((s) => s.id === h.sheetId)!,
          })),
      ),
      createPolicy: vi.fn(async (termId: string) => {
        state.policy = {
          termId,
          revision: 0,
          currentRevisionId: null,
          current: null,
        };
      }),
      policyVersion: vi.fn(
        async (data: Prisma.GradingPolicyRevisionUncheckedCreateInput) => {
          fail("policy-history");
          state.policyHistory.push(data as GradingPolicyRevision);
        },
      ),
      policyUpdate: vi.fn(
        async (_termId: string, revision: number, next: string) => {
          if (!state.policy || state.policy.revision !== revision || fault.cas)
            return { count: 0 };
          state.policy = {
            ...state.policy,
            revision: revision + 1,
            currentRevisionId: next,
            current: state.policyHistory.find((h) => h.id === next)!,
          };
          return { count: 1 };
        },
      ),
      sheets: vi.fn(async (_termId: string, proposalId?: string) =>
        state.sheets.filter((s) => !proposalId || s.proposalId === proposalId),
      ),
      sheet: vi.fn(
        async (
          _termId: string,
          proposalId: string,
          userId: string,
          kind: GradingKind,
        ) =>
          state.sheets.find(
            (s) =>
              s.proposalId === proposalId &&
              s.scorerUserId === userId &&
              s.kind === kind,
          ) ?? null,
      ),
      createSheet: vi.fn(
        async (data: Prisma.GradingSheetUncheckedCreateInput) => {
          state.sheets.push({
            state: "DRAFT",
            revision: 0,
            currentRevisionId: null,
            current: null,
            ...data,
          } as Sheet);
        },
      ),
      sheetVersion: vi.fn(
        async (data: Prisma.GradingSheetRevisionUncheckedCreateInput) => {
          fail("history");
          state.sheetHistory.push(data as GradingSheetRevision);
        },
      ),
      sheetUpdate: vi.fn(
        async (
          id: string,
          revision: number,
          next: string,
          nextState: "DRAFT" | "SEALED",
        ) => {
          const row = state.sheets.find((s) => s.id === id);
          if (
            !row ||
            row.revision !== revision ||
            row.state !== "DRAFT" ||
            fault.cas
          )
            return { count: 0 };
          Object.assign(row, {
            revision: revision + 1,
            state: nextState,
            currentRevisionId: next,
            current: state.sheetHistory.find((h) => h.id === next),
          });
          return { count: 1 };
        },
      ),
      sheetHistory: vi.fn(async (id: string, after: number, limit: number) =>
        state.sheetHistory
          .filter((h) => h.sheetId === id && h.revision > after)
          .slice(0, limit + 1),
      ),
      result: vi.fn(
        async (id: string) =>
          state.results.find((r) => r.proposalId === id) ?? null,
      ),
      results: vi.fn(async () => state.results),
      createResult: vi.fn(async (termId: string, proposalId: string) => {
        state.results.push({
          termId,
          proposalId,
          revision: 0,
          state: "SEALED",
          currentRevisionId: null,
          current: null,
        });
      }),
      resultVersion: vi.fn(
        async (data: Prisma.GradingResultRevisionUncheckedCreateInput) => {
          fail("result-history");
          state.resultHistory.push(data as GradingResultRevision);
        },
      ),
      resultUpdate: vi.fn(
        async (
          id: string,
          revision: number,
          next: string,
          nextState: "SEALED" | "PUBLISHED",
        ) => {
          const row = state.results.find((r) => r.proposalId === id);
          if (
            !row ||
            row.revision !== revision ||
            row.state !== "SEALED" ||
            fault.cas
          )
            return { count: 0 };
          Object.assign(row, {
            revision: revision + 1,
            state: nextState,
            currentRevisionId: next,
            current: {
              ...state.resultHistory.find((h) => h.id === next)!,
              policy: state.policyHistory.find(
                (p) =>
                  p.revision ===
                  state.resultHistory.find((h) => h.id === next)!
                    .policyRevision,
              ),
            },
          });
          return { count: 1 };
        },
      ),
      resultHistory: vi.fn(async (id: string, after: number, limit: number) =>
        state.resultHistory
          .filter((h) => h.proposalId === id && h.revision > after)
          .slice(0, limit + 1)
          .map((h) => ({
            ...h,
            policy: state.policyHistory.find(
              (p) => p.termId === h.termId && p.revision === h.policyRevision,
            )!,
          })),
      ),
      policyHistory: vi.fn(async (_id: string, after: number, limit: number) =>
        state.policyHistory
          .filter((h) => h.revision > after)
          .slice(0, limit + 1),
      ),
      gradingWatchers: vi.fn(async () => ["faculty-user"]),
      reportLecturers: vi.fn(async (ids: string[]) =>
        ids.map((id) => ({ id, fullName: id, lecturerCode: id })),
      ),
    });
  const repo = {
    transaction: vi.fn(
      async <T>(
        write: boolean,
        work: (s: GradingSession, tx: Prisma.TransactionClient) => Promise<T>,
      ) =>
        base.repo.transaction(write, async (_s, tx) => {
          const before = structuredClone(state);
          try {
            return await work(session as unknown as GradingSession, tx);
          } catch (e) {
            if (write) state = before;
            throw e;
          }
        }),
    ),
  };
  const sources = new GradingSourceReader(
      base.reader,
      new DefenseConfirmationValidator(
        new ProposalReviewValidator(),
        new FinalReportValidator(),
        new SubmissionValidator(),
      ),
      base.storage as unknown as FileStorageService,
    ),
    advisor = {
      read: vi.fn(async (): Promise<AdvisorGrade> => ({ state: "UNKNOWN" })),
    },
    council = {
      read: vi.fn(async (): Promise<CouncilResultConfirmation> => ({
        state: "UNKNOWN",
      })),
    },
    service = new GradingService(
      repo as unknown as GradingRepository,
      sources,
      advisor as AdvisorGradeReader,
      council as CouncilResultConfirmationReader,
      base.audit as unknown as AuditService,
    );
  const configure = async () => {
    const p = await service.policy("faculty-user", "term");
    return service.configure("faculty-user", "term", {
      expectedRevision: p.revision,
      expectedContext: p.expectedContext,
      requestId: randomUUID(),
      config: structuredClone(configForTest),
    });
  };
  const context = (id = "reviewer-user", kind: GradingKind = "REVIEWER") =>
    service.context(id, "term", "proposal", kind);
  const command = async (
    id = "reviewer-user",
    kind: GradingKind = "REVIEWER",
  ) => {
    const c = await context(id, kind);
    return {
      expectedRevision: c.expectedRevision,
      expectedContext: c.expectedContext,
      requestId: randomUUID(),
    };
  };
  const save = async (
    id = "reviewer-user",
    kind: GradingKind = "REVIEWER",
    draft?: GradingDraft,
  ) => {
    const c = await context(id, kind),
      input = {
        ...(await command(id, kind)),
        draft: draft ?? {
          values: Object.fromEntries(
            c.rubric!.map((r) => [r.code, r.maxScore]),
          ),
          comment: "Nhận xét TEST",
          questions: kind === "REVIEWER" ? ["Câu hỏi 1?", "Câu hỏi 2?"] : [],
        },
      };
    return service.save(id, "term", "proposal", kind, input, false);
  };
  const seal = async (id = "reviewer-user", kind: GradingKind = "REVIEWER") =>
    service.save(id, "term", "proposal", kind, await command(id, kind), true);
  const approveForTest = () => {
    const row = state.policy!.current!,
      config = structuredClone(row.config) as Config;
    config.calculation = {
      state: "CONFIRMED",
      policy: calculationForTest,
      confirmedByUserId: "faculty-user",
      confirmedAt: row.recordedAt.toISOString(),
    };
    row.config = config as unknown as Prisma.JsonValue;
    row.contentHash = hashJson({
      termId: row.termId,
      revision: row.revision,
      config: row.config,
      recordedAt: row.recordedAt.toISOString(),
      recordedByUserId: row.recordedByUserId,
    });
    advisor.read.mockImplementation(async () => {
      const c = await sources.read(
        session as unknown as GradingSession,
        base.tx,
        "term",
        "proposal",
        "REVIEWER",
        reviewerId,
      );
      const data = {
        state: "VERIFIED",
        id: "advisor-grade",
        revision: 1,
        hash: "a".repeat(64),
        score: 9,
        advisorUserId: "advisor-user",
        assignment: c.snapshot!.assignment,
        pdf: {
          finalReportId: c.snapshot!.pdf.finalReportId,
          revision: c.snapshot!.pdf.revision,
          checksum: c.snapshot!.pdf.checksum,
        },
        evidence: {
          schemaVersion: 1,
          termId: "term",
          proposalId: "proposal",
          recordedAt: base.fault.time.toISOString(),
          recordedByUserId: "advisor-user",
          authorityReference: "UNIT TEST ONLY — NOT APPROVAL",
        },
      };
      return { ...data, hash: gradeEvidenceHash(data) } as AdvisorGrade;
    });
    council.read.mockImplementation(async () => {
      const schedule = base.state.stages.find((r) => r.stage === "SCHEDULE")!;
      const artifact = base.state.artifacts.find(
        (a) => a.id === schedule.currentArtifactId,
      )!;
      const data = {
        state: "VERIFIED",
        id: "confirmation",
        revision: 1,
        contentHash: "b".repeat(64),
        scheduleArtifactId: base.state.stages.find(
          (r) => r.stage === "SCHEDULE",
        )!.currentArtifactId!,
        gradeRevisionIds: state.sheets.map((s) => s.currentRevisionId!),
        evidence: {
          schemaVersion: 1,
          termId: "term",
          proposalId: "proposal",
          recordedAt: base.fault.time.toISOString(),
          recordedByUserId: "chair-user",
          authorityReference: "UNIT TEST ONLY — NOT APPROVAL",
          schedule: {
            id: artifact.id,
            revision: artifact.workflowRevision,
            hash: artifact.contentHash,
          },
          grades: state.sheets.map((s) => ({
            id: s.currentRevisionId!,
            revision: s.revision,
            hash: s.current!.contentHash,
          })),
        },
      };
      return {
        ...data,
        contentHash: gradeEvidenceHash(data),
      } as CouncilResultConfirmation;
    });
  };
  const allScores = async () => {
    await save();
    await seal();
    for (const id of ["chair", "secretary", "member-lecturer"]) {
      await save(`${id}-user`, "COMMITTEE");
      await seal(`${id}-user`, "COMMITTEE");
    }
  };
  const resultCommand = async (publish = false) => {
    const c = (await service.preview("faculty-user", "term")).items[0];
    return service.resultCommand(
      "faculty-user",
      "term",
      "proposal",
      {
        expectedRevision: c.revision,
        expectedContext: c.expectedContext,
        requestId: randomUUID(),
      },
      publish,
    );
  };
  return {
    base,
    session,
    repo,
    service,
    sources,
    advisor,
    council,
    grant,
    actors,
    fault,
    configure,
    context,
    command,
    save,
    seal,
    approveForTest,
    allScores,
    resultCommand,
    get state() {
      return state;
    },
  };
}
