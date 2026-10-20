import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TopicService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTerm(termId: string) {
    return this.prisma.topic.findMany({
      where: { termId },
      include: { researchArea: true, proposals: true },
    });
  }
}
