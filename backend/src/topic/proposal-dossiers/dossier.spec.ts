import { describe, it, expect, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import {
  DossierFinalizeSchema,
  DossierReceiptSchema,
  emptyProposalContent,
} from "@doan/shared";
import type { DossierPrintSnapshot } from "@doan/shared";
import { DossierValidator } from "./dossier.validator";
import {
  ProposalReviewValidator,
  reviewHash,
} from "../proposal-reviews/proposal-review.validator";
import { DossierService } from "./dossier.service";
import { DossierPdfService } from "./dossier-pdf.service";
import type {
  DossierRecord,
  DossierSession,
  DossierRepository,
} from "./dossier.repository";
const review = new ProposalReviewValidator(),
  v = new DossierValidator(review);
const fail = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw Error("Expected failure");
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getResponse()).toMatchObject({
      error: { code },
    });
  }
};
const content = {
  ...emptyProposalContent,
  objectives: "Mục tiêu",
  scope: "Phạm vi",
  mainContents: "Nội dung",
  tools: "Công nghệ",
  expectedResults: "Kết quả",
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: "2027-01-01T00:00:00Z",
  schedule: [
    {
      label: "Nghiên cứu",
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2026-02-01T00:00:00Z",
      deliverables: "Đề cương",
    },
  ],
};
const snapshot: DossierPrintSnapshot = {
  schemaVersion: 1,
  title: "Đề tài tiếng Việt",
  termName: "Đợt 2026",
  student: {
    id: "s",
    name: "Nguyễn Văn An",
    code: "SV01",
    className: "CNTT K63",
    majorName: "Công nghệ thông tin",
    trainingSystem: "Chính quy",
  },
  advisor: { id: "a", name: "Trần Thị Hồng", department: "Công nghệ phần mềm" },
  academicProfileRevision: 1,
  assignmentId: "as",
  assignmentRevision: 0,
  topicRevision: 0,
  content,
};
describe("Step 7 contract and dossier validator", () => {
  it("accepts explicit approved version/revisions and rejects client-supplied signature/receipt", () => {
    expect(
      DossierFinalizeSchema.safeParse({
        expectedProposalRevision: 2,
        expectedDossierRevision: 0,
        approvedVersionId: "v",
      }).success,
    ).toBe(true);
    expect(
      DossierFinalizeSchema.safeParse({
        expectedProposalRevision: 2,
        expectedDossierRevision: 0,
        approvedVersionId: "v",
        signed: true,
      }).success,
    ).toBe(false);
    expect(
      DossierReceiptSchema.safeParse({
        expectedRevision: 1,
        finalizationId: "f",
        note: "Đã nhận",
      }).success,
    ).toBe(true);
    expect(
      DossierReceiptSchema.safeParse({
        expectedRevision: 1,
        finalizationId: "f",
        receivedAt: "2020-01-01Z",
      }).success,
    ).toBe(false);
  });
  it("allows a fresh dossier but blocks finalized and unresolved legacy dossiers", () => {
    expect(() => v.open(null, 0)).not.toThrow();
    fail(() => v.open(null, 1), "REVISION_CONFLICT");
    fail(
      () => v.open({ pr2bDossierWorkflowDossierId: null } as DossierRecord, 0),
      "DOSSIER_LOCKED",
    );
    fail(
      () =>
        v.open(
          {
            pr2bDossierWorkflowDossierId: { state: "FINALIZED", revision: 1 },
            pr2bDossierFinalizationDossierId: [],
          } as unknown as DossierRecord,
          1,
        ),
      "DOSSIER_LOCKED",
    );
  });
  it("validates immutable print snapshot and rejects changed content/hash", () => {
    expect(v.snapshotIntegrity(snapshot, reviewHash(snapshot))).toEqual(
      snapshot,
    );
    fail(
      () =>
        v.snapshotIntegrity(
          { ...snapshot, title: "Changed" },
          reviewHash(snapshot),
        ),
      "INPUT_NOT_READY",
    );
    fail(() => v.snapshotIntegrity(null, "legacy"), "INPUT_NOT_READY");
  });
  it("permits scoped faculty finalization and rejects ADMIN even with all actions", async () => {
    const p = {
      id: "p",
      studentId: "s",
      topic: {
        termId: "t",
        researchArea: {
          pr2bResearchAreaWorkflowResearchAreaId: { departmentId: "d" },
        },
      },
    };
    const faculty = {
      id: "u",
      status: "ACTIVE",
      userRoles: [
        {
          role: {
            name: "FACULTY",
            rolePermissions: [
              { permission: { resource: "proposal", action: "finalize" } },
            ],
          },
        },
      ],
    };
    const session = {
      principal: vi.fn().mockResolvedValue(faculty),
      proposal: vi.fn().mockResolvedValue(p),
      grants: vi
        .fn()
        .mockResolvedValue([
          {
            allDepartments: false,
            pr2bGrantDepartmentGrantId: [{ departmentId: "d" }],
          },
        ]),
      lock: vi.fn(),
      replay: vi
        .fn()
        .mockResolvedValue({
          payloadHash: reviewHash({}),
          result: { ok: true },
        }),
    };
    const repo = {
      transaction: async (fn: (s: unknown) => unknown) => fn(session),
    } as unknown as DossierRepository;
    const service = new DossierService(
      repo,
      v,
      review,
      new DossierPdfService(),
    );
    const input = {} as Parameters<DossierService["finalize"]>[2];
    await expect(service.finalize("u", "p", input, "key")).resolves.toEqual({
      ok: true,
    });
    faculty.userRoles[0].role.name = "ADMIN";
    await expect(
      service.finalize("u", "p", input, "key"),
    ).rejects.toMatchObject({ response: { error: { code: "COMMON_001" } } });
  });
  it("checks current scope before replay and detects payload reuse", async () => {
    const faculty = {
      id: "u",
      status: "ACTIVE",
      userRoles: [
        {
          role: {
            name: "FACULTY",
            rolePermissions: [
              { permission: { resource: "proposal", action: "finalize" } },
            ],
          },
        },
      ],
    };
    const session = {
      principal: async () => faculty,
      proposal: async () => ({
        id: "p",
        topic: {
          termId: "t",
          researchArea: {
            pr2bResearchAreaWorkflowResearchAreaId: { departmentId: "d" },
          },
        },
      }),
      grants: vi.fn().mockResolvedValue([{ allDepartments: true }]),
      lock: vi.fn(),
      replay: vi
        .fn()
        .mockResolvedValue({ payloadHash: "different", result: {} }),
    };
    const service = new DossierService(
      {
        transaction: async (fn: (s: unknown) => unknown) => fn(session),
      } as unknown as DossierRepository,
      v,
      review,
      new DossierPdfService(),
    );
    await expect(
      service.finalize(
        "u",
        "p",
        {} as Parameters<DossierService["finalize"]>[2],
        "key",
      ),
    ).rejects.toMatchObject({
      response: { error: { code: "IDEMPOTENCY_CONFLICT" } },
    });
    session.replay.mockClear();
    session.grants.mockResolvedValue([]);
    await expect(
      service.finalize(
        "u",
        "p",
        {} as Parameters<DossierService["finalize"]>[2],
        "key",
      ),
    ).rejects.toMatchObject({ response: { error: { code: "COMMON_001" } } });
    expect(session.replay).not.toHaveBeenCalled();
  });
  it("requires confirmed academic profile instead of guessing class/major", async () => {
    const s = {
      profile: async () => null,
      printStudent: async () => null,
      printAdvisor: async () => null,
      term: async () => null,
    } as unknown as DossierSession;
    const p = {
      id: "p",
      studentId: "s",
      topic: {
        termId: "t",
        pr2bTopicWorkflowTopicId: {
          termId: "t",
          termStudentId: "ts",
          refTermStudentId: { termId: "t", studentId: "s" },
        },
      },
    } as Parameters<DossierValidator["snapshot"]>[1];
    await expect(
      v.snapshot(s, p, { assignment: { advisorId: "a" } } as Parameters<
        DossierValidator["snapshot"]
      >[2]),
    ).rejects.toMatchObject({
      response: { error: { code: "STUDENT_PROFILE_NOT_READY" } },
    });
  });
});
describe("Step 7 PDF renderer", () => {
  it("renders a real embedded-font A4 PDF without OS fonts or network", async () => {
    const result = await new DossierPdfService().render(
      snapshot,
      "fixture-finalization",
      new Date("2026-10-22Z"),
    );
    expect(result.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.bytes.includes(Buffer.from("/FontFile2"))).toBe(true);
    expect(result.bytes.includes(Buffer.from("/ToUnicode"))).toBe(true);
    expect(result.pages).toBeGreaterThan(0);
  });
});
