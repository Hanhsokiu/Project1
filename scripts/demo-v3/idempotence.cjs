"use strict";
const assert = require("node:assert/strict");
const { context } = require("../demo-v3.cjs");
const { hash } = require("./definition.cjs");
async function fingerprint(ctx) {
  const result = {};
  for (const model of ctx.local.req("@prisma/client").Prisma.dmmf.datamodel
    .models) {
    const rows =
      await ctx.db[
        model.name[0].toLowerCase() + model.name.slice(1)
      ].findMany();
    // Only digests are persisted: authentication rows and PDF bytes remain private.
    const digests = rows
      .map((row) => hash(JSON.parse(JSON.stringify(row))))
      .sort();
    result[model.name] = { count: rows.length, digest: hash(digests) };
  }
  return result;
}
async function main() {
  assert(
    process.argv.includes("--target=local-test"),
    "Explicit TEST target required",
  );
  const ctx = await context();
  try {
    const before = await fingerprint(ctx);
    await require("./catalog.cjs").seedCatalog(ctx);
    await require("./registration.cjs").seedRegistration(ctx);
    await require("./proposal.cjs").seedProposals(ctx);
    await require("./guidance.cjs").seedGuidance(ctx);
    await require("./policies.cjs").seedPolicies(ctx);
    const after = await fingerprint(ctx);
    assert.deepEqual(
      after,
      before,
      "Re-running completed seed phases changed existing rows",
    );
    const report = {
      status: "PASS",
      database: ctx.local.database,
      generatedAt: new Date().toISOString(),
      models: Object.keys(after).length,
      phasesReused: Object.keys(ctx.checkpoint.phases).length,
      before,
      after,
      limits:
        "Completed baseline phases only. The blocked defense producer and concurrent seeding are not proven idempotent by this check.",
    };
    ctx.save("idempotence.json", report);
    console.log(
      JSON.stringify({
        status: report.status,
        models: report.models,
        phasesReused: report.phasesReused,
      }),
    );
  } finally {
    await ctx.db.$disconnect();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(
      JSON.stringify({ status: "FAIL", error: e.code || e.message }),
    );
    process.exitCode = 1;
  });
module.exports = { fingerprint };
