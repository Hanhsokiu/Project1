"use strict";
// Synthetic native compiled Nest DI only. No AppModule/env/server/database.
require("reflect-metadata");
const { Global, Module } = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { ConfigService } = require("@nestjs/config");
const { DefenseModule } = require("../dist/defense/defense.module");
const {
  ReviewerService,
} = require("../dist/defense/reviewers/reviewer.service");
const {
  ReviewerRepository,
} = require("../dist/defense/reviewers/reviewer.repository");
const {
  CommitteeWorkflowService,
} = require("../dist/defense/committees/committee-workflow.service");
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
      useValue: new ConfigService({ UC20_WRITES_ENABLED: "false" }),
    },
  ],
  exports: [PrismaService, FileStorageService, ConfigService],
})(SyntheticInfrastructure);
(async () => {
  const context = await Test.createTestingModule({
    imports: [SyntheticInfrastructure, DefenseModule],
  }).compile();
  try {
    const service = context.get(ReviewerService);
    if (
      !service ||
      service.repo !== context.get(ReviewerRepository) ||
      service.committees !== context.get(CommitteeWorkflowService) ||
      !service.v ||
      !service.config
    )
      throw Error("Missing compiled DI metadata");
    console.log(
      "UC20 native compiled module/DI PASS; synthetic infrastructure; no server or database connection.",
    );
  } finally {
    await context.close();
  }
})().catch(() => {
  console.error(
    "UC20 native compiled module/DI FAIL; inspect providers/build.",
  );
  process.exitCode = 1;
});
