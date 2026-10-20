import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneralStats() {
    const [terms, students, lecturers, proposals] = await Promise.all([
      this.prisma.thesisTerm.count(),
      this.prisma.student.count(),
      this.prisma.lecturer.count(),
      this.prisma.proposal.count(),
    ]);

    return { terms, students, lecturers, proposals };
  }
}
