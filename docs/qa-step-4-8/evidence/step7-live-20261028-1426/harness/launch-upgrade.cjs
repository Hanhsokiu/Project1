"use strict";
// QA-only launcher: fresh guarded databases; no reset/drop or application edits.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../../..");
const backend = path.join(root, "backend");
const req = createRequire(path.join(backend, "package.json"));
const frontendReq = createRequire(path.join(root, "frontend/package.json"));
const out = path.join(root,"docs/qa-step-4-8/evidence/step7-live-20261028-1426");
const cache = path.join(root, ".cache/step7-live-20261028-1426");
fs.mkdirSync(cache, { recursive: true });
const { PrismaClient } = req("@prisma/client");
const { testTarget } = req("./scripts/rehearse-pr2b.cjs");
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const hash = value => crypto.createHash("sha256").update(canonical(value)).digest("hex");
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
const redact = text => String(text).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED DATABASE URL]").replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED JWT]");
async function freshTarget(kind) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8"));
  const adminUrl = new URL("postgresql://127.0.0.1:55451/postgres");
  adminUrl.username = "btl_ui"; adminUrl.password = cfg.password;
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  const database = "btl_pr2b_step7_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex") + "_" + kind;
  assert(/^btl_pr2b_step7_[a-z0-9_]+$/.test(database));
  try {
    const [identity] = await admin.$queryRawUnsafe("SELECT current_database() AS db,current_setting('server_version_num') AS version");
    assert.equal(identity.db, "postgres"); assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    assert.equal((await admin.$queryRawUnsafe("SELECT datname FROM pg_database WHERE datname=$1", database)).length, 0);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
  } finally { await admin.$disconnect(); }
  const url = new URL(adminUrl); url.pathname = "/" + database; testTarget(url.toString());
  save((kind === "api" && process.env.STEP7_UPGRADE === "true" ? "upgrade" : kind) + "-target.json", { database, host: url.hostname, port: Number(url.port), freshDatabase: true, existingDatabaseModified: false, droppedOrReset: false });
  return { url, database, cfg };
}
async function coreSnapshot(db) {
  return Promise.all([db.student.findMany({ orderBy: { id: "asc" } }), db.termStudent.findMany({ orderBy: { id: "asc" } }), db.termLecturer.findMany({ orderBy: [{ termId: "asc" }, { lecturerId: "asc" }] }), db.registration.findMany({ orderBy: { id: "asc" } }), db.advisorAssignment.findMany({ orderBy: { id: "asc" } }), db.assignmentPlan.findMany({ orderBy: { id: "asc" } }), db.topic.findMany({ orderBy: { id: "asc" } })]);
}
async function apiSuite() {
  const { url, database, cfg } = await freshTarget("api");
  const dir = path.join(out, process.env.STEP7_UPGRADE === "true" ? "upgrade" : "api"); fs.mkdirSync(dir, { recursive: true });
  const preload = path.join(root, "docs/qa-step-4-8/evidence/harness/preload.cjs");
  const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), PR2B_TEST_URL: url.toString(), PR2B_PSQL: path.join(cfg.bin, "psql.exe"), EMAIL_WORKER_ENABLED: "false", QA_RUN_DIR: dir, NODE_OPTIONS: `--require="${preload.replace(/\\/g, "/")}"` };
  const result = await new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, [path.join(backend, "scripts/test-proposal-dossier-upgrade.cjs")], { cwd: backend, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let log = ""; child.stdout.on("data", x => { log += x; }); child.stderr.on("data", x => { log += x; });
    child.once("error", reject); child.once("exit", code => resolve({ code, log: redact(log) }));
  });
  fs.writeFileSync(path.join(dir, "console.log"), result.log);
  save(process.env.STEP7_UPGRADE === "true" ? "upgrade-summary.json" : "api-suite-summary.json", { database, exitCode: result.code, result: result.code === 0 ? "PASS" : "FAIL", originalAssertionsUnmodified: true, evidenceRedirectOnly: true, finishedAt: new Date().toISOString() });
  console.log(JSON.stringify({ suite: "step7-api", database, exitCode: result.code, result: result.code === 0 ? "PASS" : "FAIL" }));
  if (result.code !== 0) process.exitCode = 1;
}
async function liveServer() {
  assert(!fs.existsSync(path.join(cache, "runtime.json")), "Do not reuse a previous live target");
  const { url, database } = await freshTarget("live");
  Object.assign(process.env, { DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), PR2B_TEST_URL: url.toString(), NODE_ENV: "test", PORT: "50585", API_PREFIX: "api", JWT_SECRET: crypto.randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"), EMAIL_WORKER_ENABLED: "false", FRONTEND_URL: "http://127.0.0.1:50185", STORAGE_LOCAL_PATH: path.join(cache, "uploads") });
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let app, vite;
  const traffic = [];
  try {
    const [identity] = await db.$queryRawUnsafe("SELECT current_database() AS db"); assert.equal(identity.db, database);
    const [empty] = await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"); assert.equal(empty.n, 0);
    const migration = cp.spawnSync(process.execPath, [req.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(backend, "prisma/schema.prisma")], { cwd: backend, env: process.env, windowsHide: true, encoding: "utf8" });
    fs.writeFileSync(path.join(out, "live-migration.log"), redact((migration.stdout || "") + (migration.stderr || "")));
    assert.equal(migration.status, 0, "Fresh test DB migration failed");
    const { seedSteps48 } = req("./scripts/integration/seed-steps4-8.cjs");
    await seedSteps48(db, url.toString());
    // Reuse the local UI credential already supplied by the user; never log it.
    const doc = fs.readFileSync(path.join(root, "docs/implementation/integration-ui-workflow-demo.md"), "utf8");
    const localCredential = doc.match(/Mật khẩu chung: \*\*([^*]+)\*\*/)?.[1]; assert(localCredential);
    await db.userAccount.updateMany({ data: { passwordHash: await req("bcryptjs").hash(localCredential, 10) } });
    for (const [id, members] of [["qa-g1", ["reviewer", "advisor"]], ["qa-g2", ["reviewer", "outsider"]]])
      await db.reviewGroup.create({ data: { id, termId: "qa-t1", name: "Nhóm kiểm thử " + id, members: { create: members.map(lecturerId => ({ lecturerId })) }, pr2bReviewGroupWorkflowGroupId: { create: { departmentId: "qa-d" } } } });
    await db.role.create({ data: { id: "COMMITTEE", name: "COMMITTEE" } });
    for (const permission of await db.permission.findMany({ where: { resource: "proposal", action: { in: ["read", "comment", "review"] } } }))
      await db.rolePermission.create({ data: { roleId: "COMMITTEE", permissionId: permission.id } });
    await db.userAccount.create({ data: { id: "committee", username: "qa-committee", email: "committee@example.invalid", phone: "0912345678", passwordHash: await req("bcryptjs").hash(localCredential, 10), status: "ACTIVE", mustChangePassword: false, userRoles: { create: { roleId: "COMMITTEE" } } } });
    // Runs only inside the guarded NEW private DB launcher, before baseline hash.
    for(const [resource,action,roles] of [
      ['notification','own',['FACULTY','LECTURER','STUDENT']],
      ['catalog','read',['FACULTY','LECTURER','STUDENT','COMMITTEE']],
      ['term','read',['LECTURER','STUDENT','COMMITTEE']],
      ['lecturer','read',['LECTURER','STUDENT','COMMITTEE']],
      ['assignment','read',['FACULTY','LECTURER','STUDENT']],
    ]){
      const permission=await db.permission.upsert({where:{resource_action:{resource,action}},create:{resource,action},update:{}});
      for(const roleId of roles)await db.rolePermission.upsert({where:{roleId_permissionId:{roleId,permissionId:permission.id}},create:{roleId,permissionId:permission.id},update:{}});
    }
    const sample=await db.proposalVersion.findUniqueOrThrow({where:{id:'v1-student'},include:{pr2bProposalVersionWorkflowVersionId:true}});
    const sampleUser=await db.userAccount.findUniqueOrThrow({where:{id:'student'}});
    for(let n=1;n<=21;n++){
      const tag='page-'+String(n).padStart(2,'0'),studentId='qa-'+tag,topicId='topic-'+tag,proposalId='p-'+tag,versionId='v1-'+tag;
      await db.userAccount.create({data:{id:studentId,username:studentId,email:studentId+'@example.invalid',passwordHash:sampleUser.passwordHash,status:'ACTIVE',mustChangePassword:false,userRoles:{create:{roleId:'STUDENT'}}}});
      await db.student.create({data:{id:studentId,userId:studentId,studentCode:'QA-PAGE-'+String(n).padStart(2,'0'),fullName:'Sinh viên phân trang '+String(n).padStart(2,'0'),trainingSystemId:'qa-training'}});
      await db.termStudent.create({data:{id:'ts-'+tag,studentId,termId:'qa-t1'}});
      await db.registration.create({data:{id:'reg-'+tag,studentId,termId:'qa-t1',advisorAssignments:{create:{advisorId:'advisor',assignmentPlanId:'qa-t1-assign'}}}});
      await db.topic.create({data:{id:topicId,termId:'qa-t1',researchAreaId:'qa-area',title:'Phân trang hồ sơ — '+String(n).padStart(2,'0'),pr2bTopicWorkflowTopicId:{create:{termId:'qa-t1',termStudentId:'ts-'+tag,confirmedTopicRevision:0,confirmedAssignmentRevision:0,confirmedByAdvisorId:'advisor',confirmedAt:new Date()}}}});
      await db.proposal.create({data:{id:proposalId,topicId,termId:'qa-t1',studentId,status:'SUBMITTED'}});
      await db.proposalVersion.create({data:{id:versionId,proposalId,version:1,content:sample.content,pr2bProposalVersionWorkflowVersionId:{create:{state:'SEALED',contentSchemaVersion:1,contentHash:sample.pr2bProposalVersionWorkflowVersionId.contentHash,createdByUserId:studentId,submittedByUserId:studentId,submittedAt:new Date()}}}});
      await db.proposalWorkflow.create({data:{proposalId,workingVersionId:versionId,submittedVersionId:versionId,submissionKind:'INITIAL',nextReviewRound:1,nextVersionNumber:2}});
    }

 const qaMcp=JSON.parse(fs.readFileSync(path.join(cache,'mcp-credential.json'),'utf8'));await db.userAccount.update({where:{id:'student2'},data:{passwordHash:await req('bcryptjs').hash(qaMcp.password,10)}});
    const coreHash = hash(await coreSnapshot(db));
    fs.writeFileSync(path.join(cache, "runtime.json"), JSON.stringify({ url: url.toString(), database, coreHash }), { flag: "wx", mode: 0o600 });
    const { NestFactory } = req("@nestjs/core"), { ValidationPipe } = req("@nestjs/common");
    const { AppModule } = req("./dist/app.module");
    const { GlobalExceptionHandler } = req("./dist/common/exception/global-exception.handler");
    const { configureBodyParsers } = req("./dist/common/http/body-parsers");
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false, bodyParser: false });
    configureBodyParsers(app, "api"); app.setGlobalPrefix("api"); app.enableCors({ origin: "http://127.0.0.1:50185", credentials: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); app.useGlobalFilters(new GlobalExceptionHandler());
    app.use((request, response, next) => { response.on("finish", () => { traffic.push({ at: new Date().toISOString(), method: request.method, path: request.path, status: response.statusCode }); save("live-server-traffic.json", traffic); }); next(); });
    await app.listen(0, "127.0.0.1");
    const apiOrigin = "http://127.0.0.1:" + app.getHttpServer().address().port;
    const viteEnv = { ...process.env, VITE_API_URL: apiOrigin + "/api", VITE_AUTH_API: "true", VITE_TERM_API: "true", VITE_CATALOG_API: "true", VITE_IMPORT_API: "true", VITE_REGISTRATION_API: "true", VITE_ASSIGNMENT_API: "true", VITE_TOPIC_API: "true", VITE_PROPOSAL_API: "true" };
    const viteLog = fs.openSync(path.join(out, "live-vite.log"), "w");
    vite = cp.spawn(process.execPath, [path.join(path.dirname(frontendReq.resolve("vite/package.json")), "bin/vite.js"), "--host", "127.0.0.1", "--port", "50185", "--strictPort"], { cwd: path.join(root, "frontend"), env: viteEnv, windowsHide: true, stdio: ["ignore", viteLog, viteLog] });
    let ready = false; for (let i = 0; i < 100; i++) { if (vite.exitCode !== null) throw Error("Isolated Vite exited before ready"); try { if ((await fetch("http://127.0.0.1:50185")).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } assert(ready);
    save("live-ready.json", { database, frontend: "http://127.0.0.1:50185", apiOrigin, api: apiOrigin + "/api", syntheticOnly: true, coreHashBefore: coreHash, mockedApi: false, emailWorkerEnabled: false, startedAt: new Date().toISOString() });
    console.log("READY " + JSON.stringify({ database, frontend: "http://127.0.0.1:50185", apiOrigin }));
    await new Promise(resolve => { const timer = setInterval(() => { if (fs.existsSync(path.join(cache, "stop"))) { clearInterval(timer); resolve(); } }, 500); process.once("SIGINT", () => { clearInterval(timer); resolve(); }); process.once("SIGTERM", () => { clearInterval(timer); resolve(); }); });
  } finally { if (vite) vite.kill(); if (app) await app.close(); await db.$disconnect(); save("live-stopped.json", { stoppedAt: new Date().toISOString(), databaseRetained: database }); }
}
async function snapshot() {
  const runtime = JSON.parse(fs.readFileSync(path.join(cache, "runtime.json"), "utf8"));
  const url = testTarget(runtime.url); assert.equal(url.pathname, "/" + runtime.database);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    const [identity] = await db.$queryRawUnsafe("SELECT current_database() AS db"); assert.equal(identity.db, runtime.database);
    const states = {};
    for (const model of ["proposal", "proposalWorkflow", "proposalVersion", "proposalVersionWorkflow", "proposalReview", "proposalReviewWorkflow", "reviewComment", "proposalReviewDecision", "outboxEvent", "notification"])
      states[model] = await db[model].findMany();
    const counts = {};
    for (const model of ["thesisDossier", "dossierFinalization", "guidancePlan", "task", "progressReview", "finalResult"])
      counts[model] = await db[model].count();
    const coreAfter = hash(await coreSnapshot(db));
    save("live-database-snapshot.json", { database: runtime.database, coreHashBefore: runtime.coreHash, coreHashAfter: coreAfter, coreUnchanged: coreAfter === runtime.coreHash, states, counts, audit: await db.auditLog.findMany({ select: { id: true, userId: true, action: true, resource: true, resourceId: true, createdAt: true } }) });
    console.log(JSON.stringify({ snapshot: "saved", database: runtime.database, coreUnchanged: coreAfter === runtime.coreHash, counts }));
  } finally { await db.$disconnect(); }
}
const mode = process.argv[2];
(mode === "api" ? apiSuite() : mode === "live" ? liveServer() : mode === "snapshot" ? snapshot() : Promise.reject(Error("Use api/live/snapshot"))).catch(e => { console.error(redact(e.message)); process.exitCode = 1; });
