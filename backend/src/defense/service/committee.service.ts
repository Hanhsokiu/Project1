import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CommitteeService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTerm(termId: string, allowedIds: string[]) {
    const columns = await this.prisma.$queryRaw<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DEFENSE_SESSION' AND column_name='revision'`;
    return this.prisma.defenseCommittee.findMany({
      where: { termId, id: { in: allowedIds } },
      select: {
        id: true,
        termId: true,
        name: true,
        createdAt: true,
        members: {
          include: {
            lecturer: {
              select: {
                id: true,
                lecturerCode: true,
                fullName: true,
                departmentId: true,
              },
            },
          },
        },
        // UC21 drafts/publication must only be disclosed by its scoped API.
        // Keep this projection usable while additive UC21 columns are absent.
        defenseSessions: {
          where: columns.length ? { revision: 0 } : undefined,
          select: {
            id: true,
            committeeId: true,
            roomId: true,
            scheduledAt: true,
            durationMin: true,
            createdAt: true,
            room: true,
          },
        },
      },
    });
  }
}
