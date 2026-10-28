import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { LoadedTerm } from "../../term/repository/term.repository";
import {
  operationWindow,
  TermWindowService,
} from "../../term/service/term-window.service";
import {
  AssignmentRepository,
  AssignmentRegistration,
  LoadedPlan,
  WorkflowTx,
} from "../repository/assignment.repository";
import { AssignmentPlanService } from "./assignment-plan.service";

const now = new Date("2026-10-26T07:00:00Z");

function setup() {
  const term = {
    id: "term",
    status: "CLOSED_REGISTRATION",
    isLocked: false,
    startDate: new Date("2026-10-01Z"),
    endDate: new Date("2026-12-01Z"),
    trainingSystemId: "system",
    parameters: [],
    phases: [
      {
        id: "phase",
        code: "ASSIGNMENT",
        isLocked: false,
        startDate: new Date(now.getTime() - 60000),
        endDate: new Date(now.getTime() + 60000),
      },
    ],
    termStudents: [
      {
        studentId: "student",
        student: { studentCode: "SV01", fullName: "Student" },
      },
      {
        studentId: "not-submitted",
        student: { studentCode: "SV02", fullName: "Not submitted" },
      },
    ],
    termLecturers: [
      {
        lecturerId: "advisor",
        quota: 5,
        lecturer: {
          id: "advisor",
          lecturerCode: "GV01",
          fullName: "Advisor",
          isActive: true,
          researchAreas: [{ researchAreaId: "area" }],
          user: { email: "advisor@example.test" },
        },
      },
    ],
  } as unknown as LoadedTerm;
  const registrations = [
    {
      id: "registration",
      termId: "term",
      studentId: "student",
      directionId: "area",
      status: "SUBMITTED",
      submittedAt: now,
      preferences: [{ lecturerId: "advisor", preferenceOrder: 1 }],
      direction: { isActive: true },
      student: {
        id: "student",
        userId: "student-user",
        studentCode: "SV01",
        fullName: "Student",
        className: "Class",
        gpa: 3.5,
        isActive: true,
        academicEligible: true,
        trainingSystemId: "system",
        trainingSystem: { name: "Program" },
        user: { email: "student@example.test", phone: "0912345678" },
      },
    },
  ] as unknown as AssignmentRegistration[];
  const plans: LoadedPlan[] = [];
  const tx = {} as WorkflowTx;
  const repo = {
    transaction: async <T>(
      operation: (transaction: WorkflowTx) => Promise<T>,
    ) => operation(tx),
    term: vi.fn(async () => term),
    registrations: vi.fn(async () => registrations),
    plans: vi.fn(async () => plans),
    savePlan: vi.fn(
      async (
        id: string | undefined,
        data: Prisma.AssignmentPlanUncheckedCreateInput,
      ) => {
        if (id) {
          Object.assign(plans[0], data);
          return plans[0];
        }
        const plan = {
          id: "plan",
          status: "DRAFT",
          advisorAssignments: [],
          ...data,
        } as unknown as LoadedPlan;
        plans.push(plan);
        return plan;
      },
    ),
    replaceAssignments: vi.fn(
      async (
        id: string,
        rows: {
          registrationId: string;
          advisorId: string;
          isManual: boolean;
          note: string;
        }[],
      ) => {
        plans.find((p) => p.id === id)!.advisorAssignments = rows.map(
          (row) => ({
            id: "assignment",
            ...row,
            registration: registrations.find(
              (r) => r.id === row.registrationId,
            ),
            advisor: term.termLecturers.find(
              (l) => l.lecturerId === row.advisorId,
            )!.lecturer,
          }),
        ) as unknown as LoadedPlan["advisorAssignments"];
      },
    ),
    audit: vi.fn(async () => {}),
  };
  const windows = {
    requireOpen: vi.fn(async () => {
      if (!operationWindow(term, "ASSIGNMENT").canWrite)
        throw new Error("Window closed");
    }),
  };
  const service = new AssignmentPlanService(
    repo as unknown as AssignmentRepository,
    windows as unknown as TermWindowService,
  );
  return { service, repo, term, plans, registrations };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe("scheduled assignment draft", () => {
  it("creates one draft with the existing algorithm and a system audit; never publishes", async () => {
    const { service, repo, plans } = setup();
    const result = await service.createAutomaticDraft("term");
    expect(result?.plan).toMatchObject({ status: "DRAFT", revision: 1 });
    expect(result?.assignments).toMatchObject([
      { studentId: "student", lecturerId: "advisor", published: false },
    ]);
    expect(result?.missingSubmissions.map((r) => r.studentId)).toEqual([
      "not-submitted",
    ]);
    expect(repo.audit).toHaveBeenCalledWith(
      null,
      "ASSIGNMENT_AUTO_DRAFT_SAVED",
      "plan",
      expect.objectContaining({ revision: 1 }),
      expect.anything(),
    );
    await service.createAutomaticDraft("term");
    expect(plans).toHaveLength(1);
    expect(repo.savePlan).toHaveBeenCalledOnce();
    expect(repo.audit).toHaveBeenCalledOnce();
  });

  it("opens at the exact configured start time", async () => {
    const { service, term } = setup();
    term.phases[0].startDate = now;
    expect((await service.createAutomaticDraft("term"))?.plan?.status).toBe(
      "DRAFT",
    );
  });

  it.each(["DRAFT", "PUBLISHED", "FINALIZED"] as const)(
    "leaves an existing %s plan untouched",
    async (status) => {
      const { service, plans, repo } = setup();
      plans.push({ id: "existing", status, revision: 8 } as LoadedPlan);
      expect(await service.createAutomaticDraft("term")).toBeNull();
      expect(repo.savePlan).not.toHaveBeenCalled();
      expect(repo.replaceAssignments).not.toHaveBeenCalled();
      expect(plans[0].revision).toBe(8);
    },
  );

  it.each([
    "registration-open",
    "term-locked",
    "phase-locked",
    "before-phase",
    "phase-expired",
    "before-term",
    "term-expired",
    "no-phase",
  ])("rechecks the %s condition inside the transaction", async (condition) => {
    const { service, term, repo } = setup();
    if (condition === "registration-open") term.status = "OPEN_REGISTRATION";
    if (condition === "term-locked") term.isLocked = true;
    if (condition === "phase-locked") term.phases[0].isLocked = true;
    if (condition === "before-phase")
      term.phases[0].startDate = new Date(now.getTime() + 1);
    if (condition === "phase-expired") term.phases[0].endDate = now;
    if (condition === "before-term")
      term.startDate = new Date(now.getTime() + 1);
    if (condition === "term-expired") term.endDate = now;
    if (condition === "no-phase") term.phases = [];
    expect(await service.createAutomaticDraft("term")).toBeNull();
    expect(repo.savePlan).not.toHaveBeenCalled();
  });

  it("records unassigned registrations without exceeding quota", async () => {
    const { service, term } = setup();
    term.termLecturers[0].quota = 0;
    const result = await service.createAutomaticDraft("term");
    expect(result?.plan?.status).toBe("DRAFT");
    expect(result?.assignments).toEqual([]);
    expect(result?.results[0].assignedLecturerId).toBeNull();
  });

  it("preserves a manual adjustment when the worker runs again", async () => {
    const { service, plans, repo } = setup();
    await service.createAutomaticDraft("term");
    await service.adjust(
      "term",
      {
        studentId: "student",
        lecturerId: "advisor",
        reason: "Faculty confirmed advisor",
        revision: 1,
      },
      "faculty",
    );
    await service.createAutomaticDraft("term");
    expect(plans[0].revision).toBe(2);
    expect(plans[0].advisorAssignments[0]).toMatchObject({
      isManual: true,
      note: "Thủ công: Faculty confirmed advisor",
    });
    expect(repo.savePlan).toHaveBeenCalledTimes(2);
  });

  it("keeps preview/hash confirmation and faculty auditing for explicit saves", async () => {
    const { service, repo } = setup();
    const options = {
      mode: "remaining" as const,
      confirmed: false,
      revision: 0,
    };
    await expect(service.save("term", options, "faculty")).rejects.toThrow();
    const preview = await service.preview("term", options);
    await service.save(
      "term",
      { ...options, inputHash: preview.inputHash },
      "faculty",
    );
    expect(repo.audit).toHaveBeenCalledWith(
      "faculty",
      "ASSIGNMENT_DRAFT_SAVED",
      "plan",
      expect.objectContaining({ revision: 1 }),
      expect.anything(),
    );
  });
});
