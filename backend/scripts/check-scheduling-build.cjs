"use strict";
// Native compiled DI; no AppModule/.env/server or database.
require("reflect-metadata");
const { Global, Module } = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { ConfigService } = require("@nestjs/config");
const { DefenseModule } = require("../dist/defense/defense.module");
const {
  ScheduleService,
} = require("../dist/defense/scheduling/schedule.service");
const {
  ScheduleRepository,
} = require("../dist/defense/scheduling/schedule.repository");
const {
  CommitteeWorkflowService,
} = require("../dist/defense/committees/committee-workflow.service");
const {
  ReviewerService,
} = require("../dist/defense/reviewers/reviewer.service");
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
      useValue: new ConfigService({ UC21_WRITES_ENABLED: "false" }),
    },
  ],
  exports: [PrismaService, FileStorageService, ConfigService],
})(SyntheticInfrastructure);
(async () => {
  const context = await Test.createTestingModule({
    imports: [SyntheticInfrastructure, DefenseModule],
  }).compile();
  try {
    const s = context.get(ScheduleService);
    if (
      !s ||
      s.repo !== context.get(ScheduleRepository) ||
      s.committees !== context.get(CommitteeWorkflowService) ||
      s.reviewers !== context.get(ReviewerService) ||
      !s.v
    )
      throw Error("Missing DI metadata");
    console.log(
      "UC21 native compiled module/DI PASS; synthetic infrastructure; no server or database connection.",
    );
  } finally {
    await context.close();
  }
})().catch(() => {
  console.error(
    "UC21 native compiled module/DI FAIL; inspect build/providers.",
  );
  process.exitCode = 1;
});
