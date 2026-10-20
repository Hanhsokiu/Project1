import { Injectable } from '@nestjs/common';
import { TermStatus } from '@prisma/client';

@Injectable()
export class TermTransitionValidator {
  private readonly allowedTransitions: Record<string, string[]> = {
    DRAFT: ['OPEN_REGISTRATION', 'CANCELLED'],
    OPEN_REGISTRATION: ['CLOSED_REGISTRATION', 'CANCELLED'],
    CLOSED_REGISTRATION: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['DEFENDING', 'CANCELLED'],
    DEFENDING: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  canTransition(from: TermStatus, to: TermStatus): boolean {
    return this.allowedTransitions[from]?.includes(to) ?? false;
  }
}
