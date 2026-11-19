"use strict";
// Native compiled Nest DI only; no AppModule, environment, server or database.
require("reflect-metadata");
const { Global, Module } = require("@nestjs/common"),
  { Test } = require("@nestjs/testing"),
  { ConfigService } = require("@nestjs/config");
const { DefenseModule } = require("../dist/defense/defense.module");
const {
  FinalResultService,
} = require("../dist/defense/final-results/final-result.service");
const {
  FinalResultRepository,
} = require("../dist/defense/final-results/final-result.repository");
const {
  CommitteeWorkflowService,
} = require("../dist/defense/committees/committee-workflow.service");
const {
  ScheduleService,
} = require("../dist/defense/scheduling/schedule.service");
const {
  ReviewerService,
} = require("../dist/defense/reviewers/reviewer.service");
const { PrismaService } = require("../dist/prisma/prisma.service"),
  {
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
      useValue: new ConfigService({ UC24_WRITES_ENABLED: "false" }),
    },
  ],
  exports: [PrismaService, FileStorageService, ConfigService],
})(SyntheticInfrastructure);
(async () => {
  const context = await Test.createTestingModule({
    imports: [SyntheticInfrastructure, DefenseModule],
  }).compile();
  try {
    const s = context.get(FinalResultService);
    if (
      !s ||
      s.repo !== context.get(FinalResultRepository) ||
      !s.sources ||
      !s.roles
    )
      throw Error("Missing native DI metadata");
    console.log(
      "UC24 native compiled module/DI PASS; synthetic infrastructure, no server/database.",
    );
  } finally {
    await context.close();
  }
})().catch(() => {
  console.error("UC24 native module/DI FAIL; inspect build/providers.");
  process.exitCode = 1;
});
