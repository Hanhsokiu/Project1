"use strict";
// Live Edge -> Vite -> Nest -> PG17/private storage. No mocked academic APIs.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const assert = require("node:assert/strict"), crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { testTarget } = require("./rehearse-pr2b.cjs");
const { seedSteps48 } = require("./integration/seed-steps4-8.cjs");
const evidence = path.resolve(__dirname, "../../docs/implementation/evidence/steps4-8");
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL), backend = path.resolve(__dirname, "..");
  const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "btl-integration-48-"));
  Object.assign(process.env, { DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), NODE_ENV: "test", JWT_SECRET: crypto.randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"), STORAGE_LOCAL_PATH: privateRoot, GUIDANCE_UPLOAD_ENABLED: "true" });
  delete process.env.GUIDANCE_UPLOAD_POLICY_JSON;
  const { PrismaClient } = require("@prisma/client"), db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  fs.mkdirSync(evidence, { recursive: true });
  let app, child, result = "FAIL", failure, workflowResult = "NOT RUN";
  const checks = [], traffic = [], endpoints = [];
  const pass = (name, actual) => { checks.push({ name, expected: "As stated in test case", actual, result: "PASS" }); console.log("PASS " + name); };
  const startedAt = new Date().toISOString();
  try {
    const [identity] = await db.$queryRaw`SELECT current_database() AS name,current_setting('server_version_num') AS version`;
    assert.equal(identity.name, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [tables] = await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(tables.n, 0, "Must supply a NEW empty test DB; no reset or reuse");
    const deploy = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(backend, "prisma/schema.prisma")], { cwd: backend, env: process.env, windowsHide: true, encoding: "utf8" });
    assert.equal(deploy.status, 0, "Isolated migration replay failed");
    const seed = await seedSteps48(db, url.toString());
    await assert.rejects(seedSteps48(db, url.toString()), /Seed refuses existing/);
    const legacySnapshot = async () => JSON.stringify(await Promise.all([db.student.findMany({ orderBy: { id: "asc" } }), db.termStudent.findMany({ orderBy: { id: "asc" } }), db.termLecturer.findMany({ orderBy: [{ termId: "asc" }, { lecturerId: "asc" }] }), db.registration.findMany({ orderBy: { id: "asc" } }), db.advisorAssignment.findMany({ orderBy: { id: "asc" } }), db.assignmentPlan.findMany({ orderBy: { id: "asc" } }), db.topic.findMany({ orderBy: { id: "asc" } })]));
    const beforeLegacy = await legacySnapshot();
    pass("fresh guarded PG17 seed and canonical active-migration replay", "Synthetic roster/official assignments/agreement/v1/profile only; no review, finalization, task or submission pre-created");
    const { NestFactory } = require("@nestjs/core"), { ValidationPipe } = require("@nestjs/common"), { AppModule } = require("../dist/app.module");
    const { SwaggerModule, DocumentBuilder } = require("@nestjs/swagger");
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix("api");
    app.enableCors({ origin: "http://127.0.0.1:50180", credentials: true });
    app.use((req, res, next) => { res.on("finish", () => { if (req.method !== "OPTIONS") traffic.push({ method: req.method, path: req.path, status: res.statusCode }); }); next(); });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    const api = "http://127.0.0.1:" + app.getHttpServer().address().port + "/api";
    // Every Swagger operation in the feature tags is exercised unauthenticated.
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("QA integration").addBearerAuth().build());
    const tags = new Set(["review-groups", "proposal-reviews", "proposal-versions", "proposal-dossiers", "guidance-plans-tasks", "guidance", "guidance-submissions", "guidance-reviews-monitoring", "notification"]);
    const login = await fetch(api + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "qa-unprivileged", password: seed.password }) });
    assert.equal(login.status, 201);
    const unprivileged = await login.json(), deniedToken = unprivileged.accessToken ?? unprivileged.data?.accessToken;
    assert(deniedToken);
    for (const [route, methods] of Object.entries(doc.paths)) for (const [method, op] of Object.entries(methods)) {
      if (!op.tags?.some(t => tags.has(t))) continue;
      const concrete = route.replace(/\{[^}]+\}/g, "qa-missing");
      const response = await fetch(api.replace(/\/api$/, "") + concrete, { method: method.toUpperCase(), headers: { "Content-Type": "application/json" }, ...(!["get", "head"].includes(method) ? { body: "{}" } : {}), signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 401, "Anonymous access: " + method + " " + route);
      const denied = await fetch(api.replace(/\/api$/, "") + concrete, { method: method.toUpperCase(), headers: { "Content-Type": "application/json", Authorization: "Bearer " + deniedToken }, ...(!["get", "head"].includes(method) ? { body: "{}" } : {}), signal: AbortSignal.timeout(15000) });
      const legacyNotification = route.includes('/notifications/user/') || route.includes('/me/notifications');
      const expectedDenied = op.tags.includes("notification") && legacyNotification ? (route.endsWith("/me/notifications") ? 200 : 404) : 403;
      assert.equal(denied.status, expectedDenied, "Authenticated user without permission: " + method + " " + route);
      endpoints.push({ method: method.toUpperCase(), path: route, tags: op.tags, anonymous: "PASS", actualStatus: response.status, noPermissions: "PASS", noPermissionsStatus: denied.status });
    }
    assert(endpoints.length >= 45, "Inventory must include all feature tags, not a vacuous pass");
    pass("all inventoried step 4–8 operations reject anonymous access", endpoints.length + " operations returned 401; see endpoint-auth.json");
    child = spawn(process.execPath, [path.resolve(backend, "../frontend/scripts/test-steps4-8-browser.cjs")], { cwd: path.resolve(backend, "../frontend"), env: { ...process.env }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const log = fs.createWriteStream(path.join(evidence, "live-browser.log"));
    child.stdout.on("data", b => { process.stdout.write(b); log.write(b); });
    child.stderr.on("data", b => { process.stderr.write(b); log.write(b); });
    const exit = new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", resolve); });
    child.stdin.end(JSON.stringify({ api, password: seed.password, actors: seed.actors, startDate: seed.startDate, dueDate: seed.dueDate, evidence }));
    assert.equal(await exit, 0, "Live browser E2E failed; see live-browser.json/log");
    await new Promise(resolve => log.end(resolve));
    const flow = JSON.parse(fs.readFileSync(path.join(evidence, "live-browser.json"), "utf8"));
    assert.equal(flow.result, "PASS");
    pass("live browser full 4→5→6→7→8A→8B→8C workflow", flow.checks.length + " browser checkpoints with real API; no mocked responses");
    const { pathToFileURL } = require("node:url");
    const { getDocument } = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
    const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(evidence, "live-finalized.pdf"))), isEvalSupported: false, useSystemFonts: false }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), view = page.getViewport({ scale: 1 });
      assert(Math.abs(view.width - 595.28) < 1 && Math.abs(view.height - 841.89) < 1);
      for (const item of (await page.getTextContent()).items) if ("str" in item) {
        text += item.str + "\n";
        assert(item.transform[4] >= 40 && item.transform[4] + item.width <= view.width - 39, "PDF horizontal overflow");
        assert(item.transform[5] >= 20 && item.transform[5] <= view.height - 30, "PDF vertical overflow");
      }
    }
    for (const field of ["ĐỀ CƯƠNG ĐỒ ÁN TỐT NGHIỆP", "Nguyễn Văn Sinh", "Công nghệ thông tin K63", "Khoa học máy tính", "Trần Văn Hướng Dẫn", "Mục tiêu đã sửa:", "Trưởng Khoa", "Trưởng Bộ môn", "Sinh viên thực hiện"])
      assert(text.includes(field), "Missing finalized Unicode field: " + field);
    await pdf.destroy();
    pass("browser-downloaded PDF contains real finalized v2 Vietnamese fields, A4 and no text overflow", "Parsed actual download with pdfjs; no mock PDF");
    assert.equal(await legacySnapshot(), beforeLegacy, "Step 1–3 records unexpectedly changed");
    assert.equal(await db.finalResult.count(), 0);
    assert.equal(await db.defenseEligibility.count(), 0);
    const versions = await db.proposalVersion.findMany({ where: { proposalId: "p-student" }, orderBy: { version: "asc" } });
    assert.equal(versions.length, 2); assert.equal(versions[0].content.objectives, seed.content.objectives);
    const decisionRows = await db.proposalReviewDecision.findMany({ where: { refReviewId: { proposalId: "p-student" } } });
    assert.equal(decisionRows.length, 2);
    const reviewResults = await db.progressReview.findMany();
    assert.deepEqual(reviewResults.map(r => r.decision).sort(), ["PASS", "REVISION_REQUIRED"]);
    const wf = await db.taskWorkflow.findMany({ where: { state: "COMPLETED" } });
    assert.equal(wf.length, 1);
    pass("post-flow database assertions preserve v1, distinct exact-version decisions and step 1–3 rows", "v1/v2, two proposal decisions, two progress decisions, one completed task; no graduation data generated");
    workflowResult = "PASS";
    // Legacy routes also expose proposal/owner metadata. Record bypasses separately;
    // do not silently invent a new step 1–3 list contract or omit failed probes.
    const findings = [];
    for (const actor of ["unprivileged", "student3"]) {
      const response = await fetch(api + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "qa-" + actor, password: seed.password }) });
      assert.equal(response.status, 201);
      const login = await response.json(), token = login.accessToken ?? login.data?.accessToken;
      for (const route of ["/topics/term/qa-t1", "/registrations/term/qa-t1"]) {
        const probe = await fetch(api + route, { headers: { Authorization: "Bearer " + token } });
        const payload = await probe.json();
        const exposed = probe.status === 200 && Array.isArray(payload.data) && payload.data.length > 0;
        const safeResponse = [403, 404].includes(probe.status) || (probe.status === 200 && Array.isArray(payload.data) && payload.data.length === 0);
        findings.push({ actor, method: "GET", path: route, expected: "403/404 or no out-of-scope academic/owner data", actualStatus: probe.status, exposedRows: exposed ? payload.data.length : 0, result: safeResponse ? "PASS" : "FAIL" });
      }
    }
    const legacySecurity = findings.some(f => f.result === "FAIL") ? "FAIL" : "PASS";
    fs.writeFileSync(path.join(evidence, "legacy-security.json"), JSON.stringify({ result: legacySecurity, syntheticDataOnly: true, findings }, null, 2) + "\n");
    if (legacySecurity === "FAIL") {
      failure = "Legacy topic/registration list exposes out-of-scope rows; step 1–3 ownership/read contract must be coordinated before changing those APIs";
      console.error("FAIL " + failure); process.exitCode = 1;
    } else result = "PASS";
  } catch (e) { failure = e.message; console.error("FAIL " + failure); process.exitCode = 1; }
  finally {
    if (app) await app.close();
    await db.$disconnect();
    fs.writeFileSync(path.join(evidence, "live-api-traffic.json"), JSON.stringify(traffic, null, 2) + "\n");
    fs.writeFileSync(path.join(evidence, "endpoint-auth.json"), JSON.stringify(endpoints, null, 2) + "\n");
    fs.writeFileSync(path.join(evidence, "live-e2e.json"), JSON.stringify({ result, workflowResult, startedAt, finishedAt: new Date().toISOString(), database: url.pathname.slice(1), postgresMajor: 17, sharedDatabaseAccess: false, mockedApi: false, checks, ...(failure ? { failure } : {}) }, null, 2) + "\n");
  }
}
main().catch(() => { console.error("FAIL guarded E2E setup; check local test target and prerequisites"); process.exitCode = 1; });
