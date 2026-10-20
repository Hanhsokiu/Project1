import { Module } from '@nestjs/common';
import { StudentController } from './controller/student.controller';
import { LecturerController } from './controller/lecturer.controller';
import { StudentService } from './service/student.service';
import { LecturerService } from './service/lecturer.service';
import { ImportService } from './service/import.service';
import { StudentRepository } from './repository/student.repository';

@Module({
  controllers: [StudentController, LecturerController],
  providers: [StudentService, LecturerService, ImportService, StudentRepository],
  exports: [StudentService, LecturerService],
})
export class CatalogModule {}
