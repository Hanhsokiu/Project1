import { Module } from "@nestjs/common";
import { StudentController } from "./controller/student.controller";
import { LecturerController } from "./controller/lecturer.controller";
import { StudentService } from "./service/student.service";
import { LecturerService } from "./service/lecturer.service";
import { ImportService } from "./service/import.service";
import { StudentRepository } from "./repository/student.repository";
import { CatalogRepository } from "./repository/catalog.repository";
import { ImportRepository } from "./repository/import.repository";
import { ReferenceService } from "./service/reference.service";
import { ReferenceController } from "./controller/reference.controller";
import { ImportController } from "./controller/import.controller";
import { LecturerImportController } from "./controller/lecturer-import.controller";
import { LecturerImportService } from "./service/lecturer-import.service";

@Module({
  controllers: [
    LecturerImportController,
    StudentController,
    LecturerController,
    ReferenceController,
    ImportController,
  ],
  providers: [
    LecturerImportService,
    StudentService,
    LecturerService,
    ImportService,
    StudentRepository,
    CatalogRepository,
    ImportRepository,
    ReferenceService,
  ],
  exports: [StudentService, LecturerService],
})
export class CatalogModule {}
