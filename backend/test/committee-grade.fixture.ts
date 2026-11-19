// TEST_ONLY full producer chain, isolated memory/transactions/storage. No env/PrismaClient.
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import type { CommitteeGradeCommand, CommitteeGradePolicy } from "@doan/shared";
import {
  createReviewerGradeFixture,
  reviewerActor,
} from "./reviewer-grade.fixture";
import { ids } from "./final-defense.fixture";
import { memberId } from "./eligibility.fixture";
import { CommitteeGradeService } from "../src/defense/committee-grading/committee-grade.service";
import {
  CommitteeGradeRepository,
  CommitteeGradeSession,
} from "../src/defense/committee-grading/committee-grade.repository";
import { CommitteeGradeValidator } from "../src/defense/committee-grading/committee-grade.validator";
import type { ReviewerGradeRecord } from "../src/defense/reviewer-grading/reviewer-grade.repository";
import { ProposalReviewValidator } from "../src/topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";
import { FileStorageService } from "../src/common/storage/file-storage.service";
import { groupError } from "../src/topic/review-groups/review-group.errors";
export async function createCommitteeGradeFixture(dual = false, committeeCount = 3, reviewers?: string[]) {
  const rg = await createReviewerGradeFixture(reviewers ?? (dual ? ["l1"] : ["l4"]), dual, committeeCount),
    sc = rg.sc,
    rw = sc.rw,
    cc = rw.cc,
    f = rg.f,
    committeeId = rw.committeeId,
    users = f.users;
  if (dual) await rg.command("finalize");
  const actor = (lecturer = "l1") =>
    dual && lecturer === "l1" ? reviewerActor : `committee-${lecturer}`;
  const permit = (id: string, actions: string[], roleIndex = 0) => {
    for (const action of actions)
      users.get(id)!.userRoles[roleIndex].role.rolePermissions.push({
        permission: { resource: "defense-committee-grade", action },
      } as never);
  };
  for (const id of ["l1", "l2", "l3", "l4", "l5"].slice(0, committeeCount)) {
    if (!users.has(actor(id))) {
      const u = structuredClone(users.get(ids.outsider)!);
      u.id = actor(id);
      u.lecturer!.id = id;
      users.set(u.id, u);
    }
    permit(actor(id), [
      "read",
      "read-own",
      "save-own",
      "finalize-own",
      "download-own",
    ]);
  }
  permit(ids.faculty, ["read", "progress-read"]);
  const sessionId = (await sc.save()).sessions[0].id;
  await sc.transition(sessionId, "finalize");
  f.term.status = "DEFENDING";
  const policy: CommitteeGradePolicy = {
    version: "UNIT_MEMORY_FIXTURE_UC23",
    status: "APPROVED",
    approvedBy: ids.faculty,
    approvedAt: "2020-01-01T00:00:00Z",
    reference: "UNIT_MEMORY_FIXTURE, never faculty approval",
    effectiveFrom: "2020-01-01T00:00:00Z",
    effectiveScope: "GRADING_WINDOW",
    effectiveUntil: null,
    phaseCode: "DEFENSE",
    gradingRoles: ["CHAIR", "SECRETARY", "MEMBER"],
    draftAllowed: true,
    commentRequired: true,
    sourceChange: "BLOCK",
    afterFinalize: "IMMUTABLE",
    studentRelease: "WITHHELD",
    schedule: { required: true, requirePublished: false, anchor: "SESSION" },
    defenseEvidence: "NOT_REQUIRED",
    rubric: {
      version: "UNIT_MEMORY_FIXTURE_COMMITTEE_RUBRIC",
      calculation: "WEIGHTED_NORMALIZED_10",
      missingOptional: "BLOCK",
      rounding: { mode: "EXACT", decimalPlaces: 1 },
      totalStep: "0.1",
      criteria: [
        {
          id: "c1",
          name: "TEST_ONLY criterion A",
          description: "TEST_ONLY description",
          minScore: "0",
          maxScore: "10",
          step: "0.5",
          weight: "0.6",
          required: true,
        },
        {
          id: "c2",
          name: "TEST_ONLY criterion B",
          description: null,
          minScore: "0",
          maxScore: "10",
          step: "0.5",
          weight: "0.4",
          required: true,
        },
      ],
    },
  };
  const control = {
    schema: true,
    approved: true,
    writes: true,
    auditFailure: false,
    rememberFailure: false,
    storageFailure: false,
    corrupt: false,
    rubricMismatch: false,
  };
  type Stored = Omit<ReviewerGradeRecord, "totalScore" | "scoreDetails"> & {
    totalScore: string | null;
    scoreDetails: (Omit<
      ReviewerGradeRecord["scoreDetails"][number],
      "score"
    > & { score: string })[];
  };
  let state = {
    scores: [] as Stored[],
    events: [] as {
      id: string;
      userId: string;
      resourceId: string;
      action: string;
      createdAt: Date;
      oldValue: unknown;
      newValue: unknown;
    }[],
    replays: new Map<string, { payloadHash: string; result: unknown }>(),
  };
  const materialize = (r: Stored): ReviewerGradeRecord => ({
    ...r,
    totalScore: r.totalScore === null ? null : new Prisma.Decimal(r.totalScore),
    scoreDetails: r.scoreDetails.map((d) => ({
      ...d,
      score: new Prisma.Decimal(d.score),
    })),
  });
  const s = {
    ...rg.session,
    cgReady: async () => control.schema,
    cgPolicy: async () => ({
      value: control.approved ? JSON.stringify(policy) : "{}",
    }),
    cgTermIds: async (id: string) =>
      (await cc.session.ccList(ids.term))
        .filter((c) => c.members.some((m) => m.lecturerId === id))
        .map((c) => ({ committee: { termId: c.termId } })),
    cgScores: async (p: string, l: string) =>
      state.scores
        .filter(
          (s) =>
            s.proposalId === p &&
            s.scorerId === l &&
            ["COMMITTEE_MEMBER", "COMMITTEE_CHAIR"].includes(s.role),
        )
        .map(materialize),
    rgRubric: async () =>
      control.rubricMismatch
        ? []
        : policy.rubric.criteria.map((c) => ({
            ...c,
            termId: ids.term,
            weight: new Prisma.Decimal(c.weight),
            maxScore: new Prisma.Decimal(c.maxScore),
          })),
    cgEvents: async (id: string) =>
      state.events.filter((e) => e.resourceId === id),
    cgEvent: async (
      userId: string,
      resourceId: string,
      action: string,
      oldValue: unknown,
      newValue: unknown,
    ) => {
      if (control.auditFailure) throw Error("TEST_ONLY audit failure");
      state.events.unshift({
        id: randomUUID(),
        userId,
        resourceId,
        action,
        createdAt: new Date(),
        oldValue: JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue)),
      });
    },
    cgSave: async (
      p: string,
      l: string,
      expected: number,
      data: Stored,
      details: Record<string, string>,
    ) => {
      const old = state.scores.find(
        (r) =>
          r.proposalId === p &&
          r.scorerId === l &&
          r.role === "COMMITTEE_MEMBER",
      );
      if ((old?.revision ?? 0) !== expected || old?.isLocked)
        groupError(409, "REVISION_CONFLICT", "TEST_ONLY CAS");
      const now = new Date(),
        saved = {
          ...data,
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
          revision: expected + 1,
          scoreDetails: Object.entries(details).map(
            ([rubricCriteriaId, score]) => ({
              id: randomUUID(),
              scoreEntryId: data.id,
              rubricCriteriaId,
              score,
              comment: null,
              createdAt: now,
            }),
          ),
        };
      if (old) state.scores.splice(state.scores.indexOf(old), 1, saved);
      else state.scores.push(saved);
      return materialize(saved);
    },
    replay: async (a: string, r: string, k: string) =>
      state.replays.get([a, r, k].join("|")) ?? null,
    remember: async (
      a: string,
      r: string,
      k: string,
      payloadHash: string,
      result: unknown,
    ) => {
      if (control.rememberFailure) throw Error("TEST_ONLY idempotency failure");
      state.replays.set([a, r, k].join("|"), {
        payloadHash,
        result: structuredClone(result),
      });
    },
  } as unknown as CommitteeGradeSession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: CommitteeGradeSession) => Promise<T>) => fn(s),
    write: <T>(fn: (s: CommitteeGradeSession) => Promise<T>) => {
      const job = queue.then(async () => {
        const before = structuredClone(state);
        try {
          return await fn(s);
        } catch (e) {
          state = before;
          throw e;
        }
      });
      queue = job.then(
        () => {},
        () => {},
      );
      return job;
    },
  } as CommitteeGradeRepository;
  const review = new ProposalReviewValidator(),
    service = new CommitteeGradeService(
      repo,
      cc.service,
      sc.service,
      rw.service,
      review,
      new GuidanceValidator(review),
      new CommitteeGradeValidator(),
      {
        readPrivateGuidance: async (key: string) => {
          if (control.storageFailure)
            throw Error("TEST_ONLY missing private file");
          return control.corrupt ? Buffer.from("corrupt") : f.bytes.get(key)!;
        },
      } as unknown as FileStorageService,
      {
        get: () => (control.writes ? "true" : "false"),
      } as unknown as ConfigService,
    );
  const detail = (who = actor(), lecturer?: string) =>
    service.detail(who, memberId, ids.term, committeeId, lecturer);
  const body = async (who = actor()): Promise<CommitteeGradeCommand> => {
    const v = await detail(who);
    return {
      termId: ids.term,
      committeeId,
      expectedRevision: v.revision,
      committeeRevision: v.committeeRevision,
      committeeEvidenceHash: v.committeeEvidenceHash,
      assignmentRevision: v.assignmentRevision,
      membershipHash: v.membershipHash,
      reportVersionId: v.report!.id,
      reportChecksum: v.report!.checksum,
      policyHash: v.policyHash,
      rubricHash: v.rubricHash,
      scheduleHash: v.schedule!.hash,
      criterionScores: [
        { criterionId: "c1", score: "8" },
        { criterionId: "c2", score: "9" },
      ],
      comment: "TEST_ONLY own committee comment",
    };
  };
  const command = async (action: "save" | "finalize" = "save", who = actor()) =>
    service.command(who, memberId, await body(who), randomUUID(), action);
  return {
    rg,
    sc,
    rw,
    cc,
    f,
    committeeId,
    sessionId,
    users,
    actor,
    permit,
    policy,
    control,
    session: s,
    repo,
    service,
    detail,
    body,
    command,
    get state() {
      return state;
    },
  };
}
