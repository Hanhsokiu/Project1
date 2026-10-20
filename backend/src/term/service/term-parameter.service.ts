import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TermParameterService {
  constructor(private readonly prisma: PrismaService) {}

  async getParameters(termId: string) {
    return this.prisma.termParameter.findMany({ where: { termId } });
  }
}
