// TEST_ONLY: actual UC17 -> UC20/21 services; isolated transactional adapter.
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import type { ReviewerGradeCommand, ReviewerGradePolicy } from "@doan/shared";
import { createScheduleFixture } from "./schedule.fixture";
import { ids } from "./final-defense.fixture";
import { memberId } from "./eligibility.fixture";
import { ReviewerGradeService } from "../src/defense/reviewer-grading/reviewer-grade.service";
import {
  ReviewerGradeRepository,
  ReviewerGradeSession,
  ReviewerGradeRecord,
} from "../src/defense/reviewer-grading/reviewer-grade.repository";
import { ReviewerGradeValidator } from "../src/defense/reviewer-grading/reviewer-grade.validator";
import { ProposalReviewValidator } from "../src/topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";
import { FileStorageService } from "../src/common/storage/file-storage.service";
import { groupError } from "../src/topic/review-groups/review-group.errors";
export const reviewerActor = "test-reviewer-account";
export async function createReviewerGradeFixture(
  reviewers = ["l4"],
  allowCommittee = false,
  committeeCount = 3,
) {
  const sc = await createScheduleFixture(committeeCount),
    rw = sc.rw,
    f = rw.cc.eligibility.f,
    users = f.users;
  const permit = (actor: string, actions: string[]) => {
    for (const action of actions)
      users.get(actor)!.userRoles[0].role.rolePermissions.push({
        permission: { resource: "defense-reviewer-grade", action },
      } as never);
  };
  for (const [i, id] of reviewers.entries()) {
    const actor = i === 0 ? reviewerActor : `reviewer-${id}`,
      u = structuredClone(users.get(ids.outsider)!);
    u.id = actor;
    u.lecturer!.id = id;
    users.set(actor, u);
    permit(actor, ["read", "save", "finalize", "download"]);
  }
  permit(ids.faculty, ["read"]);
  rw.policy.reviewersPerStudent = reviewers.length;
  if (allowCommittee) rw.policy.committeeMembership = "ALLOW";
  await rw.assign(reviewers);
  await rw.finalize();
  const policy: ReviewerGradePolicy = {
    version: "UNIT_MEMORY_FIXTURE_UC22",
    status: "APPROVED",
    approvedBy: ids.faculty,
    approvedAt: "2020-01-01T00:00:00Z",
    reference: "UNIT_MEMORY_FIXTURE; not approved by faculty",
    phaseCode: "FINAL",
    scoreStep: "0.5",
    draftAllowed: true,
    requiredFeedback: ["comment"],
    sourceChange: "BLOCK",
    afterFinalize: "IMMUTABLE",
    studentRelease: "WITHHELD",
    schedule: { required: false, requirePublished: false, window: null },
    rubric: null,
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
      newValue: unknown;
      oldValue: unknown;
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
    ...sc.session,
    rgReady: async () => control.schema,
    rgPolicy: async () => ({
      value: control.approved ? JSON.stringify(policy) : "{}",
    }),
    rgAssignments: async (term?: string, reviewer?: string) =>
      rw.state.rows.filter(
        (r) =>
          (!term || r.termId === term) &&
          (!reviewer || r.reviewerId === reviewer),
      ),
    rgScore: async (p: string, r: string) => {
      const v = state.scores.find(
        (s) => s.proposalId === p && s.scorerId === r && s.role === "REVIEWER",
      );
      return v ? materialize(v) : null;
    },
    rgRubric: async () =>
      control.rubricMismatch
        ? []
        : (policy.rubric?.criteria ?? []).map((c) => ({
            ...c,
            termId: ids.term,
            maxScore: new Prisma.Decimal(c.maxScore),
            weight: new Prisma.Decimal(c.weight),
          })),
    rgEvents: async (id: string) =>
      state.events.filter((e) => e.resourceId === id),
    rgEvent: async (
      actor: string,
      id: string,
      action: string,
      oldValue: unknown,
      newValue: unknown,
    ) => {
      if (control.auditFailure) throw Error("TEST_ONLY audit failure");
      state.events.unshift({
        id: randomUUID(),
        resourceId: id,
        userId: actor,
        createdAt: new Date(),
        action,
        oldValue: JSON.parse(JSON.stringify(oldValue)),
        newValue: JSON.parse(JSON.stringify(newValue)),
      });
    },
    rgSave: async (
      p: string,
      r: string,
      expected: number,
      data: Stored,
      details: Record<string, string>,
    ) => {
      const old = state.scores.find(
        (s) => s.proposalId === p && s.scorerId === r && s.role === "REVIEWER",
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
      if (control.rememberFailure) throw Error("TEST_ONLY remember failure");
      state.replays.set([a, r, k].join("|"), {
        payloadHash,
        result: structuredClone(result),
      });
    },
  } as unknown as ReviewerGradeSession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: ReviewerGradeSession) => Promise<T>) => fn(s),
    write: <T>(fn: (s: ReviewerGradeSession) => Promise<T>) => {
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
  } as ReviewerGradeRepository;
  const review = new ProposalReviewValidator(),
    service = new ReviewerGradeService(
      repo,
      rw.service,
      sc.service,
      review,
      new GuidanceValidator(review),
      new ReviewerGradeValidator(),
      {
        readPrivateGuidance: async (key: string) => {
          if (control.storageFailure) throw Error("TEST_ONLY unavailable");
          return control.corrupt ? Buffer.from("corrupt") : f.bytes.get(key)!;
        },
      } as unknown as FileStorageService,
      {
        get: () => (control.writes ? "true" : "false"),
      } as unknown as ConfigService,
    );
  const detail = (actor = reviewerActor, reviewer?: string) =>
    service.detail(actor, memberId, ids.term, reviewer);
  const body = async (actor = reviewerActor): Promise<ReviewerGradeCommand> => {
    const v = await detail(actor);
    return {
      termId: ids.term,
      expectedRevision: v.revision,
      assignmentId: v.assignment!.assignmentId,
      assignmentRevision: v.assignment!.revision,
      assignmentEvidenceHash: v.assignment!.evidenceHash,
      reportVersionId: v.report!.id,
      reportChecksum: v.report!.checksum,
      policyHash: v.policyHash,
      rubricHash: v.rubricHash,
      scheduleHash: v.schedule?.hash ?? null,
      totalScore: "8",
      criterionScores: {},
      comment: "TEST_ONLY feedback",
      strengths: "",
      weaknesses: "",
      questions: "",
    };
  };
  const command = async (
    action: "save" | "finalize" = "save",
    actor = reviewerActor,
  ) =>
    service.command(actor, memberId, await body(actor), randomUUID(), action);
  return {
    sc,
    rw,
    f,
    users,
    policy,
    control,
    session: s,
    repo,
    service,
    detail,
    body,
    command,
    permit,
    get state() {
      return state;
    },
  };
}
