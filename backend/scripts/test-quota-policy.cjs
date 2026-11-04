"use strict";
// Creates a fresh database on the owned loopback UI PostgreSQL instance only.
// Never consumes DATABASE_URL/DIRECT_URL from application .env files.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const backend = path.join(root, "backend");
const config = JSON.parse(
  fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8"),
);
const database = `btl_pr2b_quota_${crypto.randomBytes(6).toString("hex")}`;
if (!/^btl_pr2b_quota_[a-f0-9]{12}$/.test(database))
  throw Error("Invalid test database name");
const baseUrl = new URL("postgresql://btl_ui@127.0.0.1:55451/postgres");
baseUrl.password = config.password;
const target = new URL(baseUrl);
target.pathname = `/${database}`;
process.env.DATABASE_URL = target.toString();
process.env.DIRECT_URL = target.toString();
process.env.JWT_SECRET = crypto.randomBytes(24).toString("hex");
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(24).toString("hex");
process.env.EMAIL_WORKER_ENABLED = "false";
process.env.NODE_ENV = "test";
process.env.STORAGE_LOCAL_PATH = path.join(
  root,
  ".cache/quota-verification/uploads",
);
const { PrismaClient } = require("@prisma/client");
const owner = new PrismaClient({
  datasources: { db: { url: baseUrl.toString() } },
});
const db = new PrismaClient({
  datasources: { db: { url: target.toString() } },
});
const cache = path.join(root, ".cache/quota-verification", database);
fs.mkdirSync(path.join(cache, "migrations"), { recursive: true });
fs.copyFileSync(
  path.join(backend, "prisma/schema.prisma"),
  path.join(cache, "schema.prisma"),
);
fs.copyFileSync(
  path.join(backend, "prisma/migrations/migration_lock.toml"),
  path.join(cache, "migrations/migration_lock.toml"),
);
const migrations = fs
  .readdirSync(path.join(backend, "prisma/migrations"))
  .filter((n) =>
    fs.existsSync(path.join(backend, "prisma/migrations", n, "migration.sql")),
  )
  .sort();
