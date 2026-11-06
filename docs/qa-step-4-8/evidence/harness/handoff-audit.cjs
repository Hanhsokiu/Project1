"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict"), cp = require("node:child_process"), { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../.."), req = createRequire(path.join(root, "backend/package.json"));
const { PrismaClient } = req("@prisma/client");
const run = fs.readFileSync(path.join(__dirname, "../latest-run.txt"), "utf8").trim(), out = path.join(__dirname, "..", run, "handoff"); fs.mkdirSync(out, { recursive: true });
async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8")), base = new URL(`postgresql://btl_ui:${config.password}@127.0.0.1:55451/postgres`);
  const database = "btl_pr2b_audit_handoff_" + crypto.randomBytes(6).toString("hex"), db = new PrismaClient({ datasources: { db: { url: base.toString() } } });
  await db.$executeRawUnsafe(`CREATE DATABASE "${database}"`); await db.$disconnect(); base.pathname = "/" + database;
  Object.assign(process.env, { DATABASE_URL: base.toString(), DIRECT_URL: base.toString(), NODE_ENV: "test", JWT_SECRET: crypto.randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"), EMAIL_WORKER_ENABLED: "false", STORAGE_LOCAL_PATH: path.join(out, "private"), GPMS_INTEGRATION: "1", RUN_TERM_DB_TESTS: "1" });
  for (const args of [[req.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(root, "backend/prisma/schema.prisma")], [path.join(root, "backend/prisma/seed.cjs")]]) {
    const r = cp.spawnSync(process.execPath, args, { cwd: path.join(root, "backend"), env: process.env, windowsHide: true, encoding: "utf8" }); assert.equal(r.status, 0, "Local fixture setup failed");
  }
  const { NestFactory } = req("@nestjs/core"), { ValidationPipe } = req("@nestjs/common"), { AppModule } = req(path.join(root, "backend/dist/app.module.js"));
  const app = await NestFactory.create(AppModule, { logger: false }); app.setGlobalPrefix("api"); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); await app.listen(0, "127.0.0.1");
  try {
    process.env.TERM_TEST_API_URL = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
    const log = fs.openSync(path.join(out, "console.log"), "w"), begin = Date.now();
    const exitCode = await new Promise((resolve, reject) => {
      const child = cp.spawn(process.execPath, [req.resolve("vitest/vitest.mjs"), "run", "src/registration/service/assignment-workflow.integration.spec.ts", "--cache=false", "--reporter=json", "--outputFile=" + path.join(out, "vitest.json")], { cwd: path.join(root, "backend"), env: process.env, windowsHide: true, stdio: ["ignore", log, log] }); child.once("error", reject); child.once("exit", resolve);
    });
    fs.closeSync(log); fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ database, exitCode, elapsedMs: Date.now() - begin, result: exitCode === 0 ? "PASS" : "FAIL", syntheticDataOnly: true, resetOrDrop: false }, null, 2)); if (exitCode) process.exitCode = 1;
  } finally { await app.close(); }
}
main().catch(e => { console.error(String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]")); process.exitCode = 1; });
