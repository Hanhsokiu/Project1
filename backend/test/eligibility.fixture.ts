// Synthetic adapter only; no PrismaClient, environment loading or network.
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import type { DefenseEligibility } from "@prisma/client";
import type { AcademicAttestationInput, EligibilityPolicy } from "@doan/shared";
import {
  createFinalDefenseFixture,
  ids,
  syntheticFile,
} from "./final-defense.fixture";
import { EligibilityService } from "../src/defense/eligibility/eligibility.service";
import {
  EligibilityRepository,
  EligibilitySession,
} from "../src/defense/eligibility/eligibility.repository";
import { EligibilityValidator } from "../src/defense/eligibility/eligibility.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../src/topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";
import { FinalDefenseValidator } from "../src/guidance/final-defense/final-defense.validator";
import { FileStorageService } from "../src/common/storage/file-storage.service";
import { groupError } from "../src/topic/review-groups/review-group.errors";

export const memberId = "term-student";
export const academicInput: AcademicAttestationInput = {
  source: "synthetic-approved-source",
  reference: "Synthetic academic registry reference; not production policy",
  outcome: "PASS",
  effectiveFrom: "2020-01-01T00:00:00Z",
  validUntil: "2099-01-01T00:00:00Z",
};
export function configureStrictEligibilityProgress(
  s: EligibilitySession,
  termId = ids.term,
) {
  const startsAt = "2020-01-01T00:00:00Z",
    dueAt = "2020-02-01T00:00:00Z";
  const review = {
    id: "review",
    state: "RECORDED",
    decision: "PASS",
    submissionId: "submission",
    assignmentRevision: 0,
    reviewerUserId: ids.lecturer,
    recordedAt: new Date(dueAt),
    revision: 0,
  };
  const submission = {
    id: "submission",
    taskId: "task",
    pr2bSubmissionWorkflowSubmissionId: {
      taskId: "task",
      state: "REVIEWED",
      submittedByUserId: ids.student,
      submittedAt: new Date(startsAt),
      effectiveReviewId: "review",
      refEffectiveReviewId: review,
      contextSnapshot: {
        studentId: "student-profile",
        planId: "plan",
        periodId: "week",
        files: [
          { fileId: "report", checksum: "report-hash" },
          { fileId: "source", checksum: "source-hash" },
        ],
      },
    },
    pr2bSubmissionAssetSubmissionId: [
      {
        fileId: "report",
        refFileId: { kind: "REPORT", state: "READY", checksum: "report-hash" },
      },
      {
        fileId: "source",
        refFileId: { kind: "SOURCE", state: "READY", checksum: "source-hash" },
      },
    ],
  };
  const task = {
    id: "task",
    guidancePlanId: "plan",
    pr2bTaskWorkflowTaskId: {
      state: "COMPLETED",
      kind: "WEEKLY_REPORT",
      startsAt: new Date(startsAt),
      expectedDeliverables: "Report and source",
      planId: "plan",
      assignedAdvisorId: "official-advisor",
      periodId: "week",
      currentSubmissionId: "submission",
      refCurrentSubmissionId: submission,
    },
  };
  const plan = {
    id: "plan",
    advisorId: "official-advisor",
    pr2bGuidancePlanWorkflowPlanId: {
      state: "ACTIVE",
      assignmentId: "assignment",
      assignmentRevision: 0,
      finalizationId: "finalization",
    },
    tasks: [task],
  };
  const obligation = {
    id: "obligation",
    termStudentId: memberId,
    periodId: "week",
    planId: "plan",
    currentTaskId: "task",
    refCurrentTaskId: task,
    configRevision: 1,
    configSnapshot: {
      schemaVersion: 1,
      periodId: "week",
      termStudentId: memberId,
      termId,
      periodRevision: 1,
      startsAt,
      reportDueAt: dueAt,
      expectedDeliverables: "Report",
    },
    refPeriodId: {
      id: "week",
      termId,
      type: "WEEK",
      revision: 1,
      startsAt: new Date(startsAt),
      reportDueAt: new Date(dueAt),
    },
  };
  s.eligibilityProgress = (async () =>
    plan) as unknown as EligibilitySession["eligibilityProgress"];
  s.obligations = (async () => [
    obligation,
  ]) as unknown as EligibilitySession["obligations"];
  s.eligibilityCoverage = (async () => [
    { periodId: "week" },
  ]) as unknown as EligibilitySession["eligibilityCoverage"];
  return { plan, task, submission, review, obligation };
}
export async function createEligibilityFixture() {
  const f = createFinalDefenseFixture();
  await f.service.upload(
    ids.student,
    ids.proposal,
    0,
    syntheticFile(),
    "uc18-fixture-pdf",
  );
  const version = f.state.report!.versions[0].id;
  await f.service.summarize(
    ids.lecturer,
    ids.proposal,
    {
      expectedRevision: 1,
      reportVersionId: version,
      score: 8,
      comment: "Synthetic advisor review",
      criterionScores: {},
    },
    "uc18-fixture-summary",
  );
  await f.service.confirm(
    ids.lecturer,
    ids.proposal,
    { expectedRevision: 2, reportVersionId: version, status: "CONFIRMED" },
    "uc18-fixture-confirm",
  );
  for (const u of f.users.values()) {
    const role = u.userRoles[0].role;
    for (const action of role.name === "FACULTY"
      ? ["read", "review", "decide", "finalize"]
      : ["read"])
      role.rolePermissions.push({
        permission: { resource: "defense-eligibility", action },
      } as (typeof role.rolePermissions)[number]);
  }
  const policy: EligibilityPolicy = {
    version: "synthetic-only-uc18-v1",
    approvedBy: ids.faculty,
    approvedAt: "2020-01-01T00:00:00Z",
    status: "APPROVED",
    phaseCode: "FINAL",
    progressRule: "UC17_REVIEW",
    academicSources: [
      {
        key: academicInput.source,
        label: "Synthetic authority",
        mode: "FACULTY_ATTESTATION",
      },
    ],
  };
  const content = {
    schemaVersion: 1,
    objectives: "Objectives",
    scope: "Scope",
    mainContents: "Content",
    tools: "Tools",
    expectedResults: "Results",
    startsAt: "2020-01-01T00:00:00Z",
    endsAt: "2020-02-01T00:00:00Z",
    schedule: [
      {
        label: "Work",
        startsAt: "2020-01-01T00:00:00Z",
        endsAt: "2020-02-01T00:00:00Z",
        deliverables: "Result",
      },
    ],
  };
  const snapshot = {
    schemaVersion: 1,
    student: { id: f.p.studentId },
    topicRevision: 1,
    content,
  };
  const finalization = {
    id: "finalization",
    versionId: "sealed-version",
    approvalDecisionId: "approval",
    supersededAt: null,
    printSnapshot: snapshot,
    contentHash: reviewHash(snapshot),
    finalizedAt: new Date("2020-03-01T00:00:00Z"),
  };
  Object.assign(f.p, {
    pr2bProposalWorkflowProposalId: {
      workingVersionId: "sealed-version",
      submittedVersionId: "sealed-version",
    },
  });
  const student = {
    ...f.p.student,
    isActive: true,
    academicEligible: true,
    gpa: 4,
  };
  const control = {
    schema: true,
    policy: true,
    writes: true,
    auditFailure: false,
    rememberFailure: false,
    dossierFinalized: true,
    memberTerm: ids.term,
    ownerStudent: f.p.studentId,
    proposalPresent: true,
    ambiguous: false,
    allDepartments: false,
  };
  type Event = {
    id: string;
    userId: string;
    createdAt: Date;
    action: string;
    newValue: unknown;
  };
  let state = {
    row: null as DefenseEligibility | null,
    events: [] as Event[],
    replay: new Map<string, { payloadHash: string; result: unknown }>(),
  };
  const replayKey = (actor: string, route: string, key: string) =>
    [actor, route, key].join("|");
  const s = {
    ...f.session,
    eligibilitySchemaReady: async () => control.schema,
    eligibilityLegacyReady: async () => true,
    eligibilityPolicy: async () => ({
      value: control.policy ? JSON.stringify(policy) : "{}",
    }),
    eligibilityAdvisor: async () => ({
      userId: ids.lecturer,
      fullName: "Synthetic advisor",
    }),
    member: async (id: string) =>
      id === memberId
        ? {
            id,
            termId: control.memberTerm,
            studentId: control.ownerStudent,
            student,
          }
        : null,
    members: async () => [{ id: memberId }],
    memberProposal: async () => ({
      owner: null,
      proposals: control.proposalPresent
        ? control.ambiguous
          ? [f.p, f.p]
          : [f.p]
        : [],
    }),
    grants: async () => [
      {
        termId: ids.term,
        allDepartments: control.allDepartments,
        pr2bGrantDepartmentGrantId: [
          { departmentId: f.control.facultyDepartment },
        ],
      },
    ],
    dossier: async () => ({
      pr2bDossierWorkflowDossierId: {
        state: control.dossierFinalized ? "FINALIZED" : "DRAFT",
        currentFinalizationId: finalization.id,
      },
      pr2bDossierFinalizationDossierId: [finalization],
    }),
    version: async () => ({
      proposalId: ids.proposal,
      content,
      pr2bProposalVersionWorkflowVersionId: {
        state: "SEALED",
        contentHash: reviewHash(content),
      },
    }),
    eligibility: async () => state.row,
    legacyEligibility: async () => state.row,
    eligibilityEvents: async () => state.events,
    eligibilityEvent: async (
      userId: string,
      _proposal: string,
      action: string,
      _old: unknown,
      newValue: unknown,
    ) => {
      if (control.auditFailure) throw Error("Synthetic audit failure");
      state.events.push({
        id: randomUUID(),
        userId,
        action,
        newValue: structuredClone(newValue),
        createdAt: new Date(),
      });
    },
    saveEligibility: async (
      proposalId: string,
      expected: number,
      data: object,
    ) => {
      if ((state.row?.revision ?? 0) !== expected || state.row?.finalizedAt)
        groupError(409, "REVISION_CONFLICT", "Synthetic revision conflict");
      state.row = {
        ...(state.row ?? {
          id: randomUUID(),
          proposalId,
          createdAt: new Date(),
          decidedAt: null,
          decidedBy: null,
          finalizedAt: null,
          finalizedBy: null,
        }),
        ...data,
        revision: expected + 1,
      } as DefenseEligibility;
      return state.row;
    },
    replay: async (actor: string, route: string, key: string) =>
      state.replay.get(replayKey(actor, route, key)) ?? null,
    remember: async (
      actor: string,
      route: string,
      key: string,
      payloadHash: string,
      result: unknown,
    ) => {
      if (control.rememberFailure) throw Error("Synthetic idempotency failure");
      state.replay.set(replayKey(actor, route, key), {
        payloadHash,
        result: structuredClone(result),
      });
    },
  } as unknown as EligibilitySession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: EligibilitySession) => Promise<T>) => fn(s),
    write: <T>(fn: (s: EligibilitySession) => Promise<T>) => {
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
  } as unknown as EligibilityRepository;
  const service = new EligibilityService(
    repo,
    new ProposalReviewValidator(),
    new GuidanceValidator(new ProposalReviewValidator()),
    new FinalDefenseValidator(),
    new EligibilityValidator(),
    {
      readPrivateGuidance: async (key: string) => {
        const b = f.bytes.get(key);
        if (!b) throw Error("Synthetic missing PDF");
        return b;
      },
    } as unknown as FileStorageService,
    {
      get: () => (control.writes ? "true" : "false"),
    } as unknown as ConfigService,
  );
  const detail = () => service.detail(ids.faculty, memberId, ids.term);
  const review = async (academic = academicInput, key = "review") => {
    const v = await detail();
    return service.reviewDossier(
      ids.faculty,
      memberId,
      {
        termId: ids.term,
        expectedRevision: v.revision,
        evidenceHash: v.evidenceHash,
        reason: "Synthetic review",
        academic,
      },
      key,
    );
  };
  const decide = async (
    status: "ELIGIBLE" | "INELIGIBLE" | "DEFERRED" = "ELIGIBLE",
    key = "decide",
  ) => {
    const v = await detail();
    return service.decide(
      ids.faculty,
      memberId,
      {
        termId: ids.term,
        expectedRevision: v.revision,
        evidenceHash: v.evidenceHash,
        reason: "Synthetic decision",
        status,
      },
      key,
    );
  };
  const finalize = async (key = "finalize") => {
    const v = await detail();
    return service.finalize(
      ids.faculty,
      {
        termId: ids.term,
        reason: "Synthetic roster",
        members: [
          {
            termStudentId: memberId,
            expectedRevision: v.revision,
            evidenceHash: v.evidenceHash,
          },
        ],
      },
      key,
    );
  };
  return {
    f,
    service,
    session: s,
    repo,
    control,
    policy,
    student,
    finalization,
    detail,
    review,
    decide,
    finalize,
    get state() {
      return state;
    },
  };
}
