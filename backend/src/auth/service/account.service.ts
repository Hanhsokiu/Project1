import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * UC02: Quản lý tài khoản (CRUD, khóa/mở, đặt lại mật khẩu)
 */
@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;
    const where = search ? {
      OR: [
        { username: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [data, total] = await Promise.all([
      this.prisma.userAccount.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.userAccount.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async lockAccount(userId: string) {
    return this.prisma.userAccount.update({
      where: { id: userId },
      data: { status: 'LOCKED' },
    });
  }

  async unlockAccount(userId: string) {
    return this.prisma.userAccount.update({
      where: { id: userId },
      data: { status: 'ACTIVE', failedLoginCount: 0 },
    });
  }
}
