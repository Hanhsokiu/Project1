"use strict";
// Native compiled Nest DI only; never imports AppModule or loads environment/DB.
require("reflect-metadata");
const { Global, Module } = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { ConfigService } = require("@nestjs/config");
const { DefenseModule } = require("../dist/defense/defense.module");
const {
  ReviewerGradeService,
} = require("../dist/defense/reviewer-grading/reviewer-grade.service");
const {
  ReviewerGradeRepository,
} = require("../dist/defense/reviewer-grading/reviewer-grade.repository");
const {
  ReviewerService,
} = require("../dist/defense/reviewers/reviewer.service");
const {
  ScheduleService,
} = require("../dist/defense/scheduling/schedule.service");
const { PrismaService } = require("../dist/prisma/prisma.service");
const {
  FileStorageService,
} = require("../dist/common/storage/file-storage.service");
class SyntheticInfrastructure {}
Global()(SyntheticInfrastructure);
Module({
  providers: [
    { provide: PrismaService, useValue: Object.freeze({}) },
    { provide: FileStorageService, useValue: Object.freeze({}) },
    {
      provide: ConfigService,
      useValue: new ConfigService({ UC22_WRITES_ENABLED: "false" }),
    },
  ],
  exports: [PrismaService, FileStorageService, ConfigService],
})(SyntheticInfrastructure);
(async () => {
  const context = await Test.createTestingModule({
    imports: [SyntheticInfrastructure, DefenseModule],
  }).compile();
  try {
    const s = context.get(ReviewerGradeService);
    if (
      !s ||
      s.repo !== context.get(ReviewerGradeRepository) ||
      s.reviewers !== context.get(ReviewerService) ||
      s.schedules !== context.get(ScheduleService) ||
      s.storage !== context.get(FileStorageService) ||
      !s.v
    )
      throw Error("Missing native DI metadata");
    console.log(
      "UC22 native compiled module/DI PASS; synthetic infrastructure, no server/database.",
    );
  } finally {
    await context.close();
  }
})().catch(() => {
  console.error("UC22 native module/DI FAIL; inspect build/providers.");
  process.exitCode = 1;
});
