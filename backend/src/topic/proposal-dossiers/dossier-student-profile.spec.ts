import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  DossierStudentProfileSchema,
  type DossierStudentProfileInput,
} from "@doan/shared";
import { DossierService } from "./dossier.service";
import { DossierValidator } from "./dossier.validator";
import { DossierPdfService } from "./dossier-pdf.service";
import type { DossierRecord, DossierRepository } from "./dossier.repository";
import { DossierSession } from "./dossier.repository";
import type {
  ReviewPrincipal,
  ReviewProposal,
} from "../proposal-reviews/proposal-review.repository";
import { ProposalReviewValidator } from "../proposal-reviews/proposal-review.validator";

type Profile = {
  termStudentId: string;
  className: string;
  majorName: string;
  revision: number;
};

const input: DossierStudentProfileInput = {
  className: "CNTT K63",
  majorName: "Công nghệ thông tin",
  expectedRevision: null,
};

function fixture() {
  const review = new ProposalReviewValidator();
  const user = {
    id: "faculty-user",
    status: "ACTIVE",
    userRoles: [
      {
        role: {
          name: "FACULTY",
          rolePermissions: [
            { permission: { resource: "proposal", action: "finalize" } },
            { permission: { resource: "proposal", action: "read" } },
            { permission: { resource: "proposal", action: "export" } },
          ],
        },
      },
    ],
    student: { id: "student", isActive: true },
    lecturer: { id: "advisor", isActive: true },
  } as unknown as ReviewPrincipal;
  const proposal = {
    id: "proposal",
    studentId: "student",
    status: "APPROVED",
    topic: {
      id: "topic",
      title: "Đề cương đã duyệt",
      termId: "term",
      researchArea: {
        pr2bResearchAreaWorkflowResearchAreaId: { departmentId: "department" },
      },
      pr2bTopicWorkflowTopicId: {
        termId: "term",
        termStudentId: "term-student",
        revision: 3,
        refTermStudentId: { termId: "term", studentId: "student" },
      },
    },
    pr2bProposalWorkflowProposalId: {
      revision: 7,
      submittedVersionId: "approved-version",
      workingVersionId: "approved-version",
    },
  } as unknown as ReviewProposal;
  const term = { id: "term", status: "IN_PROGRESS", isLocked: false };
  const phase = {
    refPhaseId: {
      termId: "term",
      isLocked: false,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
    },
  };
  const state: { profile: Profile | null; dossier: DossierRecord | null } = {
    profile: null,
    dossier: null,
  };
  const session = {
    principal: vi.fn(async () => user),
    proposal: vi.fn(async () => proposal),
    grants: vi.fn(async () => [
      {
        allDepartments: false,
        pr2bGrantDepartmentGrantId: [{ departmentId: "department" }],
      },
    ]),
    term: vi.fn(async () => term),
    phase: vi.fn(async () => phase),
    lock: vi.fn(),
    lockPrintInputs: vi.fn(),
    printStudent: vi.fn(async () => ({ id: "student", isActive: true })),
    dossier: vi.fn(async () => state.dossier),
    profile: vi.fn(async () => state.profile),
    writeStudentProfile: vi.fn(
      async (termStudentId: string, values: DossierStudentProfileInput) => {
        state.profile = {
          termStudentId,
          className: values.className,
          majorName: values.majorName,
          revision: state.profile ? state.profile.revision + 1 : 0,
        };
        return { count: 1 };
      },
    ),
    dossierAudit: vi.fn(),
    // These existing workflow writes must never be used to confirm print data.
    advance: vi.fn(),
    advanceProposal: vi.fn(),
    advanceReview: vi.fn(),
    status: vi.fn(),
    seal: vi.fn(),
    addVersion: vi.fn(),
    createReview: vi.fn(),
    comment: vi.fn(),
    decision: vi.fn(),
    createDossier: vi.fn(),
    updateDossier: vi.fn(),
    addFinalization: vi.fn(),
    addReceipt: vi.fn(),
  };
  const transaction = vi.fn(async (work: (s: unknown) => Promise<unknown>) =>
    work(session),
  );
  const service = new DossierService(
    { transaction } as unknown as DossierRepository,
    new DossierValidator(review),
    review,
    new DossierPdfService(),
  );
  const result = { proposalId: proposal.id };
  const view = vi
    .spyOn(
      service as unknown as { view(...args: unknown[]): Promise<unknown> },
      "view",
    )
    .mockResolvedValue(result);
  const save = (values: DossierStudentProfileInput = input) =>
    service.saveStudentProfile(user.id, proposal.id, values);
  return {
    user,
    proposal,
    term,
    phase,
    state,
    session,
    transaction,
    service,
    view,
    result,
    save,
  };
}

