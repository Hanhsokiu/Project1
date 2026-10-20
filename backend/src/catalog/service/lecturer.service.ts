import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LecturerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.lecturer.findMany({
        skip,
        take: limit,
        include: { department: true, title: true },
      }),
      this.prisma.lecturer.count(),
    ]);
    return { data, total, page, limit };
  }
}
