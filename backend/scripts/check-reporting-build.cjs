"use strict";
// Native compiled Nest DI only; no AppModule, environment, server or database.
require("reflect-metadata");
const { Global, Module } = require("@nestjs/common"),
  { Test } = require("@nestjs/testing"),
  { ConfigService } = require("@nestjs/config");
const { ReportModule } = require("../dist/report/report.module");
const {
  ReportService,
} = require("../dist/report/defense-reporting/report.service");
const {
  ReportRepository,
} = require("../dist/report/defense-reporting/report.repository");
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
      useValue: new ConfigService({ UC25_WRITES_ENABLED: "false" }),
    },
  ],
  exports: [PrismaService, FileStorageService, ConfigService],
})(SyntheticInfrastructure);
(async () => {
  const context = await Test.createTestingModule({
    imports: [SyntheticInfrastructure, ReportModule],
  }).compile();
  try {
    const s = context.get(ReportService);
    if (
      !s ||
      s.repo !== context.get(ReportRepository) ||
      !s.reader ||
      !s.renderer ||
      !s.templates
    )
      throw Error("Missing native DI metadata");
    console.log(
      "UC25 native compiled module/DI PASS; synthetic infrastructure, no server/database.",
    );
  } finally {
    await context.close();
  }
})().catch(() => {
  console.error("UC25 native module/DI FAIL; inspect build/providers.");
  process.exitCode = 1;
});
