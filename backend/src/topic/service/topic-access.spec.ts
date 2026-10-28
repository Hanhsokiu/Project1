import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { TopicService } from "./topic.service";
import type {
  AssignmentRepository,
  WorkflowTx,
} from "../../registration/repository/assignment.repository";
import { TopicRepository } from "../repository/topic.repository";
import type { TermWindowService } from "../../term/service/term-window.service";
import { ProposalReviewValidator } from "../proposal-reviews/proposal-review.validator";

function fixture() {
  const actor = {
    id: "actor",
    status: "ACTIVE",
    mustChangePassword: false,
    student: null as { id: string; isActive: boolean } | null,
    lecturer: { id: "advisor", isActive: true } as {
      id: string;
      isActive: boolean;
    } | null,
    userRoles: [
      {
        role: {
          name: "LECTURER",
          rolePermissions: ["read", "write"].map((action) => ({
            permission: { resource: "topic", action },
          })),
        },
      },
    ],
  };
  const row = {
    id: "proposal",
    termId: "term",
    studentId: "student",
    status: "DRAFT",
    pr2bProposalWorkflowProposalId: null as { id: string } | null,
    topic: {
      termId: "term",
      researchAreaId: "area",
      title: "A valid topic",
      advisorAgreed: true,
      studentAgreed: true,
    },
    dossier: null,
    versions: [
      {
        id: "version",
        version: 1,
        content: {},
        status: "DRAFT",
        createdAt: new Date(),
      },
    ],
  };
  const assignment = {
    id: "assignment",
    assignmentPlanId: "plan",
    advisorId: "advisor",
    advisor: {
      id: "advisor",
      isActive: true,
      fullName: "Advisor",
      user: {
        status: "ACTIVE",
        email: "a@example.invalid",
        phone: "0900000000",
      },
    },
    registration: {
      termId: "term",
      studentId: "student",
      directionId: "area",
      student: {
        fullName: "Student",
        studentCode: "SV1",
        className: "Class",
        cohort: "K1",
        trainingSystem: { name: "Regular" },
        user: { email: "s@example.invalid", phone: "0900000000" },
      },
    },
  };
  const plan = {
    id: "plan",
    termId: "term",
    status: "PUBLISHED",
    advisorAssignments: [assignment],
  };
  const db = {
    userAccount: { findUnique: vi.fn().mockResolvedValue(actor) },
    academicTermGrant: { findMany: vi.fn().mockResolvedValue([]) },
    termWorkflow: { findUnique: vi.fn().mockResolvedValue(null) },
    assignmentPlanWorkflow: {
      findUnique: vi.fn().mockResolvedValue({
        finalizedAt: new Date(0),
        finalizedByUserId: "faculty",
      }),
    },
    assignmentChange: { findFirst: vi.fn().mockResolvedValue(null) },
    termLecturer: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ termId: "term", lecturerId: "advisor" }),
    },
    researchAreaWorkflow: {
      findUnique: vi.fn().mockResolvedValue({ departmentId: "department" }),
    },
  };
  const tx = db as unknown as WorkflowTx;
  const contextReader = new TopicRepository();
  Object.assign(db.assignmentPlanWorkflow, {
    findMany: vi.fn(async () => [
      { planId: "plan", ...(await db.assignmentPlanWorkflow.findUnique()) },
    ]),
  });
  Object.assign(db.assignmentChange, {
    findMany: vi.fn(async () => {
      const change = await db.assignmentChange.findFirst();
      return change ? [change] : [];
    }),
  });
  Object.assign(db.termLecturer, {
    findMany: vi.fn(async () => [await db.termLecturer.findUnique()]),
  });
  Object.assign(db.researchAreaWorkflow, {
    findMany: vi.fn(async () => [
      {
        researchAreaId: "area",
        ...(await db.researchAreaWorkflow.findUnique()),
      },
    ]),
  });
  const repo = {
    assignmentReadContext:
      contextReader.assignmentReadContext.bind(contextReader),
    proposals: vi.fn().mockResolvedValue([row]),
    find: vi.fn().mockResolvedValue(row),
    save: vi.fn().mockResolvedValue(row),
    audit: vi.fn(),
  };
  const assignments = {
    transaction: async (fn: (tx: WorkflowTx) => Promise<unknown>) => fn(tx),
    plans: vi.fn().mockResolvedValue([plan]),
    term: vi.fn().mockResolvedValue({ name: "Term", code: "T1" }),
  };
  const windows = { requireOpen: vi.fn() };
  const service = new TopicService(
    assignments as unknown as AssignmentRepository,
    repo as unknown as TopicRepository,
    windows as unknown as TermWindowService,
    new ProposalReviewValidator(),
  );
  function manager(role = "FACULTY") {
    actor.lecturer = null;
    actor.userRoles[0].role.name = role;
  }
  function grant(
    termId = "term",
    allDepartments = true,
    departmentId = "department",
  ) {
    db.academicTermGrant.findMany.mockResolvedValue([
      {
        userId: "actor",
        termId,
        allDepartments,
        pr2bGrantDepartmentGrantId: [{ departmentId }],
      },
    ]);
  }
  function official() {
    row.pr2bProposalWorkflowProposalId = { id: "workflow" };
    plan.status = "FINALIZED";
    db.termWorkflow.findUnique.mockResolvedValue({
      termId: "term",
      officialAssignmentPlanId: "plan",
    });
  }
  return {
    actor,
    row,
    assignment,
    plan,
    db,
    repo,
    assignments,
    windows,
    service,
    manager,
    grant,
    official,
  };
}

