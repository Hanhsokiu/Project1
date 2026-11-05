import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ProgressSession } from "../reviews/progress-review.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
export class WeeklySession extends ProgressSession {
  constructor(readonly weeklyDb: Prisma.TransactionClient) {
    super(weeklyDb);
  }
}
@Injectable()
export class WeeklyRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    work: (s: WeeklySession) => Promise<T>,
    mutation = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => work(new WeeklySession(tx)),
          {
            isolationLevel: mutation ? "Serializable" : "RepeatableRead",
            maxWait: 10000,
            timeout: 30000,
          },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (["P2034", "P2002"].includes(e.code) ||
            (e.code === "P2010" &&
              ["40001", "40P01"].includes(String(e.meta?.code))))
        ) {
          if (attempt < 2) continue;
          groupError(
            409,
            "REVISION_CONFLICT",
            "Dữ liệu hoặc số tuần đã tồn tại/thay đổi. Hãy tải lại.",
          );
        }
        throw e;
      }
    }
  }
}
