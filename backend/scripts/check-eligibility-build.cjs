"use strict";
// Native compiled Nest DI only. No AppModule/main/.env/PrismaClient instance/server/DB.
require("reflect-metadata");
const { Global, Module } = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { ConfigService } = require("@nestjs/config");
const { DefenseModule } = require("../dist/defense/defense.module");
const {
  EligibilityService,
} = require("../dist/defense/eligibility/eligibility.service");
const {
  EligibilityRepository,
} = require("../dist/defense/eligibility/eligibility.repository");
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
      useValue: new ConfigService({ UC18_WRITES_ENABLED: "false" }),
    },
  ],
  exports: [PrismaService, FileStorageService, ConfigService],
})(SyntheticInfrastructure);
(async () => {
  const context = await Test.createTestingModule({
    imports: [SyntheticInfrastructure, DefenseModule],
  }).compile();
  try {
    const service = context.get(EligibilityService);
    if (
      !service ||
      service.repo !== context.get(EligibilityRepository) ||
      !service.guidance ||
      !service.config ||
      !service.storage
    )
      throw Error("Missing compiled DI metadata");
    console.log(
      "UC18 native compiled module/DI PASS; synthetic infrastructure; no server or DB connection.",
    );
  } finally {
    await context.close();
  }
})().catch(() => {
  console.error(
    "UC18 native compiled module/DI FAIL. Check full build and provider wiring.",
  );
  process.exitCode = 1;
});
