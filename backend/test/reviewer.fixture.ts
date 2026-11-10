// Synthetic producer chain UC17 -> UC18 -> UC19 -> UC20; never opens PrismaClient.
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import type {
  ReviewerAssign,
  ReviewerFinalize,
  ReviewerPolicy,
} from "@doan/shared";
import { createCommitteeFixture } from "./committee.fixture";
import { ids } from "./final-defense.fixture";
import { memberId } from "./eligibility.fixture";
import {
  ReviewerRepository,
  ReviewerRow,
  ReviewerSession,
} from "../src/defense/reviewers/reviewer.repository";
import { ReviewerService } from "../src/defense/reviewers/reviewer.service";
import { ReviewerValidator } from "../src/defense/reviewers/reviewer.validator";
import { CommitteeValidator } from "../src/defense/committees/committee.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../src/topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";
import { groupError } from "../src/topic/review-groups/review-group.errors";
export async function createReviewerFixture(committeeCount = 3) {
  const cc = await createCommitteeFixture(),
    committeeId = await cc.create("H1", committeeCount);
  await cc.assign(committeeId);
  await cc.finalize(committeeId);
  for (const action of ["read", "assign", "update", "finalize"])
    cc.eligibility.f.users
      .get(ids.faculty)!
      .userRoles[0].role.rolePermissions.push({
        permission: { resource: "defense-reviewer", action },
      } as never);
  const policy: ReviewerPolicy = {
    version: "synthetic-only-uc20",
    status: "APPROVED",
    approvedBy: ids.faculty,
    approvedAt: "2020-01-01T00:00:00Z",
    reference: "Synthetic, not faculty approval",
    phaseCode: "FINAL",
    reviewersPerStudent: 1,
    maxReviewsPerLecturer: null,
    maxTotalStudentDuties: null,
    totalLoadRule: "ADVISOR_PLUS_COMMITTEE_PLUS_REVIEW",
    departmentRule: "SAME_DEPARTMENT",
    allowedTitleIds: null,
    expertiseRule: "NONE",
    committeeMembership: "FORBID",
    formerAdvisorRule: "PENDING_APPROVAL",
  };
  const control = {
    schema: true,
    approved: true,
    writes: true,
    auditFailure: false,
    rememberFailure: false,
    loadValid: true,
    history: {
      valid: true,
      advisorIds: ["official-advisor"],
      hash: reviewHash("synthetic-history"),
      areaId: "area",
    },
  };
  type Event = {
    id: string;
    resourceId: string;
    userId: string;
    createdAt: Date;
    action: string;
    newValue: unknown;
  };
  let state = {
    rows: [] as ReviewerRow[],
    events: [] as Event[],
    replays: new Map<string, { payloadHash: string; result: unknown }>(),
  };
  const s = {
    ...cc.session,
    rwReady: async () => control.schema,
    rwLegacyReady: async () => true,
    rwPolicy: async () => ({
      value: control.approved ? JSON.stringify(policy) : "{}",
    }),
    rwRows: async () =>
      [...state.rows].sort(
        (a, b) =>
          a.proposalId.localeCompare(b.proposalId) ||
          a.reviewerId.localeCompare(b.reviewerId),
      ),
    rwLegacy: async () =>
      state.rows.map(({ id, proposalId, reviewerId, assignedAt }) => ({
        id,
        proposalId,
        reviewerId,
        assignedAt,
      })),
    rwLecturerAreas: async () =>
      cc.lecturers.map((l) => ({ lecturerId: l.id, researchAreaId: "area" })),
    rwAdvisorHistory: async () => control.history,
    rwAdvisorLoads: async () => ({
      valid: control.loadValid,
      counts: { "official-advisor": 1 },
    }),
    rwLock: async () => {},
    rwSave: async (
      proposalId: string,
      expected: number,
      reviewerIds: string[],
      data: ReviewerRow,
    ) => {
      const rows = state.rows.filter((r) => r.proposalId === proposalId);
      if (
        rows.some(
          (r) =>
            r.revision !== expected || r.state !== "DRAFT" || r.finalizedAt,
        ) ||
        (!rows.length && expected !== 0)
      )
        groupError(409, "REVISION_CONFLICT", "Synthetic reviewer CAS");
      for (const r of rows)
        Object.assign(r, {
          ...data,
          id: r.id,
          createdBy: r.createdBy,
          reviewerId: r.reviewerId,
          selected: reviewerIds.includes(r.reviewerId),
          revision: expected + 1,
        });
      for (const reviewerId of reviewerIds)
        if (!rows.some((r) => r.reviewerId === reviewerId))
          state.rows.push({
            ...data,
            id: randomUUID(),
            reviewerId,
            revision: expected + 1,
            selected: true,
          });
    },
    rwEvents: async (member: string) =>
      state.events.filter((e) => e.resourceId === member),
    rwEvent: async (
      actor: string,
      member: string,
      action: string,
      _old: unknown,
      newValue: unknown,
    ) => {
      if (control.auditFailure) throw Error("Synthetic UC20 audit failure");
      state.events.unshift({
        id: randomUUID(),
        resourceId: member,
        userId: actor,
        action,
        createdAt: new Date(),
        newValue: structuredClone(newValue),
      });
    },
    replay: async (actor: string, route: string, key: string) =>
      state.replays.get([actor, route, key].join("|")) ?? null,
    remember: async (
      actor: string,
      route: string,
      key: string,
      payloadHash: string,
      result: unknown,
    ) => {
      if (control.rememberFailure)
        throw Error("Synthetic UC20 idempotency failure");
      state.replays.set([actor, route, key].join("|"), {
        payloadHash,
        result: structuredClone(result),
      });
    },
  } as unknown as ReviewerSession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: ReviewerSession) => Promise<T>) => fn(s),
    write: <T>(fn: (s: ReviewerSession) => Promise<T>) => {
      const result = queue.then(async () => {
        const before = structuredClone(state);
        try {
          return await fn(s);
        } catch (e) {
          state = before;
          throw e;
        }
      });
      queue = result.then(
        () => {},
        () => {},
      );
      return result;
    },
  } as ReviewerRepository;
  const review = new ProposalReviewValidator(),
    service = new ReviewerService(
      repo,
      cc.service,
      review,
      new GuidanceValidator(review),
      new ReviewerValidator(),
      new CommitteeValidator(),
      {
        get: () => (control.writes ? "true" : "false"),
      } as unknown as ConfigService,
    );
  const workspace = () => service.workspace(ids.faculty, ids.term);
  const assignBody = async (reviewerIds = ["l4"]): Promise<ReviewerAssign> => {
    const w = await workspace(),
      c = w.students.find((c) => c.id === memberId)!;
    return {
      termId: ids.term,
      rosterHash: w.rosterHash,
      reason: "Synthetic reviewer allocation",
      placements: [{ ...c.binding!, reviewerIds }],
    };
  };
  const assign = (reviewerIds = ["l4"], key = randomUUID()) =>
    assignBody(reviewerIds).then((b) => service.assign(ids.faculty, b, key));
  const finalizeBody = async (): Promise<ReviewerFinalize> => {
    const w = await workspace();
    return {
      termId: ids.term,
      rosterHash: w.rosterHash,
      reason: "Synthetic reviewer finalization",
      members: [w.students.find((c) => c.id === memberId)!.binding!],
    };
  };
  const finalize = (key = randomUUID()) =>
    finalizeBody().then((b) => service.finalize(ids.faculty, b, key));
  return {
    cc,
    committeeId,
    policy,
    control,
    session: s,
    repo,
    service,
    workspace,
    assignBody,
    assign,
    finalizeBody,
    finalize,
    get state() {
      return state;
    },
  };
}
