"use strict";
// Read-only diagnostics for the database used by the backend. No repair/seed/DDL.
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { runtimeDatabaseUrl } = require("../dist/prisma/connection-url");
const {
  GuidanceSession,
} = require("../dist/guidance/tasks/guidance.repository");
const env = {};
const file = path.resolve(__dirname, "../.env");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: runtimeDatabaseUrl(process.env.DATABASE_URL || env.DATABASE_URL),
    },
  },
});
async function main() {
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const terms = await tx.thesisTerm.findMany({
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            phases: { select: { id: true, code: true } },
          },
        });
        const links = await tx.termPhaseWorkflow.findMany({
          where: { key: "GUIDANCE" },
          select: { termId: true, phaseId: true },
        });
        const guidance = new GuidanceSession(tx);
        const phases = await Promise.all(
          terms.map(async (term) => {
            const weekly = term.phases.filter((p) => p.code === "WEEKLY");
            const link = links.find((l) => l.termId === term.id);
            const resolved = await guidance.guidancePhase(term.id);
            return {
              id: term.id,
              code: term.code,
              name: term.name,
              resolvedPhaseId: resolved?.phaseId ?? null,
              guidancePhase: link
                ? weekly.length && weekly[0].id !== link.phaseId
                  ? "MAPPING_DIFFERS_FROM_WEEKLY"
                  : "LINKED"
                : weekly.length === 1
                  ? "CANONICAL_WEEKLY_FALLBACK"
                  : weekly.length
                    ? "MULTIPLE_WEEKLY_PHASES"
                    : "NOT_CONFIGURED",
            };
          }),
        );
        const counts = {};
        for (const model of [
          "userAccount",
          "student",
          "lecturer",
          "termStudent",
          "proposal",
          "guidancePlan",
          "guidancePeriod",
          "task",
          "taskSubmission",
          "progressReview",
        ])
          counts[model] = await tx[model].count();
        return { readOnly: true, terms: phases, counts };
      },
      { timeout: 30000, maxWait: 10000, isolationLevel: "RepeatableRead" },
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    "Read-only consistency check failed: " +
      (error.code || error.errorCode || "DATABASE_UNAVAILABLE"),
  );
  process.exitCode = 1;
});
