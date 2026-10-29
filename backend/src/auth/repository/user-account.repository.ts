import { ConflictException, Injectable } from "@nestjs/common";
import type { LoginSession, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { identityInclude } from "../mapper/account.mapper";
import type { Identity } from "../mapper/account.mapper";
import { inFlightRead } from "./in-flight-read";
@Injectable()
export class UserAccountRepository {
  private readonly identityReads = new Map<string, Promise<Identity | null>>();
  private readonly sessionReads = new Map<string, Promise<LoginSession | null>>();
  constructor(private readonly prisma: PrismaService) {}
  // Retain the foundation repository contract for existing consumers.
  create(data: { username: string; email: string; passwordHash: string }) {
    return this.prisma.userAccount.create({ data });
  }
  findByUsername(username: string) {
    return this.prisma.userAccount.findUnique({
      where: { username },
      include: identityInclude,
    });
  }
  findById(id: string) {
    return inFlightRead(this.identityReads, id, () => this.prisma.userAccount.findUnique({
      where: { id },
      include: identityInclude,
    }));
  }
  findByEmail(email: string) {
    return this.prisma.userAccount.findUnique({ where: { email } });
  }
  trainingSystem(id: string) {
    return this.prisma.trainingSystem.findUnique({ where: { id } });
  }
  async failLogin(id: string) {
    const user = await this.prisma.userAccount.update({
      where: { id },
      data: { failedLoginCount: { increment: 1 } },
    });
    if (user.failedLoginCount >= 5)
      await this.prisma.userAccount.update({
        where: { id },
        data: { status: "LOCKED" },
      });
  }
  resetFailedLogin(id: string) {
    return this.prisma.userAccount.update({
      where: { id },
      data: { failedLoginCount: 0, lastLoginAt: new Date() },
    });
  }
  createSession(data: {
    id: string;
    userId: string;
    refreshToken: string;
    expiresAt: Date;
  }) {
    return this.prisma.loginSession.create({ data });
  }
  session(id: string) {
    return inFlightRead(this.sessionReads, id, () =>
      this.prisma.loginSession.findUnique({ where: { id } }),
    );
  }
  revokeSession(id: string, userId: string) {
    return this.prisma.loginSession.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  rotateSession(id: string, hash: string) {
    return this.prisma.loginSession.update({
      where: { id },
      data: { refreshToken: hash },
    });
  }
  updatePassword(id: string, passwordHash: string, sid?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { id },
        data: { passwordHash, mustChangePassword: false, failedLoginCount: 0 },
      });
      await tx.loginSession.updateMany({
        where: { userId: id, ...(sid ? { id: { not: sid } } : {}) },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: id,
          action: "AUTH_PASSWORD_CHANGED",
          resource: "account",
          resourceId: id,
        },
      });
    });
  }
  updateProfile(
    id: string,
    data: { name: string; email?: string | null; phone?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { id },
        data: {
          displayName: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
        },
      });
      await tx.student.updateMany({
        where: { userId: id },
        data: {
          fullName: data.name,
          ...(data.phone ? { phone: data.phone } : {}),
        },
      });
      await tx.lecturer.updateMany({
        where: { userId: id },
        data: {
          fullName: data.name,
          ...(data.phone ? { phone: data.phone } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: id,
          resource: "account",
          resourceId: id,
          action: "PROFILE_UPDATED",
        },
      });
    });
  }
  permissions(id: string) {
    return this.findById(id).then(
      (u) =>
        u?.userRoles.flatMap((r) =>
          r.role.rolePermissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ),
        ) || [],
    );
  }
  list(page: number, pageSize: number, search?: string) {
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};
    return Promise.all([
      this.prisma.userAccount.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: identityInclude,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.userAccount.count({ where }),
    ]);
  }
  setStatus(id: string, status: "ACTIVE" | "LOCKED") {
    return this.prisma.userAccount.update({
      where: { id },
      data: { status, failedLoginCount: 0 },
      include: identityInclude,
    });
  }
  async createAccount(data: {
    username: string;
    displayName: string;
    email?: string | null;
    phone?: string | null;
    passwordHash: string;
    roles: string[];
    trainingSystemId?: string;
    actorId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const roleRecords = await tx.role.findMany({
        where: { name: { in: data.roles } },
      });
      const user = await tx.userAccount.create({
        data: {
          username: data.username,
          displayName: data.displayName,
          email: data.email || null,
          phone: data.phone || null,
          passwordHash: data.passwordHash,
          status: "ACTIVE",
          mustChangePassword: true,
          ...(data.trainingSystemId
            ? {
                student: {
                  create: {
                    studentCode: data.username,
                    fullName: data.displayName,
                    trainingSystemId: data.trainingSystemId,
                    phone: data.phone || null,
                    academicEligible: false,
                  },
                },
              }
            : {}),
          userRoles: {
            create: roleRecords.map((r) => ({ roleId: r.id })),
          },
        },
        include: identityInclude,
      });
      if (data.actorId) {
        await tx.auditLog.create({
          data: {
            userId: data.actorId,
            action: "ACCOUNT_CREATED",
            resource: "account",
            resourceId: user.id,
          },
        });
      }
      return user;
    });
  }
  async updateAccount(
    id: string,
    data: {
      displayName?: string;
      email?: string | null;
      phone?: string | null;
      passwordHash?: string;
      roles?: string[];
      trainingSystemId?: string;
      actorId?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.trainingSystemId) {
        const existing = await tx.userAccount.findUniqueOrThrow({
          where: { id },
        });
        const student = await tx.student.findUnique({ where: { userId: id } });
        if (
          student &&
          student.trainingSystemId !== data.trainingSystemId &&
          (await tx.termStudent.count({
            where: {
              studentId: student.id,
              term: {
                OR: [
                  { trainingSystemId: { not: data.trainingSystemId } },
                  { trainingSystemId: null },
                ],
              },
            },
          }))
        )
          throw new ConflictException(
            "SV đang thuộc đợt khác hệ; cần xử lý danh sách tham gia trước.",
          );
        await tx.student.upsert({
          where: { userId: id },
          create: {
            userId: id,
            studentCode: existing.username,
            fullName:
              data.displayName ?? existing.displayName ?? existing.username,
            trainingSystemId: data.trainingSystemId,
            phone: data.phone ?? existing.phone,
            academicEligible: false,
          },
          update: { trainingSystemId: data.trainingSystemId },
        });
      }
      if (data.displayName !== undefined || data.phone !== undefined)
        await tx.student.updateMany({
          where: { userId: id },
          data: { fullName: data.displayName, phone: data.phone },
        });
      if (data.roles) {
        const roleRecords = await tx.role.findMany({
          where: { name: { in: data.roles } },
        });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: roleRecords.map((r) => ({ userId: id, roleId: r.id })),
        });
      }
      const updateData: Prisma.UserAccountUpdateInput = {};
      if (data.displayName !== undefined)
        updateData.displayName = data.displayName;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.passwordHash) updateData.passwordHash = data.passwordHash;

      const user = await tx.userAccount.update({
        where: { id },
        data: updateData,
        include: identityInclude,
      });
      if (data.actorId) {
        await tx.auditLog.create({
          data: {
            userId: data.actorId,
            action: "ACCOUNT_UPDATED",
            resource: "account",
            resourceId: user.id,
          },
        });
      }
      return user;
    });
  }
  async resetPassword(id: string, passwordHash: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginCount: 0,
        },
        include: identityInclude,
      });
      await tx.loginSession.updateMany({
        where: { userId: id },
        data: { revokedAt: new Date() },
      });
      if (actorId) {
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "ACCOUNT_PASSWORD_RESET",
            resource: "account",
            resourceId: id,
          },
        });
      }
      return user;
    });
  }
}
