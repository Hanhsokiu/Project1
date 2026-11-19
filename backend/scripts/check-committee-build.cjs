"use strict";
// Native compiled Nest DI with synthetic infrastructure. No .env/AppModule/server/DB.
require("reflect-metadata");
const { Global, Module } = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { ConfigService } = require("@nestjs/config");
const { DefenseModule } = require("../dist/defense/defense.module");
const {
  CommitteeWorkflowService,
} = require("../dist/defense/committees/committee-workflow.service");
const {
  CommitteeRepository,
} = require("../dist/defense/committees/committee.repository");
const {
  EligibilityService,
} = require("../dist/defense/eligibility/eligibility.service");
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
      useValue: new ConfigService({ UC19_WRITES_ENABLED: "false" }),
    },
  ],
  exports: [PrismaService, FileStorageService, ConfigService],
})(SyntheticInfrastructure);
(async () => {
  const context = await Test.createTestingModule({
    imports: [SyntheticInfrastructure, DefenseModule],
  }).compile();
  try {
    const service = context.get(CommitteeWorkflowService);
    if (
      !service ||
      service.repo !== context.get(CommitteeRepository) ||
      service.eligibility !== context.get(EligibilityService) ||
      !service.config ||
      !service.v
    )
      throw Error("Missing native DI metadata");
    console.log(
      "UC19 native compiled module/DI PASS; no server or database connection.",
    );
  } finally {
    await context.close();
  }
})().catch(() => {
  console.error(
    "UC19 native compiled module/DI FAIL; check full build/providers.",
  );
  process.exitCode = 1;
});
