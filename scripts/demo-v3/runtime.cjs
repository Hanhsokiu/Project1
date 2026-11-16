"use strict";
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  local = require("./local.cjs"),
  { manifest, date, id } = require("./definition.cjs");
const NativeDate = Date;
let virtual = null;
function clock(value) {
  virtual = value === null ? null : NativeDate.parse(value);
  assert(virtual === null || Number.isFinite(virtual));
}
async function runtime(port = 0) {
  const cfg = local.configuration(),
    url = local.connection(cfg);
  local.safeTarget(url);
  const keep = local.sanitizedEnvironment();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, keep, {
    DATABASE_URL: url,
    DIRECT_URL: url,
    NODE_ENV: "test",
    JWT_SECRET: cfg.jwt,
    JWT_REFRESH_SECRET: cfg.jwt + "-refresh",
    EMAIL_WORKER_ENABLED: "false",
    GUIDANCE_REMINDERS_ENABLED: "false",
    GUIDANCE_UPLOAD_ENABLED: "true",
    API_PREFIX: "api",
    STORAGE_LOCAL_PATH: local.storageRoot,
    STORAGE_GUIDANCE_DRIVER: "local",
    MAIL_HOST: "127.0.0.1",
    MAIL_PORT: "9",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "9",
    FRONTEND_URL: "http://127.0.0.1:5183",
  });
  for (let i = 17; i <= 25; i++) process.env[`UC${i}_WRITES_ENABLED`] = "true";
  global.Date = class DemoDate extends NativeDate {
    constructor(...args) {
      super(
        ...(args.length
          ? args
          : [virtual === null ? NativeDate.now() : virtual]),
      );
    }
    static now() {
      return virtual === null ? NativeDate.now() : virtual;
    }
  };
  local.req("reflect-metadata");
  const { ConfigModule } = local.req("@nestjs/config"),
    original = ConfigModule.forRoot;
  // Prevent AppModule from opening backend/.env, even though all seed values are explicit.
  ConfigModule.forRoot = function (options) {
    return original.call(this, { ...options, ignoreEnvFile: true });
  };
  const { AppModule } = local.req("./dist/app.module");
  ConfigModule.forRoot = original;
  const { Test } = local.req("@nestjs/testing"),
    { SchedulerRegistry } = local.req("@nestjs/schedule");
  const builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [file, name] of [
    [
      "registration/service/assignment-scheduler.service",
      "AssignmentSchedulerService",
    ],
    ["notification/service/email-worker.service", "EmailWorkerService"],
    ["guidance/weekly/weekly-notification.worker", "WeeklyNotificationWorker"],
  ])
    builder.overrideProvider(local.req("./dist/" + file)[name]).useValue({});
  const module = await builder.compile(),
    app = module.createNestApplication({ logger: false, bodyParser: false });
  module.get(
    local.req("./dist/guidance/submissions/submission.service")
      .SubmissionService,
  ).cleanup = async () => undefined;
  const db = module.get(
    local.req("./dist/prisma/prisma.service").PrismaService,
  );
  await local.identity(db);
  // Seed-only application clock: stamp ORM defaults as well as service events.
  const models = local.req("@prisma/client").Prisma.dmmf.datamodel.models;
  function stamp(modelName, data) {
    if (!data || typeof data !== "object") return;
    const model = models.find((m) => m.name === modelName);
    if (!model) return;
    const now = new Date();
    for (const field of model.fields) {
      if (
        field.type === "DateTime" &&
        (field.name === "createdAt" ||
          field.name === "updatedAt" ||
          field.default?.name === "now") &&
        data[field.name] === undefined
      )
        data[field.name] = now;
    }
    for (const field of model.fields.filter((f) => f.kind === "object")) {
      const rel = data[field.name];
      if (rel?.create)
        for (const value of Array.isArray(rel.create)
          ? rel.create
          : [rel.create])
          stamp(field.type, value);
      if (rel?.createMany?.data)
        for (const value of Array.isArray(rel.createMany.data)
          ? rel.createMany.data
          : [rel.createMany.data])
          stamp(field.type, value);
    }
  }
  db.$use(async (params, next) => {
    if (virtual !== null && params.model) {
      if (params.action === "create") stamp(params.model, params.args.data);
      if (params.action === "createMany")
        for (const row of Array.isArray(params.args.data)
          ? params.args.data
          : [params.args.data])
          stamp(params.model, row);
      if (params.action === "upsert") stamp(params.model, params.args.create);
      // Prisma's @updatedAt uses its engine wall clock, not the JS Date override.
      // Stamp updates before producers seal their snapshots, never rewrite saved history.
      const update = params.action === "upsert" ? params.args.update : ["update","updateMany"].includes(params.action) ? params.args.data : null;
      if (update) for (const field of models.find(m=>m.name === params.model)?.fields || [])
        if (field.isUpdatedAt && update[field.name] === undefined) update[field.name] = new Date();
    }
    return next(params);
  });
  local.req("./dist/common/http/body-parsers").configureBodyParsers(app, "api");
  app.setGlobalPrefix("api");
  app.enableCors({ origin: ["http://127.0.0.1:5183"], credentials: true });
  app.useGlobalFilters(
    new (local.req(
      "./dist/common/exception/global-exception.handler",
    ).GlobalExceptionHandler)(),
  );
  app.getHttpAdapter().get("/api/demo-v3/status", (_request, response) =>
    response.json({
      kind: "LOCAL_SYNTHETIC_TEST",
      database: local.database,
      productionConnected: false,
      workers: 0,
      clock: new Date().toISOString(),
    }),
  );
  await app.init();
  assert.equal(
    module.get(SchedulerRegistry).getIntervals().length,
    0,
    "Background workers must be disabled",
  );
  await app.listen(port, "127.0.0.1");
  return {
    app,
    db,
    clock,
    module,
    api: "http://127.0.0.1:" + app.getHttpServer().address().port + "/api",
    service: (file, name) => module.get(local.req("./dist/" + file)[name]),
  };
}
async function serve() {
  clock(null);
  const r = await runtime(3083);
  console.log(
    JSON.stringify({
      api: r.api,
      database: local.database,
      productionConnected: false,
    }),
  );
  process.on("SIGINT", () => r.app.close().finally(() => process.exit(0)));
}
module.exports = { runtime, clock, serve, NativeDate };