const last = "202611040001_lecturer_quota_policy";
assert.equal(migrations.at(-1), last);
function copy(name) {
  fs.cpSync(
    path.join(backend, "prisma/migrations", name),
    path.join(cache, "migrations", name),
    { recursive: true },
  );
}
function deploy() {
  const result = spawnSync(
    process.execPath,
    [
      require.resolve("prisma/build/index.js"),
      "migrate",
      "deploy",
      "--schema",
      path.join(cache, "schema.prisma"),
    ],
    {
      cwd: backend,
      env: process.env,
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
    },
  );
  if (result.error || result.status !== 0)
    throw Error(
      "Isolated migration failed: " +
        String(result.stderr || result.stdout)
          .replaceAll(config.password, "[REDACTED]")
          .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_URL]"),
    );
}
async function main() {
  let app;
  const checks = [];
  try {
    await owner.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    migrations.filter((n) => n !== last).forEach(copy);
    deploy();
    const legacy = crypto.randomUUID(),
      legacyUser = crypto.randomUUID(),
      legacyDep = crypto.randomUUID(),
      legacyLecturer = crypto.randomUUID();
    await db.$executeRawUnsafe(
      "INSERT INTO \"THESIS_TERM\" (id,code,name,academic_year,semester,start_date,end_date,updated_at) VALUES ($1,$2,$3,$4,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days',CURRENT_TIMESTAMP)",
      legacy,
      "LEGACY-QUOTA",
      "Legacy quota fixture",
      "2026-2027",
    );
    await db.$executeRawUnsafe(
      'INSERT INTO "USER_ACCOUNT" (id,username,password_hash,updated_at) VALUES ($1,$2,$3,CURRENT_TIMESTAMP)',
      legacyUser,
      "legacy-quota",
      "test-only",
    );
    await db.$executeRawUnsafe(
      'INSERT INTO "DEPARTMENT" (id,code,name,updated_at) VALUES ($1,$2,$3,CURRENT_TIMESTAMP)',
      legacyDep,
      "LEGACY",
      "Legacy department",
    );
    await db.$executeRawUnsafe(
      'INSERT INTO "LECTURER" (id,user_id,lecturer_code,full_name,department_id,max_students,updated_at) VALUES ($1,$2,$3,$4,$5,13,CURRENT_TIMESTAMP)',
      legacyLecturer,
      legacyUser,
      "LEGACY",
      "Legacy lecturer",
      legacyDep,
    );
    await db.$executeRawUnsafe(
      'INSERT INTO "TERM_LECTURER" (term_id,lecturer_id,quota) VALUES ($1,$2,13)',
      legacy,
      legacyLecturer,
    );
    copy(last);
    deploy();
    deploy();
    assert.equal(
      (await db.thesisTerm.findUniqueOrThrow({ where: { id: legacy } }))
        .quotaPolicy,
      null,
    );
    assert.equal(
      (
        await db.termLecturer.findUniqueOrThrow({
          where: {
            termId_lecturerId: { termId: legacy, lecturerId: legacyLecturer },
          },
        })
      ).quota,
      13,
    );
    assert.equal(
      (await db.lecturer.findUniqueOrThrow({ where: { id: legacyLecturer } }))
        .academicDegree,
      null,
    );
    checks.push(
      "populated migration preserves legacy quotas; deploy is idempotent",
    );
    const bcrypt = require("bcryptjs"),
      password = "QuotaTest@2026",
      passwordHash = await bcrypt.hash(password, 4);
    const role = await db.role.create({
      data: {
        name: "ADMIN",
        rolePermissions: {
          create: [
            "term:read",
            "term:create",
            "term:roster",
            "assignment:manage",
            "catalog:read",
            "student:read",
            "lecturer:read",
            "account:read",
            "notification:read",
          ].map((key) => {
            const [resource, action] = key.split(":");
            return {
              permission: {
                connectOrCreate: {
                  where: { resource_action: { resource, action } },
                  create: { resource, action },
                },
              },
            };
          }),
        },
      },
    });
    const admin = await db.userAccount.create({
      data: {
        username: "quota-test-admin",
        passwordHash,
        status: "ACTIVE",
        mustChangePassword: false,
        userRoles: { create: { roleId: role.id } },
      },
    });
    const outsider = await db.userAccount.create({
      data: {
        username: "quota-test-outsider",
        passwordHash,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });
    const system = await db.trainingSystem.create({
      data: { code: "QUOTA", name: "Quota test" },
    });
    const department = await db.department.create({
      data: { code: "QUOTA", name: "Quota department" },
    });
    const area = await db.researchArea.create({
      data: { name: "Quota specialty" },
    });
    const start = new Date(Date.now() - 86400000),
      end = new Date(Date.now() + 30 * 86400000);
    const semester = await db.academicSemester.create({
      data: {
        academicYear: "2026-2027",
        semester: 1,
        name: "Quota semester",
        startDate: new Date(start.getTime() - 86400000),
        endDate: new Date(end.getTime() + 86400000),
      },
    });
    const lecturers = [],
      students = [];
    for (let i = 0; i < 10; i++)
      lecturers.push(
        await db.lecturer.create({
          data: {
            lecturerCode: `GV${String(i).padStart(2, "0")}`,
            fullName: `Giảng viên ${i}`,
            academicDegree: "MASTER",
            department: { connect: { id: department.id } },
            researchAreas: { create: { researchAreaId: area.id } },
            user: {
              create: {
                username: `gv${i}`,
                passwordHash,
                status: "ACTIVE",
                mustChangePassword: false,
                email: `gv${i}@example.test`,
                phone: "0912345678",
              },
            },
          },
        }),
      );
    for (let i = 0; i < 60; i++)
      students.push(
        await db.student.create({
          data: {
            studentCode: `SV${String(i).padStart(3, "0")}`,
            fullName: `Sinh viên ${i}`,
            className: "QUOTA",
            trainingSystem: { connect: { id: system.id } },
            gpa: 3.2,
            user: {
              create: {
                username: `sv${i}`,
                passwordHash,
                status: "ACTIVE",
                mustChangePassword: false,
                email: `sv${i}@example.test`,
                phone: "0912345678",
              },
            },
          },
        }),
      );
    require("reflect-metadata");
    const { NestFactory } = require("@nestjs/core"),
      { AppModule } = require("../dist/app.module"),
      {
        GlobalExceptionHandler,
      } = require("../dist/common/exception/global-exception.handler");
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.listen(0, "127.0.0.1");
    const address = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
    const request = async (route, method = "GET", body, token) => {
      const response = await fetch(address + route, {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const login = await request("/auth/login", "POST", {
      username: admin.username,
      password,
    });
    assert.equal(login.status, 201);
    const token = login.body.data.accessToken;
    const otherLogin = await request("/auth/login", "POST", {
      username: outsider.username,
      password,
    });
    const create = await request(
      "/terms",
      "POST",
      {
        code: "QUOTA-TEST",
        name: "Đợt kiểm thử chỉ tiêu",
        semesterId: semester.id,
        trainingSystemId: system.id,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      token,
    );
    assert.equal(create.status, 201, JSON.stringify(create.body));
    const id = create.body.data.id;
    assert.equal(create.body.data.quotaReady, false);
    const pathFor = `/terms/${id}`;
    const roster = {
      studentIds: students.map((s) => s.id),
      lecturers: lecturers.map((l) => ({ lecturerId: l.id, quota: 1 })),
    };
    const saved = await request(pathFor + "/roster", "PUT", roster, token);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const { defaultQuotaSettings } = require("@doan/shared");
    const input = { revision: 0, settings: defaultQuotaSettings, limits: [] };
    assert.equal(
      (await request(pathFor + "/quotas/preview", "POST", input)).status,
      401,
    );
    assert.equal(
      (
        await request(
          pathFor + "/quotas/preview",
          "POST",
          input,
          otherLogin.body.data.accessToken,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          pathFor + "/quotas/preview",
          "POST",
          {
            ...input,
            settings: { ...defaultQuotaSettings, defaultLimit: 1.5 },
          },
          token,
        )
      ).status,
      400,
    );
    checks.push("HTTP authentication, authorization and input validation");
    const preview = await request(
      pathFor + "/quotas/preview",
      "POST",
      input,
      token,
    );
    assert.equal(preview.status, 201, JSON.stringify(preview.body));
    const p = preview.body.data;
    assert.equal(p.totalCoefficient, 7.5);
    assert.equal(p.averageCoefficient, 0.75);
    assert(p.members.every((m) => m.suggestedQuota === 6));
    assert(
      (await db.termLecturer.findMany({ where: { termId: id } })).every(
        (l) => l.quota === 1,
      ),
    );
    await db.lecturer.update({
      where: { id: lecturers[0].id },
      data: { academicDegree: "DOCTOR" },
    });
    const approval = (policy) => ({
      revision: policy.revision,
      members: policy.members.map((m) => ({
        lecturerId: m.lecturerId,
        quota: m.suggestedQuota,
        reason: "",
      })),
    });
    assert.equal(
      (await request(pathFor + "/quotas/approve", "POST", approval(p), token))
        .status,
      409,
    );
    await db.lecturer.update({
      where: { id: lecturers[0].id },
      data: { academicDegree: "MASTER" },
    });
    const second = await request(
      pathFor + "/quotas/preview",
      "POST",
      { ...input, revision: p.revision },
      token,
    );
    assert.equal(second.status, 201);
    const parallel = await Promise.all([
      request(
        pathFor + "/quotas/approve",
        "POST",
        approval(second.body.data),
        token,
      ),
      request(
        pathFor + "/quotas/approve",
        "POST",
        approval(second.body.data),
        token,
      ),
    ]);
    assert.deepEqual(parallel.map((r) => r.status).sort(), [201, 409]);
    assert(
      (await db.termLecturer.findMany({ where: { termId: id } })).every(
        (l) => l.quota === 6,
      ),
    );
    assert.equal(
      await db.auditLog.count({
        where: { resourceId: id, action: "QUOTA_APPROVED" },
      }),
      1,
    );
    assert.equal(
      (await request(pathFor, "GET", undefined, token)).body.data.quotaReady,
      true,
    );
    assert(
      (
        await request(
          pathFor + "/roster",
          "PUT",
          {
            ...roster,
            lecturers: lecturers.map((l) => ({ lecturerId: l.id, quota: 7 })),
          },
          token,
        )
      ).status >= 400,
      "Generic roster endpoint must not bypass quota approval",
    );
    checks.push(
      "10 masters / 60 students; stale preview rejected; concurrent approval writes once with audit",
    );
    if (process.argv.includes("--browser")) {
      await browserCheck(address, id, login.body.data);
      checks.push(
        "real browser: calculate, approve, preserve roster state and render mobile without page errors",
      );
    }
    // A failed audit must roll the preview back together with the policy update.
    const { QuotaService } = require("../dist/term/service/quota.service");
    const beforeRollback = await db.thesisTerm.findUniqueOrThrow({
      where: { id },
    });
    await assert.rejects(
      app
        .get(QuotaService)
        .preview(
          id,
          { ...input, revision: beforeRollback.quotaPolicy.revision },
          crypto.randomUUID(),
        ),
    );
    assert.deepEqual(
      (await db.thesisTerm.findUniqueOrThrow({ where: { id } })).quotaPolicy,
      beforeRollback.quotaPolicy,
    );
    checks.push("failed audit rolls policy writes back atomically");
    // Registration and assignment remain a separate review/publication workflow.
    await db.thesisTerm.update({
      where: { id },
      data: { status: "CLOSED_REGISTRATION" },
    });
    await db.termPhase.updateMany({
      where: { termId: id, code: "REGISTRATION" },
      data: {
        startDate: new Date(Date.now() - 3 * 86400000),
        endDate: new Date(Date.now() - 86400000),
      },
    });
    await db.termPhase.updateMany({
      where: { termId: id, code: "ASSIGNMENT" },
      data: {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
      },
    });
    for (const student of students)
      await db.registration.create({
        data: {
          termId: id,
          studentId: student.id,
          directionId: area.id,
          status: "SUBMITTED",
          submittedAt: new Date(),
          preferences: {
            create: { lecturerId: lecturers[0].id, preferenceOrder: 1 },
          },
        },
      });
    const run = { revision: 0, mode: "remaining", confirmed: false };
    const planPreview = await request(
      `/assignments/term/${id}/preview`,
      "POST",
      run,
      token,
    );
    assert.equal(planPreview.status, 201, JSON.stringify(planPreview.body));
    const plan = await request(
      `/assignments/term/${id}/draft`,
      "PUT",
      { ...run, inputHash: planPreview.body.data.inputHash },
      token,
    );
    assert.equal(plan.status, 200, JSON.stringify(plan.body));
    assert.equal(
      plan.body.data.assignments.length,
      60,
      JSON.stringify(plan.body.data.results.slice(0, 3)),
    );
    const invalidated = await request(
      pathFor + "/quotas/preview",
      "POST",
      { ...input, revision: beforeRollback.quotaPolicy.revision },
      token,
    );
    assert.equal(invalidated.status, 201);
    const blocked = await request(
      `/assignments/term/${id}/publish`,
      "POST",
      { revision: plan.body.data.plan.revision },
      token,
    );
    assert.equal(blocked.status, 409);
    const restored = await request(
      pathFor + "/quotas/approve",
      "POST",
      approval(invalidated.body.data),
      token,
    );
    assert.equal(restored.status, 201, JSON.stringify(restored.body));
    const published = await request(
      `/assignments/term/${id}/publish`,
      "POST",
      { revision: plan.body.data.plan.revision },
      token,
    );
    assert.equal(published.status, 201, JSON.stringify(published.body));
    assert.equal(
      (
        await request(
          pathFor + "/quotas/preview",
          "POST",
          { ...input, revision: restored.body.data.revision },
          token,
        )
      ).status,
      422,
    );
    checks.push(
      "60 students assigned using approved quotas; publication blocked during quota review; published policy protected",
    );
    const result = {
      result: "PASS",
      database,
      checks,
      migrations: migrations.length,
      apiBase: address,
      termId: id,
    };
    fs.writeFileSync(
      path.join(root, ".cache/quota-verification/result.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (app) await app.close();
    await db.$disconnect();
    await owner.$disconnect();
  }
}
async function browserCheck(apiBase, termId, login) {
  const { spawn } = require("node:child_process");
  const { chromium, expect } = require("@playwright/test");
  const frontend = path.join(root, "frontend"),
    origin = "http://127.0.0.1:50882";
  const vite = spawn(
    process.execPath,
    [
      path.join(
        path.dirname(
          require.resolve("vite/package.json", { paths: [frontend] }),
        ),
        "bin/vite.js",
      ),
      "--host",
      "127.0.0.1",
      "--port",
      "50882",
      "--strictPort",
    ],
    {
      cwd: frontend,
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        VITE_API_URL: "/api",
        VITE_AUTH_API: "true",
        VITE_TERM_API: "true",
        VITE_CATALOG_API: "true",
        VITE_IMPORT_API: "true",
        VITE_REGISTRATION_API: "false",
      },
    },
  );
  let browser;
  try {
    let available = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(origin)).ok) {
          available = true;
          break;
        }
      } catch {
        /* Wait for the isolated Vite process. */
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(available, "Isolated Vite did not start");
    const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
    browser = await chromium.launch({
      headless: true,
      ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route(
      (url) => url.pathname.startsWith("/api/"),
      async (route) => {
        const requested = new URL(route.request().url());
        const response = await route.fetch({
          url: apiBase + requested.pathname.slice(4) + requested.search,
        });
        await route.fulfill({ response });
      },
    );
    await context.addInitScript(
      ({ login, termId }) => {
        sessionStorage.setItem("utc-api-access", login.accessToken);
        sessionStorage.setItem("utc-api-refresh", login.refreshToken);
        sessionStorage.setItem(
          "utc-api-user",
          JSON.stringify({
            ...login.user,
            email: login.user.email || "",
            password: "",
          }),
        );
        sessionStorage.setItem("utc-workspace", JSON.stringify({ termId }));
      },
      { login, termId },
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${origin}/terms/${termId}/roster?tab=lecturers`);
    await expect(
      page.getByRole("button", { name: "Tính chỉ tiêu đề xuất", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    await page
      .getByRole("button", { name: "Tính chỉ tiêu đề xuất", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Chốt chỉ tiêu hướng dẫn",
        exact: true,
      }),
    ).toBeEnabled({ timeout: 20000 });
    assert.equal(
      await page.getByRole("spinbutton", { name: /^Quota chốt GV/ }).count(),
      10,
    );
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "Quota chốt GV00", exact: true })
        .inputValue(),
      "6",
    );
    await page
      .getByRole("button", { name: "Chốt chỉ tiêu hướng dẫn", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Xác nhận/ })
      .click();
    await expect(
      page.getByText("Đã chốt chỉ tiêu", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await page.screenshot({
      path: path.join(root, ".cache/quota-verification/desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(root, ".cache/quota-verification/mobile.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}
main().catch((error) => {
  console.error(
    String(error.stack || error)
      .replaceAll(config.password, "[REDACTED]")
      .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_URL]"),
  );
  process.exitCode = 1;
});
