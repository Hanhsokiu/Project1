import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.userAccount.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.userAccount.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.userAccount.findUnique({ where: { id } });
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
  }) {
    return this.prisma.userAccount.create({ data });
  }

  async updateFailedLogin(id: string, count: number) {
    return this.prisma.userAccount.update({
      where: { id },
      data: {
        failedLoginCount: count,
        status: count >= 5 ? 'LOCKED' : undefined,
      },
    });
  }

  async resetFailedLogin(id: string) {
    return this.prisma.userAccount.update({
      where: { id },
      data: { failedLoginCount: 0, lastLoginAt: new Date() },
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return this.prisma.userAccount.update({
      where: { id },
      data: { passwordHash, mustChangePassword: false },
    });
  }
}
