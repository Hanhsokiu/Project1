import { describe, expect, it, vi } from "vitest";
import { ScoreService } from "./score.service";
import type { PrismaService } from "../../prisma/prisma.service";

describe("legacy score endpoint UC17 disclosure boundary", () => {
  it("excludes advisor scores and does not select additive fields before migration", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new ScoreService({
      scoreEntry: { findMany },
    } as unknown as PrismaService);
    await service.getScoresByProposal("synthetic-proposal");
    expect(findMany).toHaveBeenCalledWith({
      where: {
        proposalId: "synthetic-proposal",
        role: {
          notIn: ["ADVISOR", "REVIEWER", "COMMITTEE_MEMBER", "COMMITTEE_CHAIR"],
        },
      },
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
  });
});
