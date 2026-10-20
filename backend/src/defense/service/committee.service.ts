import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommitteeService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTerm(termId: string) {
    return this.prisma.defenseCommittee.findMany({
      where: { termId },
      include: {
        members: { include: { lecturer: true } },
        defenseSessions: { include: { room: true } },
      },
    });
  }
}
