// UC17 -> UC18 -> UC19 synthetic integration. No PrismaClient/env/production I/O.
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import type { DefenseCommitteeAssignment } from "@prisma/client";
import type {
  CommitteeMemberInput,
  CommitteePolicy,
  CommitteeSave,
} from "@doan/shared";
import { createEligibilityFixture, memberId } from "./eligibility.fixture";
import { ids } from "./final-defense.fixture";
import {
  CommitteeRecord,
  CommitteeRepository,
  CommitteeSession,
} from "../src/defense/committees/committee.repository";
import { CommitteeWorkflowService } from "../src/defense/committees/committee-workflow.service";
import { CommitteeValidator } from "../src/defense/committees/committee.validator";
import { ProposalReviewValidator } from "../src/topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";
import { groupError } from "../src/topic/review-groups/review-group.errors";

export async function createCommitteeFixture() {
  const eligibility = await createEligibilityFixture();
  await eligibility.review();
  await eligibility.decide();
  await eligibility.finalize();
  const user = eligibility.f.users.get(ids.faculty)!;
  for (const action of ["read", "create", "update", "assign", "finalize"])
    user.userRoles[0].role.rolePermissions.push({
      permission: { resource: "defense-committee", action },
    } as (typeof user.userRoles)[0]["role"]["rolePermissions"][number]);
  const policy: CommitteePolicy = {
    version: "synthetic-only-uc19",
    status: "APPROVED",
    approvedBy: ids.faculty,
    approvedAt: "2020-01-01T00:00:00Z",
    reference: "Synthetic policy, not faculty approval",
    phaseCode: "FINAL",
    chairCount: 1,
    secretaryCount: 1,
    distinctOfficers: true,
    allowEmptyFinalization: true,
    memberScope: "TERM_ROSTER",
    studentScope: "SAME_DEPARTMENT",
    allowedTitleIds: null,
    maxCommitteesPerLecturer: null,
    maxStudentsPerCommittee: null,
    maxStudentsPerLecturer: null,
  };
  const lecturers = [
    "l1",
    "l2",
    "l3",
    "l4",
    "l5",
    "l6",
    "official-advisor",
  ].map((id) => ({
    id,
    lecturerCode: id.toUpperCase(),
    fullName: `Synthetic ${id}`,
    departmentId: "department",
    titleId: null as string | null,
    isActive: true,
    user: { status: "ACTIVE", userRoles: [{ role: { name: "LECTURER" } }] },
    termLecturers: [{ termId: ids.term }],
  }));
  type Event = {
    id: string;
    resourceId: string;
    action: string;
    userId: string;
    createdAt: Date;
    newValue: unknown;
  };
  let state = {
    rows: new Map<string, CommitteeRecord>(),
    assignments: new Map<string, DefenseCommitteeAssignment>(),
    events: [] as Event[],
    replay: new Map<string, { payloadHash: string; result: unknown }>(),
  };
  const control = {
    schema: true,
    approved: true,
    writes: true,
    auditFailure: false,
    rememberFailure: false,
    legacyClaims: [] as {
      proposalId: string;
      session: { committeeId: string };
    }[],
  };
  const materialize = () =>
    [...state.rows.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => ({
        ...r,
        members: r.members.map((m) => ({
          ...m,
          lecturer: lecturers.find((l) => l.id === m.lecturerId)!,
        })) as CommitteeRecord["members"],
        studentAssignments: [...state.assignments.values()]
          .filter((a) => a.committeeId === r.id)
          .sort((a, b) => a.termStudentId.localeCompare(b.termStudentId)),
      }));
  const s = {
    ...eligibility.session,
    ccReady: async () => control.schema,
    ccLegacyReady: async () => true,
    ccClaimsReady: async () => true,
    ccClaims: async () => control.legacyClaims,
    ccPolicy: async () => ({
      value: control.approved ? JSON.stringify(policy) : "{}",
    }),
    ccList: async () => materialize(),
    ccLegacy: async () => [],
    ccLecturers: async () => lecturers,
    departments: async () => [
      { id: "department", name: "Synthetic department" },
    ],
    ccLock: async () => {},
    ccCandidateMembers: async () => [{ id: memberId }],
    ccEvidence: async (
      _actor: string,
      _term: string,
      _member: string,
      work: () => Promise<unknown>,
    ) => work(),
    ccCreate: async (data: object) => {
      const row = {
        createdAt: new Date(),
        finalizedAt: null,
        finalizedBy: null,
        members: [],
        studentAssignments: [],
        ...data,
      } as unknown as CommitteeRecord;
      state.rows.set(row.id, row);
      return row;
    },
    ccMembers: async (id: string, members: CommitteeMemberInput[]) => {
      state.rows.get(id)!.members = members.map((m) => ({
        ...m,
        committeeId: id,
      })) as CommitteeRecord["members"];
    },
    ccAdvance: async (id: string, expected: number, data: object) => {
      const r = state.rows.get(id);
      if (!r || r.revision !== expected || r.state !== "DRAFT")
        groupError(409, "REVISION_CONFLICT", "Synthetic CAS conflict");
      Object.assign(r!, data, { revision: expected + 1 });
    },
    ccAssign: async (
      termStudentId: string,
      expected: number,
      data: DefenseCommitteeAssignment,
    ) => {
      const old = state.assignments.get(termStudentId);
      if ((old?.revision ?? 0) !== expected)
        groupError(409, "REVISION_CONFLICT", "Synthetic assignment conflict");
      state.assignments.set(termStudentId, {
        ...(old ?? { id: randomUUID() }),
        ...data,
        revision: expected + 1,
      });
    },
    ccEvents: async (id: string) =>
      state.events.filter((e) => e.resourceId === id),
    ccEvent: async (
      actor: string,
      id: string,
      action: string,
      _old: unknown,
      newValue: unknown,
    ) => {
      if (control.auditFailure) throw Error("Synthetic audit failure");
      state.events.push({
        id: randomUUID(),
        resourceId: id,
        action,
        userId: actor,
        createdAt: new Date(),
        newValue: structuredClone(newValue),
      });
    },
    replay: async (actor: string, route: string, key: string) =>
      state.replay.get([actor, route, key].join("|")) ?? null,
    remember: async (
      actor: string,
      route: string,
      key: string,
      payloadHash: string,
      result: unknown,
    ) => {
      if (control.rememberFailure) throw Error("Synthetic idempotency failure");
      state.replay.set([actor, route, key].join("|"), {
        payloadHash,
        result: structuredClone(result),
      });
    },
  } as unknown as CommitteeSession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: CommitteeSession) => Promise<T>) => fn(s),
    write: <T>(fn: (s: CommitteeSession) => Promise<T>) => {
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
  } as CommitteeRepository;
  const review = new ProposalReviewValidator();
  const service = new CommitteeWorkflowService(
    repo,
    eligibility.service,
    review,
    new GuidanceValidator(review),
    new CommitteeValidator(),
    {
      get: () => (control.writes ? "true" : "false"),
    } as unknown as ConfigService,
  );
  const workspace = () => service.workspace(ids.faculty, ids.term);
  const createBody = async (
    code = "H1",
    count = 3,
  ): Promise<CommitteeSave> => ({
    termId: ids.term,
    expectedRevision: 0,
    rosterHash: (await workspace()).rosterHash,
    reason: "Synthetic create",
    code,
    name: `Synthetic ${code}`,
    departmentId: "department",
    members: lecturers.slice(0, count).map((l, i) => ({
      lecturerId: l.id,
      role: i === 0 ? "CHAIR" : i === 1 ? "SECRETARY" : "MEMBER",
    })),
  });
  const create = async (code = "H1", count = 3) => {
    const result = (await service.save(
      ids.faculty,
      null,
      await createBody(code, count),
      `create-${code}`,
    )) as { id: string; revision: number };
    return result.id;
  };
  const assignBody = async (target: string) => {
    const w = await workspace(),
      c = w.candidates.find((c) => c.termStudentId === memberId)!;
    const touched = [
      ...new Set([
        target,
        ...(c.currentCommitteeId ? [c.currentCommitteeId] : []),
      ]),
    ];
    return {
      termId: ids.term,
      rosterHash: w.rosterHash,
      reason: "Synthetic allocation",
      committees: touched.map((id) => ({
        committeeId: id,
        expectedRevision: w.committees.find((r) => r.id === id)!.revision,
      })),
      placements: [
        {
          termStudentId: c.termStudentId,
          committeeId: target,
          expectedAssignmentRevision: c.assignmentRevision,
          eligibilityRevision: c.eligibility?.revision ?? 1,
          evidenceHash: c.eligibility?.evidenceHash ?? "0".repeat(64),
          advisorHash: c.advisorHash,
        },
      ],
    };
  };
  const assign = async (id: string, key = `assign-${randomUUID()}`) =>
    service.assign(ids.faculty, await assignBody(id), key);
  const finalizeBody = async (id: string) => {
    const w = await workspace();
    return {
      termId: ids.term,
      expectedRevision: w.committees.find((c) => c.id === id)!.revision,
      rosterHash: w.rosterHash,
      reason: "Synthetic finalize",
    };
  };
  const finalize = async (id: string, key = `finalize-${id}`) =>
    service.finalize(ids.faculty, id, await finalizeBody(id), key);
  return {
    service,
    session: s,
    repo,
    eligibility,
    control,
    policy,
    lecturers,
    workspace,
    create,
    createBody,
    assign,
    assignBody,
    finalize,
    finalizeBody,
    get state() {
      return state;
    },
  };
}
