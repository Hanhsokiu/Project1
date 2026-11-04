import { describe, expect, it, vi } from "vitest";
import { defaultQuotaSettings } from "@doan/shared";
import { QuotaService } from "./quota.service";

function setup() {
  const term = {
    id: "t1",
    status: "CLOSED_REGISTRATION",
    isLocked: false,
    quotaPolicy: null as unknown,
    parameters: [],
    phases: [],
    termStudents: Array.from({ length: 12 }, (_, i) => ({
      studentId: `s${i}`,
      student: { isActive: true, academicEligible: true, gpa: 3.2 },
    })),
    termLecturers: ["MASTER", "DOCTOR"].map((degree, i) => ({
      lecturerId: `l${i}`,
      quota: 1,
      lecturer: {
        id: `l${i}`,
        lecturerCode: `GV${i}`,
        fullName: `Giảng viên ${i}`,
        academicDegree: degree,
        academicRank: "NONE",
        isActive: true,
        researchAreas: [{ researchAreaId: "a" }],
      },
    })),
  };
  const context = {
    term,
    registrations: [] as {
      studentId: string;
      directionId: string;
      status: string;
    }[],
    assignments: [] as {
      advisorId: string;
      registration: { studentId: string };
    }[],
    official: 0,
  };
  const repo = {
    transaction: vi.fn(async (fn) => fn({})),
    quotaContext: vi.fn(async () => context),
    update: vi.fn(async (_id, data) => {
      term.quotaPolicy = data.quotaPolicy;
    }),
    saveQuotas: vi.fn(async (_id, members) => {
      members.forEach((m: { lecturerId: string; quota: number }) => {
        term.termLecturers.find((l) => l.lecturerId === m.lecturerId)!.quota =
          m.quota;
      });
    }),
  };
  const audit = { log: vi.fn() };
  const service = new QuotaService(repo as never, audit as never);
  const input = {
    revision: 0,
    settings: structuredClone(defaultQuotaSettings),
    limits: [],
  };
  return { term, context, repo, audit, service, input };
}
describe("term quota workflow", () => {
  it("persists a draft snapshot without changing effective quotas, then approves atomically with audit", async () => {
    const { service, input, repo, audit, term } = setup();
    const p = await service.preview("t1", input, "faculty");
    expect(p.status).toBe("DRAFT");
    expect(p.totalCoefficient).toBe(1.75);
    expect(p.demandCount).toBe(12);
    expect(repo.saveQuotas).not.toHaveBeenCalled();
    expect(term.termLecturers.map((l) => l.quota)).toEqual([1, 1]);
    const final = await service.approve(
      "t1",
      {
        revision: p.revision,
        members: p.members.map((m) => ({
          lecturerId: m.lecturerId,
          quota: m.suggestedQuota,
          reason: "",
        })),
      },
      "faculty",
    );
    expect(final.status).toBe("APPROVED");
    expect(final.revision).toBe(2);
    expect(final.approvedAt).toBeTruthy();
    expect(repo.saveQuotas).toHaveBeenCalledOnce();
    expect(audit.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "QUOTA_APPROVED",
        oldValue: expect.objectContaining({ status: "DRAFT" }),
      }),
      {},
    );
  });
  it("rejects stale revisions and data changed after preview", async () => {
    const { service, input, term, repo } = setup();
    const p = await service.preview("t1", input, "f");
    await expect(service.preview("t1", input, "f")).rejects.toThrow(
      "vừa thay đổi",
    );
    term.termLecturers[0].lecturer.academicDegree = "DOCTOR";
    await expect(
      service.approve("t1", { revision: p.revision, members: [] }, "f"),
    ).rejects.toThrow("Dữ liệu đã thay đổi");
    expect(repo.saveQuotas).not.toHaveBeenCalled();
  });
  it("requires a reason for overrides, respects caps and refuses incomplete membership", async () => {
    const { service, input } = setup();
    const p = await service.preview("t1", input, "f");
    const members = p.members.map((m) => ({
      lecturerId: m.lecturerId,
      quota: m.suggestedQuota,
      reason: "",
    }));
    await expect(
      service.approve(
        "t1",
        { revision: p.revision, members: members.slice(1) },
        "f",
      ),
    ).rejects.toThrow("đầy đủ");
    members[0].quota++;
    await expect(
      service.approve("t1", { revision: p.revision, members }, "f"),
    ).rejects.toThrow("lý do");
    members[0].reason = "Điều chỉnh theo chuyên môn";
    members[0].quota = 11;
    await expect(
      service.approve("t1", { revision: p.revision, members }, "f"),
    ).rejects.toThrow("phải từ");
  });
  it("requires credentials and blocks locked phases or published plans", async () => {
    const { service, input, term, context } = setup();
    term.termLecturers[0].lecturer.academicDegree = "";
    await expect(service.preview("t1", input, "f")).rejects.toThrow("học vị");
    term.termLecturers[0].lecturer.academicDegree = "MASTER";
    term.isLocked = true;
    await expect(service.preview("t1", input, "f")).rejects.toThrow("khóa");
    term.isLocked = false;
    context.official = 1;
    await expect(service.preview("t1", input, "f")).rejects.toThrow("công bố");
  });
  it("reports insufficient capacity and prevents approval until addressed", async () => {
    const { service, input } = setup();
    input.settings.defaultLimit = 3;
    const p = await service.preview("t1", input, "f");
    expect(p.shortage).toBe(6);
    await expect(
      service.approve(
        "t1",
        {
          revision: p.revision,
          members: p.members.map((m) => ({
            lecturerId: m.lecturerId,
            quota: m.quota,
            reason: "",
          })),
        },
        "f",
      ),
    ).rejects.toThrow("chưa đủ");
  });
  it("blocks specialty shortages even when the total capacity is sufficient", async () => {
    const { service, input, context, term } = setup();
    term.termLecturers[1].lecturer.researchAreas = [{ researchAreaId: "b" }];
    context.registrations = term.termStudents.map((s) => ({
      studentId: s.studentId,
      directionId: "a",
      status: "SUBMITTED",
    }));
    const p = await service.preview("t1", input, "f");
    expect(p.warnings.join()).toContain("đúng hướng");
    await expect(
      service.approve(
        "t1",
        {
          revision: p.revision,
          members: p.members.map((m) => ({
            lecturerId: m.lecturerId,
            quota: m.quota,
            reason: "",
          })),
        },
        "f",
      ),
    ).rejects.toThrow("đúng hướng");
  });
});