const conflict = {
  status: 409,
  response: { error: { code: "REVISION_CONFLICT" } },
};
const outOfScope = { response: { error: { code: "COMMON_001" } } };

describe("Confirmed student print profile contract", () => {
  it("requires an explicit revision and trims confirmed class and major", () => {
    expect(
      DossierStudentProfileSchema.parse({
        ...input,
        className: " CNTT K63 ",
        majorName: " Công nghệ thông tin ",
      }),
    ).toEqual(input);
    expect(
      DossierStudentProfileSchema.safeParse({
        className: input.className,
        majorName: input.majorName,
      }).success,
    ).toBe(false);
    expect(
      DossierStudentProfileSchema.safeParse({ ...input, expectedRevision: 0 })
        .success,
    ).toBe(true);
  });

  it.each([
    { className: " " },
    { majorName: " " },
    { className: "a".repeat(101) },
    { majorName: "a".repeat(201) },
    { expectedRevision: -1 },
    { expectedRevision: 1.2 },
    { expectedRevision: "0" },
    { signed: true },
    { studentId: "another-student" },
    { termStudentId: "another-enrollment" },
  ])("rejects invalid or client-owned metadata: %j", (changes) => {
    expect(
      DossierStudentProfileSchema.safeParse({ ...input, ...changes }).success,
    ).toBe(false);
  });
});

