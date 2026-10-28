import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { EmailOutbox, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { ProposalReviewSession } from "../../topic/proposal-reviews/proposal-review.repository";

// Keep the fields consumed by Step 3; do not return student payloads or leases.
export const outboxStatusSelect = {
  id: true,
  termId: true,
  userId: true,
  subject: true,
  status: true,
  attempts: true,
  lastError: true,
  availableAt: true,
  sentAt: true,
  messageId: true,
  createdAt: true,
} satisfies Prisma.EmailOutboxSelect;

export class NotificationOutboxSession extends ProposalReviewSession {
  constructor(private readonly db: Prisma.TransactionClient) {
    super(db);
  }
  async lockTerm(termId: string) {
    await this.db
      .$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
  }
  async lockOutbox(id: string) {
    await this.db
      .$queryRaw`SELECT id FROM public."EMAIL_OUTBOX" WHERE id=${id} FOR UPDATE`;
  }
  listOutbox(termId: string) {
    return this.db.emailOutbox.findMany({
      where: { termId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: outboxStatusSelect,
    });
  }
  record(id: string) {
    return this.db.emailOutbox.findUnique({
      where: { id },
      select: { id: true, termId: true, status: true },
    });
  }
  async retry(id: string, termId: string) {
    const result = await this.db.emailOutbox.updateMany({
      where: { id, termId, status: "FAILED" },
      data: {
        status: "PENDING",
        attempts: 0,
        availableAt: new Date(),
        lastError: null,
        leaseToken: null,
        lockedAt: null,
      },
    });
    if (result.count !== 1)
      throw new ConflictException(
        "Chỉ gửi lại email thất bại; trạng thái vừa thay đổi.",
      );
    return { id, status: "PENDING" };
  }
}
@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}
  own(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async readAll(userId: string, id?: string) {
    const r = await this.prisma.notification.updateMany({
      where: { userId, ...(id ? { id } : {}) },
      data: { status: "READ", readAt: new Date() },
    });
    if (id && !r.count)
      throw new NotFoundException("Không tìm thấy thông báo của bạn.");
    return { updated: r.count };
  }
  outboxTransaction<T>(
    operation: (
      s: NotificationOutboxSession,
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      (tx) => operation(new NotificationOutboxSession(tx), tx),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10000,
        timeout: 15000,
      },
    );
  }
  async claim(termId?: string) {
    const token = randomUUID();
    const rows = await this.prisma.$queryRaw<EmailOutbox[]>`
      UPDATE "EMAIL_OUTBOX" SET "status"='PROCESSING',"attempts"="attempts"+1,"locked_at"=NOW(),"lease_token"=${token}
      WHERE "id" IN (SELECT "id" FROM "EMAIL_OUTBOX"
        WHERE (("status" IN ('PENDING','FAILED') AND "available_at"<=NOW() AND "attempts"<5)
          OR ("status"='PROCESSING' AND "locked_at"<NOW()-INTERVAL '5 minutes'))
        AND (CAST(${termId ?? null} AS TEXT) IS NULL OR "term_id"=${termId ?? null})
        ORDER BY "created_at" FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING "id"`;
    return rows[0]
      ? this.prisma.emailOutbox.findUniqueOrThrow({ where: { id: rows[0].id } })
      : null;
  }
  sent(row: EmailOutbox, messageId: string) {
    return this.prisma.emailOutbox.updateMany({
      where: { id: row.id, status: "PROCESSING", leaseToken: row.leaseToken },
      data: {
        status: "SENT",
        sentAt: new Date(),
        messageId,
        lastError: null,
        lockedAt: null,
        leaseToken: null,
      },
    });
  }
  failed(row: EmailOutbox, error: string) {
    return this.prisma.emailOutbox.updateMany({
      where: { id: row.id, status: "PROCESSING", leaseToken: row.leaseToken },
      data: {
        status: "FAILED",
        lastError: error.slice(0, 4000),
        availableAt: new Date(
          Date.now() + Math.min(3600000, 1000 * 2 ** row.attempts),
        ),
        lockedAt: null,
        leaseToken: null,
      },
    });
  }
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
