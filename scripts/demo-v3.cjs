"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const local = require("./demo-v3/local.cjs"),
  def = require("./demo-v3/definition.cjs");
const evidence = path.join(local.root, "docs/demo-data-v3/evidence");
function save(name, data) {
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(
    path.join(evidence, name),
    JSON.stringify(data, null, 2) + "\n",
  );
}
async function counts(db) {
  const result = {};
  for (const model of local.req("@prisma/client").Prisma.dmmf.datamodel.models)
    result[model.name] =
      await db[model.name[0].toLowerCase() + model.name.slice(1)].count();
  return result;
}
async function context() {
  const cfg = local.configuration(),
    db = local.client(cfg);
  await local.identity(db);
  const checkpointFile = path.join(
    local.cache,
    local.database + "-checkpoint.json",
  );
  let checkpoint = fs.existsSync(checkpointFile)
    ? JSON.parse(fs.readFileSync(checkpointFile, "utf8"))
    : {
        profile: def.namespace,
        manifestHash: def.hash(def.manifest),
        phases: {},
      };
  assert.equal(checkpoint.profile, def.namespace);
  assert.equal(
    checkpoint.manifestHash,
    def.hash(def.manifest),
    "Manifest changed; review a new profile instead of overwriting existing data",
  );
  const key = def.id("checkpoint");
  // Durable checkpoint is committed with each phase: process crashes cannot create a duplicate phase.
  const phase = async (name, work) => {
    const existing = await db.auditLog.findUnique({
      where: { id: def.id("phase/" + name) },
    });
    if (existing) {
      assert.equal(existing.action, "SYNTHETIC_DEMO_PHASE");
      assert.equal(existing.newValue.manifestHash, checkpoint.manifestHash);
      checkpoint.phases[name] = { status: "PASS", reused: true };
      return;
    }
    console.log("Seeding " + name);
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261116, 3)`;
        assert.equal(
          await tx.auditLog.count({ where: { id: def.id("phase/" + name) } }),
          0,
          "Concurrent seed detected; retry later",
        );
        await work(tx);
        await tx.auditLog.create({
          data: {
            id: def.id("phase/" + name),
            action: "SYNTHETIC_DEMO_PHASE",
            resource: "demo-fixture",
            resourceId: key,
            newValue: {
              synthetic: true,
              phase: name,
              manifestHash: checkpoint.manifestHash,
              realUserAction: false,
            },
            createdAt: def.date(def.manifest.reference_date),
          },
        });
      },
      { timeout: 180000, maxWait: 10000, isolationLevel: "Serializable" },
    );
    checkpoint.phases[name] = { status: "PASS", reused: false };
    fs.writeFileSync(
      checkpointFile,
      JSON.stringify(checkpoint, null, 2) + "\n",
    );
  };
  const put = async (tx, model, data) => {
    assert(data.id, "Deterministic ID required for " + model);
    assert.equal(
      await tx[model].count({ where: { id: data.id } }),
      0,
      "Existing row has no phase ownership checkpoint: " + model,
    );
    try {
      return await tx[model].create({ data });
    } catch (e) {
      if (e.name === "PrismaClientValidationError")
        throw Error(
          model +
            ": " +
            e.message
              .split("\n")
              .filter((line) =>
                /^(Unknown argument|Argument |Invalid value|Expected )/.test(
                  line.trim(),
                ),
              )
              .join(" "),
        );
      throw e;
    }
  };
  return { local, cfg, db, phase, put, checkpoint, save, counts, evidence };
}
async function main() {
  const args = process.argv.slice(2),
    modes = args.filter(
      (a) => a.startsWith("--") && !a.startsWith("--target="),
    );
  const allowed = new Set([
    "--dry-run",
    "--prepare",
    "--seed",
    "--validate",
    "--report",
    "--export-backup",
    "--serve",
    "--api-smoke",
  ]);
  assert(
    modes.every((m) => allowed.has(m)) &&
      modes.length <= 1 &&
      args.every((a) => allowed.has(a) || a === "--target=local-test"),
    "Unknown or conflicting command",
  );
  const mode = modes[0] || "--dry-run";
  if (mode === "--dry-run") {
    const plan = {
      mode: "DRY_RUN_OFFLINE",
      database: local.database,
      port: local.port,
      productionConnected: false,
      manifest: def.manifest,
      actualCatalogAreas: def.areas,
      changesApplied: 0,
    };
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  assert(
    args.includes("--target=local-test"),
    "Explicit --target=local-test required",
  );
  if (mode === "--prepare") {
    console.log(JSON.stringify(await local.prepare()));
    return;
  }
  if (mode === "--serve") {
    await require("./demo-v3/runtime.cjs").serve();
    return;
  }
  const ctx = await context();
  try {
    if (mode === "--seed") {
      if (!fs.existsSync(path.join(evidence, "counts-before.json")))
        save("counts-before.json", await counts(ctx.db));
      await require("./demo-v3/catalog.cjs").seedCatalog(ctx);
      await require("./demo-v3/registration.cjs").seedRegistration(ctx);
      await require("./demo-v3/proposal.cjs").seedProposals(ctx);
      await require("./demo-v3/guidance.cjs").seedGuidance(ctx);
      await require("./demo-v3/verify.cjs").verify(ctx);
      let producerFailure;
      try {
        await require("./demo-v3/defense.cjs").seedDefense(ctx);
      } catch (error) {
        producerFailure = {
          status: "BLOCKED",
          stage: "defense-producer",
          message:
            error.getResponse?.() ||
            (error.name?.includes("Prisma")
              ? error.code || error.name
              : error.message),
          productionConnected: false,
        };
        save("producer-blocker.json", producerFailure);
      }
      save("counts-after.json", await counts(ctx.db));
      await require("./demo-v3/verify.cjs").verify(ctx);
      if (producerFailure) {
        console.error(JSON.stringify(producerFailure));
        process.exitCode = 2;
      }
    } else if (mode === "--validate" || mode === "--report")
      await require("./demo-v3/verify.cjs").verify(ctx);
    else if (mode === "--api-smoke")
      await require("./demo-v3/smoke.cjs").smoke(ctx);
    else if (mode === "--export-backup")
      await require("./demo-v3/backup.cjs").backup(ctx);
  } finally {
    await ctx.db.$disconnect();
  }
}
if (require.main === module)
  main().catch((e) => {
    const response = e.getResponse?.();
    console.error(
      JSON.stringify({
        status: "FAIL",
        error:
          response ||
          (e.name?.includes("Prisma") ? e.code || e.name : e.message),
        productionConnected: false,
      }),
    );
    process.exitCode = 1;
  });
module.exports = { context, counts, main };
