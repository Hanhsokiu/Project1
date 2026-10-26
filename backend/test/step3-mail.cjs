// Runs the actual compiled worker against PostgreSQL and local SMTP, scoped to an isolated fixture term.
require("reflect-metadata");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
for (const l of fs
  .readFileSync(path.resolve(__dirname, "../.env"), "utf8")
  .split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { PrismaService } = require("../dist/prisma/prisma.service"),
  {
    NotificationRepository,
  } = require("../dist/notification/repository/notification.repository"),
  {
    EmailWorkerService,
  } = require("../dist/notification/service/email-worker.service"),
  { ConfigService } = require("@nestjs/config");
const db = new PrismaService(),
  repo = new NotificationRepository(db);
const config = (values) =>
  new ConfigService({ EMAIL_WORKER_ENABLED: "true", ...values });
async function main() {
  const f = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../.cache/step3-fixture.json"),
      "utf8",
    ),
  );
  const actor = await db.userAccount.findUniqueOrThrow({
    where: { username: f.facultyUsername },
  });
  const term = await db.thesisTerm.create({
    data: {
      code: `S3-MAIL-${Date.now()}`,
      name: "Kiểm thử lỗi SMTP riêng",
      academicYear: "2026-2027",
      semester: 1,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
    },
  });
  const row = await db.emailOutbox.create({
    data: {
      termId: term.id,
      eventKey: `test-smtp:${term.id}`,
      userId: actor.id,
      recipient: "smtp_fixture@example.test",
      subject: "Kiểm thử retry Bước 3",
      payload: {
        lecturerName: "Giảng viên kiểm thử",
        termName: term.name,
        students: [
          {
            studentCode: "SMTP-FIXTURE",
            fullName: "Sinh viên tiếng Việt",
            className: "QA",
            email: "student@example.test",
            phone: "0912345678",
            direction: "Phần mềm",
          },
        ],
      },
    },
  });
  const history = [];
  await new EmailWorkerService(
    repo,
    config({ SMTP_HOST: "", SMTP_FROM: "" }),
  ).tick(term.id);
  let current = await db.emailOutbox.findUniqueOrThrow({
    where: { id: row.id },
  });
  assert.equal(current.status, "FAILED");
  assert.equal(current.attempts, 1);
  assert.match(current.lastError, /Thiếu cấu hình/);
  assert.equal(current.sentAt, null);
  history.push({
    case: "missing SMTP",
    status: current.status,
    attempts: current.attempts,
    error: current.lastError,
  });
  console.log("PASS missing SMTP configuration never produces SENT");
  await db.emailOutbox.update({
    where: { id: row.id },
    data: { availableAt: new Date(Date.now() - 1000) },
  });
  await new EmailWorkerService(
    repo,
    config({
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1026",
      SMTP_FROM: "gpms@example.test",
    }),
  ).tick(term.id);
  current = await db.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(current.status, "FAILED");
  assert.equal(current.attempts, 2);
  assert.match(current.lastError, /ECONNREFUSED|connect/i);
  history.push({
    case: "SMTP connection refused",
    status: current.status,
    attempts: current.attempts,
    error: current.lastError,
  });
  console.log(
    "PASS actual SMTP connection failure records error, attempt and retry time",
  );
  const base = "http://127.0.0.1:3010/api";
  const login = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: f.facultyUsername,
      password: "StepThree@2026",
    }),
  });
  assert.ok(login.ok);
  const auth = {
    Authorization: `Bearer ${(await login.json()).data.accessToken}`,
  };
  const retry = await fetch(base + `/notifications/outbox/${row.id}/retry`, {
    method: "POST",
    headers: auth,
  });
  assert.ok(retry.ok);
  current = await db.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(current.status, "PENDING");
  assert.equal(current.attempts, 0);
  const claims = await Promise.all([repo.claim(term.id), repo.claim(term.id)]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(claims.find(Boolean).id, row.id);
  console.log(
    "PASS retry API resets FAILED and parallel workers claim the event once",
  );
  await db.emailOutbox.update({
    where: { id: row.id },
    data: { lockedAt: new Date(Date.now() - 6 * 60000) },
  });
  const worker = new EmailWorkerService(
    repo,
    config({
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1025",
      SMTP_FROM: "gpms@example.test",
    }),
  );
  await worker.tick(term.id);
  current = await db.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(current.status, "SENT");
  assert.ok(current.sentAt);
  assert.ok(current.messageId.includes(row.id));
  history.push({
    case: "expired lease recovered; SMTP accepted",
    status: current.status,
    attempts: current.attempts,
    messageId: current.messageId,
    sentAt: current.sentAt,
  });
  const mail = await (
    await fetch("http://127.0.0.1:8025/api/v2/messages?limit=100")
  ).json();
  assert.equal(
    mail.items.filter((m) =>
      (m.Content.Headers["Message-ID"] ?? []).some((id) => id.includes(row.id)),
    ).length,
    1,
  );
  const attempts = current.attempts;
  await worker.tick(term.id);
  assert.equal(
    (await db.emailOutbox.findUniqueOrThrow({ where: { id: row.id } }))
      .attempts,
    attempts,
  );
  console.log(
    "PASS expired lease recovers, MailHog accepts actual mail, SENT is not resent",
  );
  const published = await db.assignmentPlan.findFirst({
    where: { termId: f.termId, status: "PUBLISHED" },
  });
  assert.ok(published);
  console.log(
    "PASS SMTP failures did not affect the already published assignment",
  );
  fs.writeFileSync(
    path.resolve(
      __dirname,
      "../../docs/implementation/step3-evidence/smtp-retry.json",
    ),
    JSON.stringify({ termId: term.id, outboxId: row.id, history }, null, 2),
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
