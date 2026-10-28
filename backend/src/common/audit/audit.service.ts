import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    params: {
      userId?: string;
      action: string;
      resource: string;
      resourceId?: string;
      oldValue?: object;
      newValue?: object;
      ipAddress?: string;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction || this.prisma).auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        oldValue: params.oldValue,
        newValue: params.newValue,
        ipAddress: params.ipAddress,
      },
    });
  }
}
