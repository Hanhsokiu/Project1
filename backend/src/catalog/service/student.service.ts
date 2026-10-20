import { Injectable } from '@nestjs/common';
import { StudentRepository } from '../repository/student.repository';

@Injectable()
export class StudentService {
  constructor(private readonly studentRepo: StudentRepository) {}

  async findAll(params: { page: number; limit: number; search?: string }) {
    return this.studentRepo.findAll(params);
  }
}
