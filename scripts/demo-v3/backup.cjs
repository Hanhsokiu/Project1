"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { hash } = require("./definition.cjs");
async function backup(ctx) {
  await ctx.local.identity(ctx.db);
  const dir = path.join(
    ctx.local.cache,
    "backups",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  fs.mkdirSync(dir, { recursive: true });
  const target = path.resolve(dir, "demo-v3.dump");
  assert(target.startsWith(path.resolve(ctx.local.cache) + path.sep));
  ctx.local.pg(ctx.cfg, "pg_dump", [
    "--format=custom",
    "--no-owner",
    "--file",
    target,
  ]);
  ctx.local.pg(ctx.cfg, "pg_restore", ["--list", target]);
  fs.cpSync(ctx.local.storageRoot, path.join(dir, "storage"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  const clone = "btl_pr2b_demo_v3_copy_" + Date.now();
  assert(/^btl_pr2b_demo_v3_copy_\d{13}$/.test(clone));
  assert.equal(
    ctx.local
      .pg(ctx.cfg, "psql", [
        "-X",
        "-At",
        "-d",
        "postgres",
        "-c",
        `SELECT count(*) FROM pg_database WHERE datname='${clone}'`,
      ])
      .trim(),
    "0",
    "Restore target must be NEW; never overwrite a database",
  );
  ctx.local.pg(ctx.cfg, "createdb", [clone]);
  ctx.local.pg(ctx.cfg, "pg_restore", [
    "--no-owner",
    "--no-privileges",
    "--single-transaction",
    "--exit-on-error",
    "--dbname",
    clone,
    target,
  ]);
  const url = new URL(ctx.local.connection(ctx.cfg));
  url.pathname = "/" + clone;
  const copied = new (ctx.local.req("@prisma/client").PrismaClient)({
    datasources: { db: { url: url.toString() } },
  });
  let copiedCounts;
  try {
    const [identity] = await copied.$queryRawUnsafe(
      "SELECT current_database() name,host(inet_server_addr()) AS host,inet_server_port() port",
    );
    assert.equal(identity.name, clone);
    assert.equal(identity.host, "127.0.0.1");
    assert.equal(identity.port, ctx.local.port);
    copiedCounts = await ctx.counts(copied);
    assert.deepEqual(
      copiedCounts,
      await ctx.counts(ctx.db),
      "Source changed during backup or restore counts differ",
    );
    for (const asset of await copied.fileAsset.findMany({
      where: { kind: { not: "DOSSIER_PDF" } },
    })) {
      const bytes = fs.readFileSync(
        path.join(
          dir,
          "storage/.private-guidance",
          asset.storageKey.slice("guidance/".length),
        ),
      );
      assert.equal(hash(bytes), asset.checksum);
      assert.equal(bytes.length, asset.sizeBytes);
    }
  } finally {
    await copied.$disconnect();
  }
  const manifest = {
    database: ctx.local.database,
    dumpHash: hash(fs.readFileSync(target)),
    bytes: fs.statSync(target).size,
    restoreActuallyTested: true,
    restoredDatabase: clone,
    restoredModelCounts: copiedCounts,
    storageIncluded: true,
    productionConnected: false,
    containsPasswordHashes: true,
    publicCommitAllowed: false,
  };
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  ctx.save("backup-report.json", {
    ...manifest,
    path: path.relative(ctx.local.root, dir).replaceAll("\\", "/"),
  });
  console.log(
    JSON.stringify({
      status: "BACKUP_AND_NEW_DATABASE_RESTORE_VERIFIED",
      bytes: manifest.bytes,
      restoreActuallyTested: true,
    }),
  );
}
module.exports = { backup };
