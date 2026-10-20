import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTerm(termId: string) {
    return this.prisma.registration.findMany({
      where: { termId },
      include: {
        student: true,
        preferences: true,
        advisorAssignment: { include: { advisor: true } },
      },
    });
  }
}
