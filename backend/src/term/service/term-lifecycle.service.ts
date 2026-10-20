import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TermTransitionValidator } from '../validator/term-transition.validator';

@Injectable()
export class TermLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TermTransitionValidator,
  ) {}

  async findAll() {
    return this.prisma.thesisTerm.findMany({
      orderBy: { createdAt: 'desc' },
      include: { phases: true, parameters: true },
    });
  }

  async findById(id: string) {
    const term = await this.prisma.thesisTerm.findUnique({
      where: { id },
      include: { phases: true, parameters: true, termLecturers: true },
    });
    if (!term) throw new NotFoundException('Không tìm thấy đợt đồ án');
    return term;
  }
}
