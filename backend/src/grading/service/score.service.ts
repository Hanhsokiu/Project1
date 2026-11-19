import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ScoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getScoresByProposal(proposalId: string) {
    return this.prisma.scoreEntry.findMany({
      // Legacy grading has no proposal scope check. Academic grade components use
      // their scoped UC17/UC22/UC23 readers and independent content permissions, including
      // when this endpoint is called directly outside the new UI.
      where: {
        proposalId,
        role: {
          notIn: ["ADVISOR", "REVIEWER", "COMMITTEE_MEMBER", "COMMITTEE_CHAIR"],
        },
      },
      // Preserve the pre-UC17 response and baseline-schema compatibility while
      // the additive final-defense migration is still under review.
      select: {
        id: true,
        proposalId: true,
        scorerId: true,
        role: true,
        totalScore: true,
        isLocked: true,
        createdAt: true,
        updatedAt: true,
        scoreDetails: true,
      },
    });
  }
}