describe("H01 legacy topic scope and official assignment", () => {
  it("keeps the published Step 3 preparation list before handover", async () => {
    const f = fixture();
    expect(await f.service.list("term", "actor")).toMatchObject([
      { lecturerId: "advisor", workflowReady: false },
    ]);
  });
  it("preserves the student's own read scope before and after handover", async () => {
    const f = fixture();
    f.actor.lecturer = null;
    f.actor.student = { id: "student", isActive: true };
    f.actor.userRoles[0].role.name = "STUDENT";
    expect(await f.service.list("term", "actor")).toHaveLength(1);
    f.official();
    expect(await f.service.list("term", "actor")).toHaveLength(1);
    f.actor.student.id = "other-student";
    expect(await f.service.list("term", "actor")).toEqual([]);
  });
  it("keeps handed-over proposals read-only through the legacy writer", async () => {
    const f = fixture();
    f.official();
    await expect(
      f.service.save(
        "term",
        "student",
        "actor",
        {
          expectedVersion: 1,
          content: {
            title: "A valid topic",
            objectives: "objectives",
            scope: "scope",
            technology: "tools",
            expected: "results",
            plan: [],
          },
        },
        false,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.repo.save).not.toHaveBeenCalled();
  });
  it("keeps saving a Step 3 draft before FINALIZED", async () => {
    const f = fixture();
    await f.service.save(
      "term",
      "student",
      "actor",
      {
        expectedVersion: 1,
        content: {
          title: "A valid topic",
          objectives: "objectives",
          scope: "scope",
          technology: "tools",
          expected: "results",
          plan: [],
        },
      },
      false,
    );
    expect(f.repo.save).toHaveBeenCalledOnce();
    expect(f.windows.requireOpen).toHaveBeenCalled();
  });
  it.each(["FACULTY", "ADMIN"])(
    "does not grant %s term-wide access without a grant",
    async (role) => {
      const f = fixture();
      f.manager(role);
      await expect(f.service.list("term", "actor")).rejects.toMatchObject({
        status: 403,
      });
      expect(f.repo.proposals).not.toHaveBeenCalled();
    },
  );
  it("denies a grant from another term", async () => {
    const f = fixture();
    f.manager();
    f.grant("other-term");
    await expect(f.service.list("term", "actor")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("filters manager reads by the configured topic department", async () => {
    const f = fixture();
    f.manager();
    f.grant("term", false, "other-department");
    expect(await f.service.list("term", "actor")).toEqual([]);
    f.grant("term", false);
    expect(await f.service.list("term", "actor")).toHaveLength(1);
  });
  it("denies PDF/version access outside the department grant", async () => {
    const f = fixture();
    f.manager();
    f.grant("term", false, "other-department");
    await expect(
      f.service.version("proposal", 1, "actor"),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.repo.audit).not.toHaveBeenCalled();
  });
  it("allows a matching whole-term grant without a role bypass", async () => {
    const f = fixture();
    f.manager();
    f.grant();
    expect(await f.service.list("term", "actor")).toHaveLength(1);
  });
  it("uses only the official FINALIZED pointer after handover", async () => {
    const f = fixture();
    f.official();
    f.assignments.plans.mockResolvedValue([
      {
        ...f.plan,
        id: "new-published",
        status: "PUBLISHED",
        advisorAssignments: [{ ...f.assignment, advisorId: "wrong" }],
      },
      f.plan,
    ]);
    expect(await f.service.list("term", "actor")).toMatchObject([
      { lecturerId: "advisor" },
    ]);
  });
  it("never falls back to PUBLISHED after handover", async () => {
    const f = fixture();
    f.official();
    f.plan.status = "PUBLISHED";
    await expect(f.service.list("term", "actor")).rejects.toMatchObject({
      status: 409,
    });
  });
  it("fails closed when the official pointer belongs to another plan", async () => {
    const f = fixture();
    f.official();
    f.db.termWorkflow.findUnique.mockResolvedValue({
      termId: "term",
      officialAssignmentPlanId: "other-plan",
    });
    await expect(f.service.list("term", "actor")).rejects.toMatchObject({
      status: 409,
    });
  });
  it("revokes the old advisor and allows the current advisor after AssignmentChange", async () => {
    const f = fixture();
    f.official();
    f.assignment.advisorId = "new-advisor";
    f.assignment.advisor.id = "new-advisor";
    f.db.termLecturer.findUnique.mockResolvedValue({
      termId: "term",
      lecturerId: "new-advisor",
    });
    f.db.assignmentChange.findFirst.mockResolvedValue({
      assignmentId: "assignment",
      assignmentRevision: 1,
      newAdvisorId: "new-advisor",
      effectiveAt: new Date(0),
    });
    expect(await f.service.list("term", "actor")).toEqual([]);
    await expect(
      f.service.version("proposal", 1, "actor"),
    ).rejects.toMatchObject({ status: 403 });
    f.actor.lecturer!.id = "new-advisor";
    expect(await f.service.list("term", "actor")).toMatchObject([
      { lecturerId: "new-advisor" },
    ]);
  });
  it("rejects contradictory or future assignment changes", async () => {
    const f = fixture();
    f.official();
    for (const change of [
      { newAdvisorId: "other", effectiveAt: new Date(0) },
      { newAdvisorId: "advisor", effectiveAt: new Date("2999-01-01Z") },
    ]) {
      f.db.assignmentChange.findFirst.mockResolvedValue({
        assignmentId: "assignment",
        assignmentRevision: 1,
        ...change,
      });
      await expect(f.service.list("term", "actor")).rejects.toMatchObject({
        status: 409,
      });
    }
  });
  it("rejects missing permission and inactive accounts in the service", async () => {
    const f = fixture();
    f.actor.userRoles[0].role.rolePermissions = [];
    await expect(f.service.list("term", "actor")).rejects.toMatchObject({
      status: 403,
    });
    f.actor.status = "LOCKED";
    await expect(f.service.list("term", "actor")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("does not return proposals whose term disagrees with the request", async () => {
    const f = fixture();
    f.row.topic.termId = "other-term";
    expect(await f.service.list("term", "actor")).toEqual([]);
  });
});
