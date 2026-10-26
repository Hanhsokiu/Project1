const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
for (const line of fs
  .readFileSync(path.resolve(__dirname, "../.env"), "utf8")
  .split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../.cache/step2-fixture.json"),
    "utf8",
  ),
);
const snapshotPath = path.resolve(
  __dirname,
  "../../.cache/step2-before-restart.json",
);
const db = new PrismaClient();
const base = process.env.TEST_API_URL || "http://127.0.0.1:3010/api";
async function registration() {
  const row = await db.registration.findUniqueOrThrow({
    where: { id: fixture.registrationId },
    include: { preferences: { orderBy: { preferenceOrder: "asc" } } },
  });
  return JSON.parse(JSON.stringify(row));
}
async function http(url, method = "GET", body, token) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(response.ok, `HTTP ${response.status} ${url}`);
  return (await response.json()).data;
}
async function main() {
  if (process.argv[2] === "record") {
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify(await registration(), null, 2),
    );
    console.log(
      "Recorded registration, preferences and timestamps before backend restart (no credentials).",
    );
    return;
  }
  assert.deepEqual(
    await registration(),
    JSON.parse(fs.readFileSync(snapshotPath, "utf8")),
  );
  const student = await http("/auth/login", "POST", {
    username: fixture.studentCode,
    password: "StepTwo@2026",
  });
  const own = await http(
    `/registrations/term/${fixture.termId}/me`,
    "GET",
    undefined,
    student.accessToken,
  );
  assert.equal(own.registration.id, fixture.registrationId);
  assert.equal(own.registration.status, "SUBMITTED");
  const faculty = await http("/auth/login", "POST", {
    username: fixture.facultyUsername,
    password: "StepTwo@2026",
  });
  const list = await http(
    `/registrations/term/${fixture.termId}`,
    "GET",
    undefined,
    faculty.accessToken,
  );
  assert.ok(list.items.some((r) => r.id === fixture.registrationId));
  console.log(
    "PASS backend restart preserves registration, ordered preferences and exact timestamps for student/faculty HTTP sessions.",
  );
  const before = await db.userAccount.findUniqueOrThrow({
    where: { username: fixture.studentCode },
  });
  const seed = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "../prisma/seed.cjs")],
    { cwd: path.resolve(__dirname, ".."), encoding: "utf8", env: process.env },
  );
  assert.equal(seed.status, 0, "Seed must complete without resetting data");
  const after = await db.userAccount.findUniqueOrThrow({
    where: { id: before.id },
  });
  assert.equal(after.passwordHash, before.passwordHash);
  assert.equal(after.mustChangePassword, false);
  assert.equal(after.email, before.email);
  assert.equal(after.phone, before.phone);
  assert.deepEqual(
    await registration(),
    JSON.parse(fs.readFileSync(snapshotPath, "utf8")),
  );
  console.log(
    "PASS rerunning seed preserves changed password hash, contact, mustChangePassword and registration.",
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
