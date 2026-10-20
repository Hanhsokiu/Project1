import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ScoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getScoresByProposal(proposalId: string) {
    return this.prisma.scoreEntry.findMany({
      where: { proposalId },
      include: { scoreDetails: true },
    });
  }
}
