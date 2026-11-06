"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict"), { createRequire } = require("node:module"), cp = require("node:child_process");
const root = path.resolve(__dirname, "../../../.."), req = createRequire(path.join(root, "backend/package.json"));
const { PrismaClient } = req("@prisma/client");
const run = fs.readFileSync(path.join(__dirname, "../latest-run.txt"), "utf8").trim();
const out = path.join(__dirname, "..", run, "boundary-diagnosed"); fs.mkdirSync(out, { recursive: true });
async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8"));
  const base = new URL(`postgresql://btl_ui:${config.password}@127.0.0.1:55451/postgres`);
  const admin = new PrismaClient({ datasources: { db: { url: base.toString() } } });
  const database = "btl_pr2b_audit_boundary_" + crypto.randomBytes(6).toString("hex");
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`); await admin.$disconnect(); base.pathname = "/" + database;
  Object.assign(process.env, { DATABASE_URL: base.toString(), DIRECT_URL: base.toString(), NODE_ENV: "test", JWT_SECRET: crypto.randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"), EMAIL_WORKER_ENABLED: "false", STORAGE_LOCAL_PATH: path.join(out, "private") });
  const deploy = cp.spawnSync(process.execPath, [req.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(root, "backend/prisma/schema.prisma")], { cwd: path.join(root, "backend"), env: process.env, windowsHide: true, encoding: "utf8" });
  assert.equal(deploy.status, 0, "Isolated migrate deploy failed");
  const db = new PrismaClient({ datasources: { db: { url: base.toString() } } });
  let app;
  const result = { database, startedAt: new Date().toISOString(), syntheticFixtureOnly: true, productionBootstrapParity: "AppModule, ValidationPipe, GlobalExceptionHandler, default JSON body parser; binds ephemeral loopback port", cases: [], invariants: [] };
  try {
    const seed = await req(path.join(root, "backend/scripts/integration/seed-steps4-8.cjs")).seedSteps48(db, base.toString());
    // Dedicated transport fixture, no changes to UI data or production code.
    await db.proposal.update({ where: { id: "p-student" }, data: { status: "DRAFT" } });
    await db.proposalWorkflow.update({ where: { proposalId: "p-student" }, data: { submittedVersionId: null, workingVersionId: null } });
    const { NestFactory } = req("@nestjs/core"), { ValidationPipe } = req("@nestjs/common"), { AppModule } = req(path.join(root, "backend/dist/app.module.js"));
    const { GlobalExceptionHandler } = req(path.join(root, "backend/dist/common/exception/global-exception.handler.js"));
    app = await NestFactory.create(AppModule, { logger: false }); app.setGlobalPrefix("api");
    const filter = new GlobalExceptionHandler(), originalCatch = filter.catch.bind(filter);
    result.transportErrors = [];
    filter.catch = (error, host) => {
      result.transportErrors.push({ name: error?.constructor?.name, status: error?.status, type: error?.type, limit: error?.limit, length: error?.length });
      return originalCatch(error, host);
    };
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); app.useGlobalFilters(filter); await app.listen(0, "127.0.0.1");
    const api = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
    async function login(actor) { const response = await fetch(api + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "qa-" + actor, password: seed.password }) }); assert.equal(response.status, 201); const body = await response.json(); return body.data.accessToken; }
    const token = await login("student");
    async function call(name, route, options, expectedStatus) {
      const begin = performance.now(), response = await fetch(api + route, options); const body = await response.json();
      const item = { name, route, actualStatus: response.status, expectedStatus, elapsedMs: Math.round((performance.now() - begin) * 100) / 100, body, result: response.status === expectedStatus ? "PASS" : "FAIL" }; result.cases.push(item); return { response, body, item };
    }
    const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };
    const { ProposalVersionSaveSchema } = req("@doan/shared");
    const small = { expectedRevision: 0, content: seed.content };
    assert(ProposalVersionSaveSchema.safeParse(small).success);
    const positive = await call("valid-small-save", "/proposals/p-student/versions", { method: "POST", headers: { ...headers, "Idempotency-Key": "qa-small" }, body: JSON.stringify(small) }, 201);
    assert.equal(positive.response.status, 201, "Positive control must save through authenticated API");
    const large = { expectedRevision: positive.body.data.proposalRevision, content: { ...seed.content, ...Object.fromEntries(["objectives", "scope", "mainContents", "tools", "expectedResults"].map(k => [k, "đ".repeat(11000)])) } };
    assert(ProposalVersionSaveSchema.safeParse(large).success);
    const before = await db.proposalVersion.count({ where: { proposalId: "p-student" } });
    const boundary = await call("schema-valid-utf8-save", "/proposals/p-student/versions", { method: "POST", headers: { ...headers, "Idempotency-Key": "qa-large" }, body: JSON.stringify(large) }, 201);
    boundary.item.requestBytes = Buffer.byteLength(JSON.stringify(large)); boundary.item.schemaValid = true;
    result.invariants.push({ name: "oversize rejection does not append partial version", before, after: await db.proposalVersion.count({ where: { proposalId: "p-student" } }) });
    for (const [name, body] of [["missing-content", { expectedRevision: large.expectedRevision }], ["wrong-revision-type", { ...small, expectedRevision: "x" }], ["actor-injection", { ...small, actorId: "faculty" }]])
      await call(name, "/proposals/p-student/versions", { method: "POST", headers: { ...headers, "Idempotency-Key": "qa-" + name }, body: JSON.stringify(body) }, 400);
    await call("invalid-token", "/proposals/p-student/editing-context", { headers: { Authorization: "Bearer invalid-token" } }, 401);
    const sid = req("@nestjs/jwt").JwtService;
    const decoded = new sid().decode(token); await db.loginSession.update({ where: { id: decoded.sid }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await call("expired-session", "/proposals/p-student/editing-context", { headers: { Authorization: "Bearer " + token } }, 401);
  } finally { if (app) await app.close(); await db.$disconnect(); result.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(result, null, 2)); }
}
main().catch(e => { console.error(String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]")); process.exitCode = 1; });
