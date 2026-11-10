// TEST_ONLY. Actual UC17-23 services, isolated memory; no PrismaClient/env/network.
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import type { FinalResultPolicy } from "@doan/shared";
import { createCommitteeGradeFixture } from "./committee-grade.fixture";
import { ids } from "./final-defense.fixture";
import { memberId } from "./eligibility.fixture";
import { ProposalReviewValidator } from "../src/topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";
import { FinalDefenseValidator } from "../src/guidance/final-defense/final-defense.validator";
import { CommitteeGradeValidator } from "../src/defense/committee-grading/committee-grade.validator";
import { FileStorageService } from "../src/common/storage/file-storage.service";
import { AdvisorGradeReader } from "../src/defense/final-results/advisor-grade.reader";
import { FinalResultSources } from "../src/defense/final-results/final-result.sources";
import { FinalResultService } from "../src/defense/final-results/final-result.service";
import {
  FinalResultRepository,
  FinalResultSession,
  FinalResultRecord,
} from "../src/defense/final-results/final-result.repository";
import { groupError } from "../src/topic/review-groups/review-group.errors";
export async function createFinalResultFixture(
  committeeCount = 3,
  reviewers = ["l6"],
) {
  const cg = await createCommitteeGradeFixture(
      false,
      committeeCount,
      reviewers,
    ),
    f = cg.f,
    users = cg.users;
  cg.rg.policy.phaseCode = "DEFENSE";
  for (const [i, id] of reviewers.entries())
    await cg.rg.command(
      "finalize",
      i === 0 ? "test-reviewer-account" : `reviewer-${id}`,
    );
  const members = ["l1", "l2", "l3", "l4", "l5"].slice(0, committeeCount);
  for (const m of members) await cg.command("finalize", cg.actor(m));
  const permit = (actor: string, role: string, actions: string[]) => {
    const r = users.get(actor)!.userRoles.find((r) => r.role.name === role)!;
    for (const action of actions)
      r.role.rolePermissions.push({
        permission: { resource: "defense-result", action },
      } as never);
  };
  permit(ids.faculty, "FACULTY", [
    "read",
    "components-read",
    "history-read",
    "finalize",
    "publish",
  ]);
  for (const m of members)
    permit(cg.actor(m), "LECTURER", ["read", "components-read", "confirm"]);
  permit(ids.student, "STUDENT", ["read", "read-own", "final-read"]);
  const policy: FinalResultPolicy = {
    version: "TEST_ONLY_UC24",
    status: "APPROVED",
    approvedBy: ids.faculty,
    approvedAt: "2020-01-01T00:00:00Z",
    reference: "TEST_ONLY; not faculty approval",
    formula: "WEIGHTED_SUM",
    advisorSource: "UC17_OFFICIAL_SUMMARY",
    components: [
      { source: "ADVISOR_UC17", weight: "0.2" },
      { source: "REVIEWER", weight: "0.3" },
      { source: "COMMITTEE", weight: "0.5" },
    ],
    reviewerAggregate: {
      mode: "MEAN",
      rounding: { mode: "EXACT", decimalPlaces: 1 },
    },
    committeeAggregate: {
      mode: "MEAN",
      rounding: { mode: "EXACT", decimalPlaces: 1 },
    },
    finalRounding: { mode: "HALF_UP", decimalPlaces: 1 },
    finalStep: "0.1",
    storageDecimalPlaces: 1,
    passRule: null,
    classifications: [],
    confirmation: {
      scope: "STUDENT",
      rule: "ONE_PER_ROLE",
      roles: ["CHAIR", "SECRETARY"],
      distinctActors: true,
      reasonRequired: false,
    },
    separation: { finalizerNotConfirmer: true, publisherNotFinalizer: false },
    finalizeWindow: {
      phaseCode: "DEFENSE",
      notBefore: "2030-11-07T01:00:00Z",
      before: "2030-11-08T00:00:00Z",
    },
    publication: {
      phaseCode: "DEFENSE",
      notBefore: "2030-11-07T01:00:00Z",
      before: "2030-11-08T00:00:00Z",
      studentFinal: true,
      studentComponents: false,
    },
    sourceChange: "BLOCK",
    afterFinalize: "IMMUTABLE",
    sourceLock: "PRESERVE_PRODUCER_LOCKS",
  };
  const control = {
    ready: true,
    approved: true,
    writes: true,
    auditFailure: false,
    keyFailure: false,
  };
  type Stored = Omit<FinalResultRecord, "finalScore"> & {
    finalScore: string | null;
  };
  let state = {
    row: null as Stored | null,
    events: [] as {
      id: string;
      userId: string;
      action: string;
      createdAt: Date;
      newValue: unknown;
    }[],
    replay: new Map<string, { payloadHash: string; result: unknown }>(),
  };
  const materialize = () =>
    state.row
      ? ({
          ...state.row,
          finalScore:
            state.row.finalScore === null
              ? null
              : new Prisma.Decimal(state.row.finalScore),
        } as FinalResultRecord)
      : null;
  const s = {
    ...cg.session,
    // Delegate current state (not the underlying fixture's idempotency namespace).
    rgScore: cg.rg.session.rgScore.bind(cg.rg.session),
    rgEvents: cg.rg.session.rgEvents.bind(cg.rg.session),
    frReady: async () => control.ready,
    frPolicy: async () => ({
      value: control.approved ? JSON.stringify(policy) : null,
    }),
    frRow: async () => materialize(),
    frLegacy: async () => (state.row ? { id: state.row.id } : null),
    frEvents: async () => state.events,
    frLock: async () => {},
    frSave: async (_p: string, expected: number, data: Stored) => {
      if (
        (state.row?.revision ?? 0) !== expected ||
        state.row?.state === "PUBLISHED" ||
        (state.row?.state === "FINALIZED" && data.state !== "PUBLISHED")
      )
        groupError(409, "REVISION_CONFLICT", "TEST_ONLY CAS");
      state.row = {
        ...data,
        revision: expected + 1,
        advisorScore: null,
        reviewerScore: null,
        createdAt: state.row?.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
      return materialize()!;
    },
    frEvent: async (
      actor: string,
      _id: string,
      action: string,
      _old: unknown,
      value: unknown,
    ) => {
      if (control.auditFailure) throw Error("TEST_ONLY audit");
      state.events.push({
        id: randomUUID(),
        userId: actor,
        action,
        createdAt: new Date(),
        newValue: structuredClone(value),
      });
    },
    replay: async (a: string, r: string, k: string) =>
      state.replay.get([a, r, k].join("|")) ?? null,
    remember: async (
      a: string,
      r: string,
      k: string,
      payloadHash: string,
      result: unknown,
    ) => {
      if (control.keyFailure) throw Error("TEST_ONLY key");
      state.replay.set([a, r, k].join("|"), {
        payloadHash,
        result: structuredClone(result),
      });
    },
  } as unknown as FinalResultSession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: FinalResultSession) => Promise<T>) => fn(s),
    write: <T>(fn: (s: FinalResultSession) => Promise<T>) => {
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
  } as FinalResultRepository;
  const review = new ProposalReviewValidator(),
    roles = new GuidanceValidator(review),
    advisors = new AdvisorGradeReader(
      review,
      roles,
      new FinalDefenseValidator(),
      {
        readPrivateGuidance: async (key: string) => f.bytes.get(key)!,
      } as unknown as FileStorageService,
    ),
    sources = new FinalResultSources(
      cg.cc.service,
      cg.rw.service,
      cg.rg.service,
      cg.service,
      new CommitteeGradeValidator(),
      cg.sc.service,
      advisors,
    ),
    service = new FinalResultService(repo, sources, review, roles, {
      get: () => (control.writes ? "true" : "false"),
    } as unknown as ConfigService);
  const detail = (actor = ids.faculty) =>
    service.detail(actor, memberId, ids.term);
  const body = async (actor = ids.faculty) => {
    const v = await detail(actor);
    return {
      termId: ids.term,
      expectedRevision: v.revision,
      policyHash: v.policyHash,
      evidenceHash: v.evidenceHash,
    };
  };
  const command = async (
    action: "confirm" | "finalize" | "publish",
    actor = ids.faculty,
    key = randomUUID(),
  ) => service.command(actor, memberId, await body(actor), key, action);
  const confirm = async () => {
    await command("confirm", cg.actor("l1"));
    await command("confirm", cg.actor("l2"));
  };
  return {
    cg,
    f,
    users,
    permit,
    policy,
    control,
    session: s,
    repo,
    sources,
    advisors,
    service,
    detail,
    body,
    command,
    confirm,
    get state() {
      return state;
    },
  };
}
