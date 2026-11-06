import { describe, expect, it, vi } from "vitest";
import { StudentService } from "./student.service";
import { LecturerService } from "./lecturer.service";
import { ImportService } from "./import.service";
import { ImportRowValidator } from "../validator/import-row.validator";

const systemId = "11111111-1111-4111-8111-111111111111";
const studentInput = {
  studentCode: "001234567",
  fullName: "Sinh viên kiểm thử",
  className: "CNTT",
  trainingSystemId: systemId,
  gpa: 3.2,
};
const lecturerInput = {
  lecturerCode: "GV001",
  fullName: "Giảng viên kiểm thử",
  departmentId: systemId,
  researchAreaIds: [systemId],
  maxStudents: 5,
};

describe("catalog only accepts profiles already provisioned by Admin", () => {
  it("rejects an unknown student before writing any catalog or account data", async () => {
    const repo = {
      studentByCode: vi.fn().mockResolvedValue(null),
      saveStudent: vi.fn(),
    };
    await expect(
      new StudentService(repo as never).save(
        undefined,
        studentInput,
        "faculty",
      ),
    ).rejects.toThrow("Sinh viên không tồn tại");
    expect(repo.saveStudent).not.toHaveBeenCalled();
  });
  it("updates an existing student by code without supplying a password or role", async () => {
    const student = {
      ...studentInput,
      id: "student",
      userId: "user",
      user: { email: null },
      termStudents: [],
    };
    const repo = {
      studentByCode: vi.fn().mockResolvedValue(student),
      studentReferences: vi.fn().mockResolvedValue([{ id: systemId }, null]),
      saveStudent: vi.fn().mockResolvedValue(student),
    };
    await expect(
      new StudentService(repo as never).save(
        undefined,
        studentInput,
        "faculty",
      ),
    ).resolves.toMatchObject({ id: "student" });
    expect(repo.saveStudent).toHaveBeenCalledWith(
      "student",
      expect.objectContaining(studentInput),
      "faculty",
    );
  });
  it("rejects an unknown lecturer before writing any catalog or account data", async () => {
    const repo = {
      lecturerByCode: vi.fn().mockResolvedValue(null),
      saveLecturer: vi.fn(),
    };
    await expect(
      new LecturerService(repo as never).save(
        undefined,
        lecturerInput,
        "faculty",
      ),
    ).rejects.toThrow("Giảng viên không tồn tại");
    expect(repo.saveLecturer).not.toHaveBeenCalled();
  });
  it("updates an existing lecturer by code without supplying a password or role", async () => {
    const lecturer = {
      ...lecturerInput,
      id: "lecturer",
      userId: "user",
      user: { email: null },
      researchAreas: [],
    };
    const repo = {
      lecturerByCode: vi.fn().mockResolvedValue(lecturer),
      lecturerReferences: vi
        .fn()
        .mockResolvedValue([{ id: systemId }, null, [{ id: systemId }], null]),
      saveLecturer: vi.fn().mockResolvedValue(lecturer),
    };
    await expect(
      new LecturerService(repo as never).save(
        undefined,
        lecturerInput,
        "faculty",
      ),
    ).resolves.toMatchObject({ id: "lecturer" });
    expect(repo.saveLecturer).toHaveBeenCalledWith(
      "lecturer",
      expect.objectContaining(lecturerInput),
      "faculty",
    );
  });
});

describe("confirmation revalidates legacy import previews", () => {
  function setup(exists: boolean) {
    const row = ImportRowValidator.normalize(
      { ...studentInput, trainingSystemCode: "CQ" },
      2,
      "CQ",
    );
    row.action = "CREATE";
    row.studentId = "stale-profile";
    const job = {
      id: "job",
      type: "STUDENT",
      termId: "term",
      status: "VALIDATED",
      confirmedAt: null,
      rows: [row],
    };
    const unit = {
      job: vi.fn().mockResolvedValue(job),
      context: vi.fn().mockResolvedValue({
        term: {
          trainingSystemId: systemId,
          status: "DRAFT",
          isLocked: false,
          trainingSystem: { id: systemId, code: "CQ", name: "Chính quy" },
          parameters: [],
        },
        students: exists
          ? [
              {
                id: "actual-profile",
                userId: "account",
                studentCode: studentInput.studentCode,
                trainingSystemId: systemId,
                termStudents: [],
              },
            ]
          : [],
        accounts: [],
      }),
      apply: vi.fn().mockResolvedValue("actual-profile"),
      finish: vi.fn().mockImplementation(async (_id, rows) => ({
        ...job,
        rows,
        status: "DONE",
      })),
    };
    const service = new ImportService({
      job: unit.job,
      serializable: async (callback: (tx: typeof unit) => unknown) =>
        callback(unit),
    } as never);
    return { service, unit };
  }
  it.each(["STRICT", "VALID_ONLY"] as const)(
    "revalidates a legacy CREATE preview for a new student in %s mode",
    async (mode) => {
      const { service, unit } = setup(false);
      unit.apply.mockImplementation(async (row) => {
        expect(row.action).toBe("CREATE");
        expect(row.studentId).toBeUndefined();
        return "actual-profile";
      });
      await expect(
        service.confirm("job", mode, "faculty"),
      ).resolves.toMatchObject({
        status: "DONE",
      });
      expect(unit.apply).toHaveBeenCalledTimes(1);
      expect(unit.apply).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE",
          errors: [],
          values: expect.objectContaining({
            studentCode: studentInput.studentCode,
          }),
        }),
        "term",
        systemId,
      );
      expect(unit.finish).toHaveBeenCalledWith(
        "job",
        [
          expect.objectContaining({
            status: "IMPORTED",
            studentId: "actual-profile",
          }),
        ],
        mode,
        "faculty",
      );
    },
  );
  it.each(["STRICT", "VALID_ONLY"] as const)(
    "rejects a legacy CREATE preview when its code now belongs to another account in %s mode",
    async (mode) => {
      const { service, unit } = setup(false);
      const context = await unit.context();
      unit.context.mockResolvedValue({
        ...context,
        accounts: [
          {
            id: "other-account",
            username: studentInput.studentCode,
            email: null,
          },
        ],
      } as never);
      await expect(service.confirm("job", mode, "faculty")).rejects.toThrow();
      expect(unit.apply).not.toHaveBeenCalled();
      expect(unit.finish).not.toHaveBeenCalled();
    },
  );
  it("uses the current existing profile rather than a stale preview identifier", async () => {
    const { service, unit } = setup(true);
    await service.confirm("job", "STRICT", "faculty");
    expect(unit.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        studentId: "actual-profile",
      }),
      "term",
      systemId,
    );
  });
});