describe("Faculty confirmation of class and major for dossier printing", () => {
  it("creates only the enrolled student's print profile and records its provenance", async () => {
    const f = fixture();
    const unchangedProposal = structuredClone(f.proposal);

    await expect(f.save()).resolves.toEqual(f.result);

    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), true);
    expect(f.session.grants).toHaveBeenCalledWith("faculty-user", "term");
    expect(f.session.lock).toHaveBeenCalledWith("term", [], "proposal");
    expect(f.session.principal.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(f.session.proposal.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(f.session.writeStudentProfile).toHaveBeenCalledOnce();
    expect(f.session.writeStudentProfile).toHaveBeenCalledWith(
      "term-student",
      input,
    );
    expect(f.state.profile).toEqual({
      termStudentId: "term-student",
      className: input.className,
      majorName: input.majorName,
      revision: 0,
    });
    expect(f.session.dossierAudit).toHaveBeenCalledWith(
      "faculty-user",
      "proposal",
      "STUDENT_PROFILE_CONFIRMED",
      {
        termStudentId: "term-student",
        previous: null,
        current: f.state.profile,
      },
    );
    expect(f.proposal).toEqual(unchangedProposal);
    for (const write of [
      f.session.advance,
      f.session.advanceProposal,
      f.session.advanceReview,
      f.session.status,
      f.session.seal,
      f.session.addVersion,
      f.session.createReview,
      f.session.comment,
      f.session.decision,
      f.session.createDossier,
      f.session.updateDossier,
      f.session.addFinalization,
      f.session.addReceipt,
    ])
      expect(write).not.toHaveBeenCalled();
  });

  it("updates a matching profile revision and preserves old values in the audit", async () => {
    const f = fixture();
    const previous = {
      termStudentId: "term-student",
      className: "CNTT K62",
      majorName: "Kỹ thuật phần mềm",
      revision: 4,
    };
    f.state.profile = previous;

    await f.save({ ...input, expectedRevision: 4 });

    expect(f.state.profile).toEqual({
      termStudentId: "term-student",
      className: input.className,
      majorName: input.majorName,
      revision: 5,
    });
    expect(f.session.dossierAudit).toHaveBeenCalledWith(
      "faculty-user",
      "proposal",
      "STUDENT_PROFILE_CONFIRMED",
      {
        termStudentId: "term-student",
        previous,
        current: f.state.profile,
      },
    );
  });

  it("returns the current view without writing when confirmed values are unchanged", async () => {
    const f = fixture();
    f.state.profile = { ...input, termStudentId: "term-student", revision: 2 };

    await expect(f.save({ ...input, expectedRevision: 2 })).resolves.toEqual(
      f.result,
    );

    expect(f.state.profile.revision).toBe(2);
    expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    expect(f.session.dossierAudit).not.toHaveBeenCalled();
  });

  it.each(["STUDENT", "LECTURER", "ADMIN"])(
    "denies %s even when it has read, export and finalize permissions",
    async (role) => {
      const f = fixture();
      f.user.userRoles[0].role.name = role;

      await expect(f.save()).rejects.toMatchObject(outOfScope);

      expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
      expect(f.session.dossierAudit).not.toHaveBeenCalled();
    },
  );

  it("denies faculty without proposal:finalize", async () => {
    const f = fixture();
    f.user.userRoles[0].role.rolePermissions =
      f.user.userRoles[0].role.rolePermissions.filter(
        (item) => item.permission.action !== "finalize",
      );

    await expect(f.save()).rejects.toMatchObject(outOfScope);

    expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
  });

  it.each(["none", "other-department"])(
    "denies faculty with %s grants",
    async (scope) => {
      const f = fixture();
      f.session.grants.mockResolvedValue(
        scope === "none"
          ? []
          : [
              {
                allDepartments: false,
                pr2bGrantDepartmentGrantId: [{ departmentId: "other" }],
              },
            ],
      );

      await expect(f.save()).rejects.toMatchObject(outOfScope);

      expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    },
  );

  it("rechecks grants after the transaction lock before writing", async () => {
    const f = fixture();
    f.session.lock.mockImplementation(async () => {
      f.session.grants.mockResolvedValue([]);
    });

    await expect(f.save()).rejects.toMatchObject(outOfScope);

    expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    expect(f.session.dossierAudit).not.toHaveBeenCalled();
  });

  it("allows a faculty grant for all departments of this term", async () => {
    const f = fixture();
    f.session.grants.mockResolvedValue([
      { allDepartments: true, pr2bGrantDepartmentGrantId: [] },
    ]);

    await expect(f.save()).resolves.toEqual(f.result);

    expect(f.session.writeStudentProfile).toHaveBeenCalledOnce();
  });

  it.each(["COMPLETED", "CANCELLED"])(
    "denies a %s term before altering print data",
    async (status) => {
      const f = fixture();
      f.term.status = status;

      await expect(f.save()).rejects.toMatchObject({
        status: 409,
        response: { error: { code: "TERM_003" } },
      });

      expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    },
  );

  it("rejects an inactive student instead of confirming print information", async () => {
    const f = fixture();
    f.session.printStudent.mockResolvedValue({
      id: "student",
      isActive: false,
    });

    await expect(f.save()).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "STUDENT_PROFILE_NOT_READY" } },
    });

    expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    expect(f.session.dossierAudit).not.toHaveBeenCalled();
  });

  it("rejects a phase from another term instead of bypassing schedule readiness", async () => {
    const f = fixture();
    f.phase.refPhaseId.termId = "other-term";

    await expect(f.save()).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "INPUT_NOT_READY" } },
    });

    expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    expect(f.session.dossierAudit).not.toHaveBeenCalled();
  });

  it.each(["term", "phase", "future-phase", "expired-phase"])(
    "denies a locked or unavailable %s",
    async (condition) => {
      const f = fixture();
      if (condition === "term") f.term.isLocked = true;
      if (condition === "phase") f.phase.refPhaseId.isLocked = true;
      if (condition === "future-phase")
        f.phase.refPhaseId.startDate = new Date(Date.now() + 3_600_000);
      if (condition === "expired-phase")
        f.phase.refPhaseId.endDate = new Date(Date.now() - 3_600_000);

      await expect(f.save()).rejects.toMatchObject({
        status: 409,
        response: { error: { code: "TERM_003" } },
      });

      expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
      expect(f.session.dossierAudit).not.toHaveBeenCalled();
    },
  );

  it.each(["missing", "other-term", "other-student"])(
    "rejects %s enrollment ownership",
    async (condition) => {
      const f = fixture();
      const owner = f.proposal.topic.pr2bTopicWorkflowTopicId!;
      if (condition === "missing") owner.termStudentId = null;
      if (condition === "other-term") owner.refTermStudentId!.termId = "other";
      if (condition === "other-student")
        owner.refTermStudentId!.studentId = "other";

      await expect(f.save()).rejects.toMatchObject({
        status: 409,
        response: { error: { code: "INPUT_NOT_READY" } },
      });

      expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    },
  );

  it.each(["FINALIZED", "RECEIVED", "LEGACY"])(
    "preserves the confirmed profile when the dossier is %s",
    async (state) => {
      const f = fixture();
      f.state.dossier = {
        id: "dossier",
        pr2bDossierWorkflowDossierId:
          state === "LEGACY" ? null : { state, revision: 3 },
        pr2bDossierFinalizationDossierId: [],
      } as unknown as DossierRecord;

      await expect(f.save()).rejects.toMatchObject({
        status: 409,
        response: { error: { code: "DOSSIER_LOCKED" } },
      });

      expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
      expect(f.session.dossierAudit).not.toHaveBeenCalled();
    },
  );

  it("rejects null expectedRevision when a profile already exists, including unchanged data", async () => {
    const f = fixture();
    f.state.profile = { ...input, termStudentId: "term-student", revision: 0 };

    await expect(f.save()).rejects.toMatchObject(conflict);

    expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    expect(f.session.dossierAudit).not.toHaveBeenCalled();
  });

  it("rejects an update revision when the profile does not exist", async () => {
    const f = fixture();

    await expect(
      f.save({ ...input, expectedRevision: 0 }),
    ).rejects.toMatchObject(conflict);

    expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
  });

  it("rejects a stale revision even when its text matches the current values", async () => {
    const f = fixture();
    f.state.profile = { ...input, termStudentId: "term-student", revision: 3 };

    await expect(
      f.save({ ...input, expectedRevision: 2 }),
    ).rejects.toMatchObject(conflict);

    expect(f.session.writeStudentProfile).not.toHaveBeenCalled();
    expect(f.session.dossierAudit).not.toHaveBeenCalled();
  });

  it("reports a database compare-and-swap miss without recording a successful confirmation", async () => {
    const f = fixture();
    f.session.writeStudentProfile.mockResolvedValue({ count: 0 });

    await expect(f.save()).rejects.toMatchObject(conflict);

    expect(f.session.dossierAudit).not.toHaveBeenCalled();
    expect(f.view).not.toHaveBeenCalled();
  });
});

describe("Print profile database concurrency guard", () => {
  it("creates absent records without an upsert that could replace a concurrent confirmation", async () => {
    const create = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn();
    const session = new DossierSession({
      dossierStudentProfile: { create, updateMany },
    } as unknown as Prisma.TransactionClient);

    await expect(
      session.writeStudentProfile("term-student", input),
    ).resolves.toEqual({
      count: 1,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        termStudentId: "term-student",
        className: input.className,
        majorName: input.majorName,
      },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("updates only the requested enrollment revision and preserves a database conflict", async () => {
    const create = vi.fn();
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const session = new DossierSession({
      dossierStudentProfile: { create, updateMany },
    } as unknown as Prisma.TransactionClient);

    await expect(
      session.writeStudentProfile("term-student", {
        ...input,
        expectedRevision: 7,
      }),
    ).resolves.toEqual({ count: 0 });

    expect(updateMany).toHaveBeenCalledWith({
      where: { termStudentId: "term-student", revision: 7 },
      data: {
        className: input.className,
        majorName: input.majorName,
        revision: { increment: 1 },
      },
    });
    expect(create).not.toHaveBeenCalled();
  });
});
