import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ProposalReviewSession } from "../../topic/proposal-reviews/proposal-review.repository";
@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async principal(userId: string) {
    return new ProposalReviewSession(this.prisma).principal(userId);
  }
  legacy(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
  async list(userId: string, page: number, limit: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.notification.count({ where: { userId } }),
          data = await tx.notification.findMany({
            where: { userId },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          });
        return {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async read(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: { id, userId, status: "UNREAD" },
        data: { status: "READ", readAt: new Date() },
      });
      return tx.notification.findFirst({ where: { id, userId } });
    });
  }
}
