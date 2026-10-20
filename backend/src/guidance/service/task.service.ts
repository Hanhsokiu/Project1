import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPlan(guidancePlanId: string) {
    return this.prisma.task.findMany({
      where: { guidancePlanId },
      include: { submissions: true },
      orderBy: { deadline: 'asc' },
    });
  }
}
