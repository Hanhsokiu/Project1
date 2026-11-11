"use strict";
// No AppModule, main, PrismaClient instance, .env loading or connection.
try {
  const { GuidanceModule } = require("../dist/guidance/guidance.module");
  const {
    FinalDefenseController,
  } = require("../dist/guidance/final-defense/final-defense.controller");
  const {
    FinalDefenseService,
  } = require("../dist/guidance/final-defense/final-defense.service");
  const {
    FileStorageService,
  } = require("../dist/common/storage/file-storage.service");
  for (const type of [
    GuidanceModule,
    FinalDefenseController,
    FinalDefenseService,
    FileStorageService,
  ]) {
    if (typeof type !== "function") throw Error("Missing compiled UC17 module");
  }
  console.log(
    "UC17 compiled module loading PASS; no application or database started.",
  );
} catch {
  console.error(
    "UC17 compiled module loading FAIL. Perform a full build without stale incremental caches.",
  );
  process.exitCode = 1;
}
