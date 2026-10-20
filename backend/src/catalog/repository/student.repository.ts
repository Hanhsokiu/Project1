import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;
    const where = search ? {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { studentCode: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: { trainingSystem: true },
      }),
      this.prisma.student.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
