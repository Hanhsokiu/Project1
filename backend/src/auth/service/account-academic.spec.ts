import { describe, expect, it, vi } from "vitest";
import { AccountService } from "./account.service";
import { UserAccountRepository } from "../repository/user-account.repository";
import type { PrismaService } from "../../prisma/prisma.service";
const departmentId = "00000000-0000-4000-8000-000000000001";
const areaId = "00000000-0000-4000-8000-000000000002";
function setup() {
  const users = {
    department: vi.fn().mockResolvedValue({ id: departmentId }),
    researchAreas: vi.fn().mockResolvedValue([{ id: areaId }]),
  };
  const service = new AccountService(users as never);
  return {
    users,
    service,
    validate: (roles: string[], input: object, current?: never) =>
      (
        service as unknown as {
          lecturerProfile: (
            roles: string[],
            data: object,
            current?: never,
          ) => Promise<unknown>;
        }
      ).lecturerProfile(roles, input, current),
  };
}
describe("account academic profile validation", () => {
  it("requires lecturer department and real nonduplicate specialties before any writes", async () => {
    const { validate, users } = setup();
    await expect(validate(["LECTURER"], {})).rejects.toThrow("bộ môn");
    await expect(
      validate(["LECTURER"], { departmentId, researchAreaIds: [] }),
    ).rejects.toThrow("ít nhất");
    await expect(
      validate(["LECTURER"], {
        departmentId,
        researchAreaIds: [areaId, areaId],
      }),
    ).rejects.toThrow("trùng");
    users.researchAreas.mockResolvedValue([]);
    await expect(
      validate(["LECTURER"], { departmentId, researchAreaIds: [areaId] }),
    ).rejects.toThrow("không tồn tại");
  });
  it("preserves the existing profile when changing unrelated lecturer account details", async () => {
    const { validate } = setup();
    await expect(
      validate(["LECTURER"], {}, {
        departmentId,
        maxStudents: 7,
        researchAreas: [{ researchAreaId: areaId }],
      } as never),
    ).resolves.toEqual({
      departmentId,
      maxStudents: 7,
      researchAreaIds: [areaId],
    });
    await expect(
      validate(["LECTURER"], {
        departmentId,
        researchAreaIds: [areaId],
        maxStudents: 1.5,
      }),
    ).rejects.toThrow("số nguyên");
    await expect(validate(["FACULTY"], { departmentId })).rejects.toThrow(
      "chỉ dành",
    );
  });
  it("stores the student class and lecturer specialties inside the same account creation transaction", async () => {
    const tx = {
      role: { findMany: vi.fn().mockResolvedValue([]) },
      userAccount: { create: vi.fn().mockResolvedValue({ id: "new" }) },
      auditLog: { create: vi.fn() },
    };
    const transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx));
    const repo = new UserAccountRepository({
      $transaction: transaction,
    } as unknown as PrismaService);
    await repo.createAccount({
      username: "both",
      displayName: "Hồ sơ kép",
      passwordHash: "test-only",
      roles: ["STUDENT", "LECTURER"],
      trainingSystemId: "system",
      className: "CNPM-01",
      departmentId,
      researchAreaIds: [areaId],
      maxStudents: 7,
    });
    const data = tx.userAccount.create.mock.calls[0][0].data;
    expect(data.student.create).toMatchObject({
      className: "CNPM-01",
      trainingSystemId: "system",
    });
    expect(data.lecturer.create).toMatchObject({
      departmentId,
      maxStudents: 7,
      researchAreas: { create: [{ researchAreaId: areaId }] },
    });
    expect(transaction).toHaveBeenCalledOnce();
  });
  it("updates lecturer profile and replaces specialties without touching other lecturer rows", async () => {
    const tx = {
      userAccount: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ username: "gv" }),
        update: vi.fn().mockResolvedValue({}),
      },
      lecturer: { upsert: vi.fn().mockResolvedValue({ id: "own-lecturer" }) },
      lecturerArea: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    const repo = new UserAccountRepository({
      $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
    } as unknown as PrismaService);
    await repo.updateAccount("account", {
      departmentId,
      researchAreaIds: [areaId],
      maxStudents: 3,
    });
    expect(tx.lecturer.upsert.mock.calls[0][0].where).toEqual({
      userId: "account",
    });
    expect(tx.lecturerArea.deleteMany).toHaveBeenCalledWith({
      where: { lecturerId: "own-lecturer" },
    });
    expect(tx.lecturerArea.createMany).toHaveBeenCalledWith({
      data: [{ lecturerId: "own-lecturer", researchAreaId: areaId }],
    });
  });
});
