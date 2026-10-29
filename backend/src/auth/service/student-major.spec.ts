import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import { ProfileSchema } from "../dto/auth.dto";
import { UserAccountRepository } from "../repository/user-account.repository";
import type { PrismaService } from "../../prisma/prisma.service";

describe("student major source", () => {
  it("validates an explicitly entered major without guessing or allowing another student id", () => {
    expect(
      ProfileSchema.parse({
        name: "Sinh viên",
        majorName: " Công nghệ thông tin ",
      }).majorName,
    ).toBe("Công nghệ thông tin");
    for (const extra of [
      { majorName: " " },
      { majorName: "a".repeat(201) },
      { majorName: "CNTT", studentId: "other" },
    ])
      expect(
        ProfileSchema.safeParse({ name: "Sinh viên", ...extra }).success,
      ).toBe(false);
  });
  it("rejects a nonstudent changing a student-only field before writes", async () => {
    const users = {
      findById: vi
        .fn()
        .mockResolvedValue({
          student: null,
          userRoles: [{ role: { name: "LECTURER" } }],
        }),
      updateProfile: vi.fn(),
    };
    const service = new AuthService(
      users as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.updateProfile("lecturer", {
        name: "Giảng viên",
        majorName: "CNTT",
      }),
    ).rejects.toThrow("Chỉ sinh viên");
    expect(users.updateProfile).not.toHaveBeenCalled();
  });
  it("writes only the authenticated student's source without changing a confirmed print snapshot", async () => {
    const tx = {
      userAccount: { update: vi.fn() },
      student: { updateMany: vi.fn() },
      lecturer: { updateMany: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    };
    const repository = new UserAccountRepository(
      prisma as unknown as PrismaService,
    );
    await repository.updateProfile("owner", {
      name: "Sinh viên",
      majorName: "Khoa học máy tính",
    });
    expect(tx.student.updateMany).toHaveBeenCalledWith({
      where: { userId: "owner" },
      data: { fullName: "Sinh viên", majorName: "Khoa học máy tính" },
    });
    expect(tx.lecturer.updateMany.mock.calls[0][0].data).not.toHaveProperty(
      "majorName",
    );
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it("keeps student major in account creation and preserves the old value when omitted on update", async () => {
    const tx = {
      role: { findMany: vi.fn().mockResolvedValue([]) },
      userAccount: {
        create: vi.fn().mockResolvedValue({ id: "account" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ username: "221000009" }),
        update: vi.fn().mockResolvedValue({}),
      },
      student: {
        findUnique: vi.fn().mockResolvedValue({ trainingSystemId: "system" }),
        upsert: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };
    const repository = new UserAccountRepository({
      $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
    } as unknown as PrismaService);
    await repository.createAccount({
      username: "221000009",
      displayName: "Sinh viên",
      roles: ["STUDENT"],
      passwordHash: "test-only-hash",
      trainingSystemId: "system",
      majorName: "Công nghệ thông tin",
    });
    expect(
      tx.userAccount.create.mock.calls[0][0].data.student.create.majorName,
    ).toBe("Công nghệ thông tin");
    await repository.updateAccount("owner", { trainingSystemId: "system" });
    expect(tx.student.upsert.mock.calls[0][0].update.majorName).toBeUndefined();
  });
});
