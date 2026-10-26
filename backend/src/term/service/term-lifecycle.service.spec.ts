import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AcademicSemester, TermStatus } from "@prisma/client";
import { AuditService } from "../../common/audit/audit.service";
import { PERMISSION_KEY } from "../../common/security/require-permission.decorator";
import { ThesisTermController } from "../controller/thesis-term.controller";
import {
  latestTermQuerySchema,
  PhaseInput,
  termCreateSchema,
  termQuerySchema,
} from "../dto/term.dto";
import { LoadedTerm, TermRepository } from "../repository/term.repository";
import {
  defaultPhasePlan,
  defaultTermParameters,
  hasPassingGpa,
  validatePhasePlan,
} from "../validator/term-configuration.validator";
import { TermTransitionValidator } from "../validator/term-transition.validator";
import { TermLifecycleService } from "./term-lifecycle.service";
import { operationWindow } from "./term-window.service";

const semester: AcademicSemester = {
  id: "semester1",
  academicYear: "2026-2027",
  semester: 1,
  name: "2026-2027 / Học kỳ 1",
  startDate: new Date("2026-09-01T00:00:00+07:00"),
  endDate: new Date("2027-02-01T00:00:00+07:00"),
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
};
const input = {
  code: "datn-2026-1",
  name: "Đợt đồ án học kỳ một",
  semesterId: semester.id,
  trainingSystemId: "cq",
  startDate: "2026-10-01T00:00:00+07:00",
  endDate: "2027-01-30T00:00:00+07:00",
};
function loaded(): LoadedTerm {
  const phases = defaultPhasePlan(
    new Date(input.startDate),
    new Date(input.endDate),
  );
  return {
    id: "term1",
    code: "DATN-2026-1",
    name: input.name,
    academicYear: semester.academicYear,
    semester: 1,
    semesterId: semester.id,
    trainingSystemId: "cq",
    isLocked: false,
    status: "DRAFT",
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-01"),
    semesterRecord: semester,
    trainingSystem: { id: "cq", code: "CQ", name: "Chính quy" },
    phases: phases.map((p, i) => ({
      id: `p${i}`,
      termId: "term1",
      phaseName: p.name,
      code: p.code,
      startDate: new Date(p.start),
      endDate: new Date(p.end),
      isLocked: p.locked,
      createdAt: new Date("2026-09-01"),
    })),
    parameters: Object.entries(defaultTermParameters).map(([key, value]) => ({
      id: key,
      termId: "term1",
      key,
      value: String(value),
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    termStudents: [
      {
        id: "ts1",
        termId: "term1",
        studentId: "s1",
        createdAt: new Date(),
        student: {
          id: "s1",
          studentCode: "001",
          fullName: "Nguyễn Ánh Đào",
          trainingSystemId: "cq",
          isActive: true,
          academicEligible: true,
          gpa: 3,
        },
      },
    ],
    termLecturers: [
      {
        termId: "term1",
        lecturerId: "l1",
        quota: 2,
        lecturer: {
          id: "l1",
          isActive: true,
          researchAreas: [{ researchAreaId: "area1" }],
        },
      },
    ],
  } as unknown as LoadedTerm;
}
type State = {
  assignmentPublished: boolean;
  resultsPublished: boolean;
  officialAssignments: {
    advisorId: string;
    registration: { studentId: string };
  }[];
};
let term: LoadedTerm,
  state: State,
  repository: Record<string, ReturnType<typeof vi.fn>>,
  audit: { log: ReturnType<typeof vi.fn> },
  service: TermLifecycleService;
const tx = { transaction: "test" };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T03:00:00Z"));
  term = loaded();
  state = {
    assignmentPublished: false,
    resultsPublished: false,
    officialAssignments: [],
  };
  audit = { log: vi.fn().mockResolvedValue({}) };
  repository = {
    transaction: vi.fn((fn) => fn(tx)),
    findById: vi.fn().mockImplementation(async () => term),
    publicationState: vi.fn().mockImplementation(async () => state),
    findByCode: vi.fn().mockResolvedValue(null),
    semester: vi.fn().mockResolvedValue(semester),
    trainingSystem: vi
      .fn()
      .mockResolvedValue({ id: "cq", code: "CQ", name: "Chính quy" }),
    semesterByKey: vi.fn().mockResolvedValue(null),
    createSemester: vi.fn().mockResolvedValue(semester),
    create: vi.fn().mockImplementation(async () => term),
    update: vi
      .fn()
      .mockImplementation(
        async (_id: string, values: Record<string, unknown>) => {
          Object.assign(term, values);
          return term;
        },
      ),
    updatePhase: vi.fn().mockResolvedValue({}),
    createPhase: vi.fn().mockResolvedValue({}),
    replaceParameters: vi.fn().mockResolvedValue(undefined),
    students: vi
      .fn()
      .mockImplementation(async (ids: string[]) =>
        term.termStudents
          .filter((s) => ids.includes(s.studentId))
          .map((s) => s.student),
      ),
    lecturers: vi
      .fn()
      .mockImplementation(async (ids: string[]) =>
        term.termLecturers
          .filter((l) => ids.includes(l.lecturerId))
          .map((l) => l.lecturer),
      ),
    registrations: vi.fn().mockResolvedValue([]),
    replaceRoster: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockImplementation(async () => ({ items: [term], total: 1 })),
    latest: vi.fn().mockImplementation(async () => term),
    semesters: vi.fn().mockResolvedValue([semester]),
  };
  service = new TermLifecycleService(
    repository as unknown as TermRepository,
    new TermTransitionValidator(),
    audit as unknown as AuditService,
  );
});
afterEach(() => vi.useRealTimers());

describe("term DTO and API shape", () => {
  it("rejects unknown fields, missing latest filters and timezone-free inputs", () => {
    expect(
      termCreateSchema.safeParse({ ...input, unexpected: true }).success,
    ).toBe(false);
    expect(
      termCreateSchema.safeParse({ ...input, startDate: "2026-10-01" }).success,
    ).toBe(false);
    expect(
      latestTermQuerySchema.safeParse({ trainingSystemId: "cq" }).success,
    ).toBe(false);
  });
  it("bounds pagination and maps the shared items/pageSize contract with derived official counts", async () => {
    expect(termQuerySchema.parse({ page: "2", limit: "15" })).toMatchObject({
      page: 2,
      pageSize: 15,
    });
    expect(termQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    state.officialAssignments = [
      { advisorId: "l1", registration: { studentId: "s1" } },
    ];
    state.assignmentPublished = true;
    const result = await service.findAll(termQuerySchema.parse({}));
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(result.items[0]).toMatchObject({
      program: "Chính quy",
      start: "2026-10-01",
      semesterNumber: 1,
      assignmentPublished: true,
    });
    expect(result.items[0].lecturers[0].officialCount).toBe(1);
    expect(result.items[0].phases).toHaveLength(6);
  });
  it("declares permissions for every management endpoint and authenticated reads", () => {
    const expected: Record<string, string> = {
      list: "read",
      detail: "read",
      latest: "read",
      window: "read",
      create: "create",
      update: "update",
      transition: "transition",
      lock: "lock",
      phases: "plan",
      parameters: "parameters",
      roster: "roster",
    };
    for (const [method, action] of Object.entries(expected)) {
      expect(
        Reflect.getMetadata(
          PERMISSION_KEY,
          (
            ThesisTermController.prototype as unknown as Record<
              string,
              (...args: unknown[]) => unknown
            >
          )[method],
        ),
      ).toEqual({ resource: "term", action });
    }
  });
});
describe("term creation and lifecycle", () => {
  it("creates a normalized term with all six ordered phases and audits in the same transaction", async () => {
    await service.create(input, "actor1");
    expect(repository.create).toHaveBeenCalled();
    const [data, transaction] = repository.create.mock.calls[0];
    expect(data.code).toBe("DATN-2026-1");
    expect(data.phases.create).toHaveLength(6);
    expect(data.trainingSystem.connect.id).toBe("cq");
    expect(transaction).toBe(tx);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "actor1", action: "CREATE_TERM" }),
      tx,
    );
  });
  it("rejects duplicate codes, invalid semester years and periods outside the semester", async () => {
    repository.findByCode.mockResolvedValue({ id: "other" });
    await expect(service.create(input, "actor")).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("Mã đợt") } },
    });
    expect(repository.create).not.toHaveBeenCalled();
    await expect(
      service.createSemester(
        { ...input, academicYear: "2026-2028", semester: 1 },
        "actor",
      ),
    ).rejects.toMatchObject({
      response: {
        error: { message: expect.stringContaining("hai năm liên tiếp") },
      },
    });
    repository.findByCode.mockResolvedValue(null);
    await expect(
      service.create({ ...input, endDate: "2027-03-01T00:00:00Z" }, "actor"),
    ).rejects.toMatchObject({
      response: {
        error: { message: expect.stringContaining("nằm trong kỳ học") },
      },
    });
  });
  it("requires a complete currently eligible roster and valid plan before opening", async () => {
    term.termStudents = [];
    await expect(
      service.transition(term.id, "OPEN_REGISTRATION", "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("danh sách") } },
    });
    term = loaded();
    term.termStudents[0].student.academicEligible = false;
    await expect(
      service.transition(term.id, "OPEN_REGISTRATION", "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("học vụ") } },
    });
    term = loaded();
    term.termLecturers[0].lecturer.researchAreas = [];
    await expect(
      service.transition(term.id, "OPEN_REGISTRATION", "actor"),
    ).rejects.toMatchObject({
      response: {
        error: { message: expect.stringContaining("hướng chuyên môn") },
      },
    });
    term = loaded();
    const response = await service.transition(
      term.id,
      "OPEN_REGISTRATION",
      "actor",
    );
    expect(response.status).toBe("OPEN_REGISTRATION");
  });
  it("prevents skipping states, entering execution without publication or reopening official registration", async () => {
    await expect(
      service.transition(term.id, "IN_PROGRESS", "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("không hợp lệ") } },
    });
    term.status = "CLOSED_REGISTRATION";
    await expect(
      service.transition(term.id, "IN_PROGRESS", "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("công bố") } },
    });
    state.assignmentPublished = true;
    await expect(
      service.transition(term.id, "OPEN_REGISTRATION", "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("Không mở lại") } },
    });
    expect(
      (await service.transition(term.id, "IN_PROGRESS", "actor")).status,
    ).toBe("IN_PROGRESS");
  });
  it("enforces term locks across every write while allowing an explicit audited unlock", async () => {
    term.isLocked = true;
    await expect(
      service.update(term.id, { name: "Tên cập nhật" }, "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("khóa") } },
    });
    await expect(
      service.saveRoster(
        term.id,
        { studentIds: ["s1"], lecturers: [{ lecturerId: "l1", quota: 2 }] },
        "actor",
      ),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("khóa") } },
    });
    await expect(
      service.saveParameters(term.id, {}, "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("khóa") } },
    });
    await expect(
      service.transition(term.id, "OPEN_REGISTRATION", "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("khóa") } },
    });
    await service.lock(term.id, false, "actor");
    expect(term.isLocked).toBe(false);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UNLOCK_TERM" }),
      tx,
    );
  });
});
describe("roster, quotas, parameters and phases", () => {
  const roster = () => ({
    studentIds: ["s1"],
    lecturers: [{ lecturerId: "l1", quota: 2 }],
  });
  it("rejects duplicate/nonexistent students and mismatched training systems", async () => {
    expect(hasPassingGpa(null, 0)).toBe(false);
    expect(hasPassingGpa(undefined, 0)).toBe(false);
    expect(hasPassingGpa("", 0)).toBe(false);
    expect(hasPassingGpa("NaN", 0)).toBe(false);
    expect(hasPassingGpa(4.1, 0)).toBe(false);
    expect(hasPassingGpa(3.2, 2)).toBe(true);
    await expect(
      service.saveRoster(
        term.id,
        { ...roster(), studentIds: ["s1", "s1"] },
        "actor",
      ),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("trùng") } },
    });
    await expect(
      service.saveRoster(
        term.id,
        { ...roster(), studentIds: ["missing"] },
        "actor",
      ),
    ).rejects.toMatchObject({
      response: {
        error: { message: expect.stringContaining("không tồn tại") },
      },
    });
    term.termStudents[0].student.trainingSystemId = "lt";
    await expect(
      service.saveRoster(term.id, roster(), "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("đúng hệ") } },
    });
    expect(repository.replaceRoster).not.toHaveBeenCalled();
  });
  it("preserves official students/advisors and refuses quotas below actual official assignments", async () => {
    state.assignmentPublished = true;
    state.officialAssignments = [
      { advisorId: "l1", registration: { studentId: "s1" } },
    ];
    await expect(
      service.saveRoster(term.id, { ...roster(), studentIds: [] }, "actor"),
    ).rejects.toMatchObject({
      response: {
        error: { message: expect.stringContaining("Không loại sinh viên") },
      },
    });
    await expect(
      service.saveRoster(term.id, { ...roster(), lecturers: [] }, "actor"),
    ).rejects.toMatchObject({
      response: {
        error: { message: expect.stringContaining("Không loại giảng viên") },
      },
    });
    await expect(
      service.saveRoster(
        term.id,
        { ...roster(), lecturers: [{ lecturerId: "l1", quota: 0 }] },
        "actor",
      ),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("Quota") } },
    });
    await service.saveRoster(term.id, roster(), "actor");
    expect(repository.replaceRoster).toHaveBeenCalledWith(
      term.id,
      roster(),
      tx,
    );
  });
  it("does not drop a student with an active registration", async () => {
    repository.registrations.mockResolvedValue([
      { studentId: "s1", status: "PENDING" },
    ]);
    await expect(
      service.saveRoster(term.id, { ...roster(), studentIds: [] }, "actor"),
    ).rejects.toMatchObject({
      response: {
        error: { message: expect.stringContaining("đăng ký còn hiệu lực") },
      },
    });
  });
  it("rejects invalid weights and GPA thresholds conflicting with the current roster", async () => {
    await expect(
      service.saveParameters(
        term.id,
        { process_weight: 0.8, committee_weight: 0.6 },
        "actor",
      ),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("bằng 1") } },
    });
    await expect(
      service.saveParameters(term.id, { passing_gpa_threshold: 3.5 }, "actor"),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining("GPA") } },
    });
    await service.saveParameters(
      term.id,
      { process_weight: 0.5, committee_weight: 0.5 },
      "actor",
    );
    expect(repository.replaceParameters).toHaveBeenCalledWith(
      term.id,
      expect.objectContaining({ process_weight: 0.5 }),
      tx,
    );
  });
  it("requires all six phases with unique codes, ordered nonoverlapping intervals and valid owned IDs", async () => {
    const phases = defaultPhasePlan(term.startDate, term.endDate);
    expect(() =>
      validatePhasePlan(phases.slice(0, 5), term.startDate, term.endDate),
    ).toThrow();
    const overlap = structuredClone(phases);
    overlap[1].start = overlap[0].start;
    expect(() =>
      validatePhasePlan(overlap, term.startDate, term.endDate),
    ).toThrow();
    const foreign: PhaseInput[] = phases.map((p, i) => ({
      ...p,
      id: i === 0 ? "foreign" : undefined,
    }));
    await expect(
      service.savePhases(term.id, foreign, "actor"),
    ).rejects.toMatchObject({
      response: {
        error: { message: expect.stringContaining("không thuộc đợt") },
      },
    });
    await service.savePhases(term.id, phases, "actor");
    expect(repository.updatePhase).toHaveBeenCalledTimes(6);
  });
});
describe("shared server-clock operation window", () => {
  it("uses a half-open server-time interval, lifecycle state and both locks", () => {
    term.status = "OPEN_REGISTRATION";
    const phase = term.phases[0];
    expect(
      operationWindow(term, "REGISTRATION", phase.startDate).canWrite,
    ).toBe(true);
    expect(
      operationWindow(
        term,
        "REGISTRATION",
        new Date(phase.endDate.getTime() - 1),
      ).canWrite,
    ).toBe(true);
    expect(operationWindow(term, "REGISTRATION", phase.endDate).canWrite).toBe(
      false,
    );
    phase.isLocked = true;
    expect(
      operationWindow(term, "REGISTRATION", phase.startDate),
    ).toMatchObject({ locked: true, canWrite: false });
    phase.isLocked = false;
    term.isLocked = true;
    expect(
      operationWindow(term, "REGISTRATION", phase.startDate).reason,
    ).toContain("Đợt đã khóa");
    term.isLocked = false;
    term.status = "DRAFT";
    expect(
      operationWindow(term, "REGISTRATION", phase.startDate).canWrite,
    ).toBe(false);
  });
  it("exposes later phase codes as generic windows without implementing later business", () => {
    term.status = "DEFENDING" as TermStatus;
    const defense = term.phases[5];
    const window = operationWindow(term, "DEFENSE", defense.startDate);
    expect(window).toMatchObject({
      phaseCode: "DEFENSE",
      canWrite: true,
      serverNow: defense.startDate.toISOString(),
    });
  });
});
