// Full upstream synthetic workflow. No PrismaClient, secrets or shared database.
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import type {
  ScheduleCommand,
  SchedulePolicy,
  ScheduleSave,
} from "@doan/shared";
import { createReviewerFixture } from "./reviewer.fixture";
import { ids } from "./final-defense.fixture";
import { memberId } from "./eligibility.fixture";
import {
  ScheduleRecord,
  ScheduleRepository,
  ScheduleSession,
} from "../src/defense/scheduling/schedule.repository";
import { ScheduleService } from "../src/defense/scheduling/schedule.service";
import { ScheduleValidator } from "../src/defense/scheduling/schedule.validator";
import { CommitteeValidator } from "../src/defense/committees/committee.validator";
import { ProposalReviewValidator } from "../src/topic/proposal-reviews/proposal-review.validator";
import { GuidanceValidator } from "../src/guidance/tasks/guidance.validator";
import { groupError } from "../src/topic/review-groups/review-group.errors";
export async function createScheduleFixture(committeeCount = 3) {
  const rw = await createReviewerFixture(committeeCount);
  const users = rw.cc.eligibility.f.users;
  for (const [actor, actions] of [
    [ids.faculty, ["read", "create", "update", "finalize", "publish"]],
    [ids.student, ["read"]],
    [ids.lecturer, ["read"]],
  ] as const)
    for (const action of actions)
      users.get(actor)!.userRoles[0].role.rolePermissions.push({
        permission: { resource: "defense-schedule", action },
      } as never);
  const policy: SchedulePolicy = {
    version: "TEST_ONLY_UC21",
    status: "APPROVED",
    approvedBy: ids.faculty,
    approvedAt: "2020-01-01T00:00:00Z",
    reference: "TEST_ONLY, not faculty approval",
    phaseCode: "FINAL",
    timezone: "Asia/Ho_Chi_Minh",
    allowedDates: ["2030-11-07"],
    periods: {
      MORNING: { start: "08:00", end: "11:30", breaks: [] },
      AFTERNOON: { start: "13:30", end: "17:00", breaks: [] },
    },
    durationMin: 30,
    bufferMin: 0,
    sessionBufferMin: 0,
    startStepMin: 30,
    maxStudentsPerSession: 4,
    minRoomCapacity: 5,
    roomAccess: [
      { roomId: "r1", departmentIds: ["department"] },
      { roomId: "r2", departmentIds: ["department"] },
    ],
    reviewerAttendance: "NOT_REQUIRED",
    nameRule: "LAST_TOKEN_MIDDLE_THEN_FAMILY",
    compoundFamilyNames: ["Tôn Nữ", "Âu Dương"],
    manualOrderAllowed: false,
    studentVisibility: true,
    lecturerVisibility: true,
    advisorCanView: true,
    publishNotBefore: "2020-01-01T00:00:00Z",
    crossTermConflicts: "ALL_TERMS",
    legacyRule: "BLOCK_SHARED_RESOURCES_UNTIL_RECONCILED",
  };
  const rooms = [
    {
      id: "r1",
      code: "R1",
      name: "Phòng A",
      capacity: 30,
      location: null,
      createdAt: new Date("2020-01-01"),
    },
    {
      id: "r2",
      code: "R2",
      name: "Phòng B",
      capacity: 30,
      location: null,
      createdAt: new Date("2020-01-01"),
    },
  ];
  const control = {
    schema: true,
    approved: true,
    writes: true,
    auditFailure: false,
    rememberFailure: false,
  };
  type Event = {
    id: string;
    userId: string;
    resourceId: string;
    action: string;
    createdAt: Date;
    newValue: unknown;
  };
  let state = {
    rows: [] as ScheduleRecord[],
    events: [] as Event[],
    replays: new Map<string, { payloadHash: string; result: unknown }>(),
  };
  const materialize = () =>
    state.rows
      .map((r) => ({
        ...r,
        room: rooms.find((a) => a.id === r.roomId) ?? r.room,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  const s = {
    ...rw.session,
    windowTerm: async (termId: string) => {
      const t = await rw.session.windowTerm(termId);
      return t
        ? {
            ...t,
            startDate: new Date("2020-01-01"),
            endDate: new Date("2099-01-01"),
            phases: [
              ...t.phases,
              {
                id: "defense",
                termId: ids.term,
                code: "DEFENSE",
                startDate: new Date("2030-11-01"),
                endDate: new Date("2030-12-01"),
                isLocked: false,
              },
            ],
          }
        : null;
    },
    scReady: async () => control.schema,
    scLegacyReady: async () => true,
    scPolicy: async () => ({
      value: control.approved ? JSON.stringify(policy) : "{}",
    }),
    scRooms: async () => rooms,
    scRecords: async () => materialize(),
    scLegacy: async () => materialize(),
    scStudentIdentities: async () => [
      {
        id: memberId,
        termId: ids.term,
        studentId: "student-profile",
        student: {
          fullName: "Nguyễn Văn An",
          studentCode: "SV01",
          isActive: true,
        },
      },
    ],
    scProposalOwners: async () => [
      { id: ids.proposal, studentId: "student-profile" },
    ],
    scLock: async () => {},
    scSave: async (
      id: string,
      expected: number,
      oldState: string,
      data: ScheduleRecord,
    ) => {
      const old = state.rows.find((r) => r.id === id);
      if (expected === 0) {
        if (old) groupError(409, "REVISION_CONFLICT", "Synthetic duplicate");
        state.rows.push({
          ...data,
          id,
          createdAt: new Date(),
          committeeStudents: [],
          committee: {
            id: data.committeeId,
            termId: ids.term,
            name: "H1",
            members: rw.cc.state.rows
              .get(data.committeeId)!
              .members.map((m) => ({ lecturerId: m.lecturerId })),
          },
          room: rooms.find((r) => r.id === data.roomId)!,
        });
      } else {
        if (!old || old.revision !== expected || old.state !== oldState)
          groupError(409, "REVISION_CONFLICT", "Synthetic schedule CAS");
        Object.assign(old, data, { revision: expected + 1 });
      }
    },
    scEvents: async (id: string) =>
      state.events.filter((e) => e.resourceId === id),
    scEvent: async (
      actor: string,
      id: string,
      action: string,
      _old: unknown,
      newValue: unknown,
    ) => {
      if (control.auditFailure) throw Error("Synthetic schedule audit failure");
      state.events.unshift({
        id: randomUUID(),
        userId: actor,
        resourceId: id,
        action,
        newValue: structuredClone(newValue),
        createdAt: new Date(),
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
        throw Error("Synthetic schedule remember failure");
      state.replays.set([actor, route, key].join("|"), {
        payloadHash,
        result: structuredClone(result),
      });
    },
  } as unknown as ScheduleSession;
  let queue = Promise.resolve();
  const repo = {
    read: <T>(fn: (s: ScheduleSession) => Promise<T>) => fn(s),
    write: <T>(fn: (s: ScheduleSession) => Promise<T>) => {
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
  } as ScheduleRepository;
  const review = new ProposalReviewValidator(),
    service = new ScheduleService(
      repo,
      rw.cc.service,
      rw.service,
      review,
      new GuidanceValidator(review),
      new ScheduleValidator(),
      new CommitteeValidator(),
      {
        get: () => (control.writes ? "true" : "false"),
      } as unknown as ConfigService,
    );
  const workspace = () => service.workspace(ids.faculty, ids.term);
  const saveBody = async (id?: string): Promise<ScheduleSave> => {
    const w = await workspace(),
      c = w.sources[0],
      r = w.schedules.find((r) => r.id === id);
    return {
      termId: ids.term,
      rosterHash: w.rosterHash,
      expectedRevision: r?.revision ?? 0,
      reason: "TEST_ONLY schedule",
      committeeId: c.committeeId,
      committeeRevision: c.committeeRevision,
      committeeEvidenceHash: c.committeeEvidenceHash,
      sourceHash: c.sourceHash,
      roomId: "r1",
      date: policy.allowedDates[0],
      period: "MORNING",
      startTime: policy.periods.MORNING.start,
      termStudentIds: [memberId],
    };
  };
  const save = async (id?: string) =>
    service.save(
      ids.faculty,
      id ?? null,
      await saveBody(id),
      randomUUID(),
    ) as Promise<{ sessions: { id: string; revision: number }[] }>;
  const command = async (id: string): Promise<ScheduleCommand> => {
    const w = await workspace(),
      r = w.schedules.find((c) => c.id === id)!;
    return {
      termId: ids.term,
      rosterHash: w.rosterHash,
      reason: "TEST_ONLY transition",
      members: [
        { id, expectedRevision: r.revision, evidenceHash: r.evidenceHash },
      ],
    };
  };
  const transition = async (
    id: string,
    action: "finalize" | "publish" | "cancel",
  ) => service.transition(ids.faculty, await command(id), randomUUID(), action);
  return {
    rw,
    service,
    session: s,
    repo,
    rooms,
    policy,
    control,
    workspace,
    saveBody,
    save,
    command,
    transition,
    get state() {
      return state;
    },
  };
}
