import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async processStudentImport(jobId: string, rows: any[]) {
    // Process student rows from Excel parser
    return { success: true, count: rows.length };
  }
}
