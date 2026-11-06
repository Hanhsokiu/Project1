const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
for (const l of fs
  .readFileSync(path.resolve(__dirname, "../.env"), "utf8")
  .split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { PrismaClient } = require("@prisma/client"),
  db = new PrismaClient();
const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../.cache/step3-fixture.json"),
    "utf8",
  ),
);
const file = path.resolve(__dirname, "../../.cache/step3-before-restart.json");
async function snapshot() {
  const plan = await db.assignmentPlan.findFirstOrThrow({
    where: { termId: fixture.termId, status: "PUBLISHED" },
    include: { advisorAssignments: { orderBy: { registrationId: "asc" } } },
  });
  return JSON.parse(
    JSON.stringify({
      plan,
      proposals: await db.proposal.findMany({
        where: { termId: fixture.termId },
        include: { topic: true, versions: { orderBy: { version: "asc" } } },
        orderBy: { id: "asc" },
      }),
      outbox: await db.emailOutbox.findMany({
        where: { termId: fixture.termId },
        orderBy: { id: "asc" },
      }),
    }),
  );
}
async function main() {
  const current = await snapshot();
  if (process.argv[2] === "record") {
    fs.writeFileSync(file, JSON.stringify(current, null, 2));
    console.log("Recorded exact Step3 DB state before restart.");
    return;
  }
  assert.deepEqual(current, JSON.parse(fs.readFileSync(file, "utf8")));
  for (const username of [
    fixture.facultyUsername,
    fixture.studentCodes[0],
    fixture.lecturerCodes[0],
  ]) {
    const r = await fetch("http://127.0.0.1:3010/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "StepThree@2026" }),
    });
    assert.ok(r.ok);
    const token = (await r.json()).data.accessToken;
    const result = await fetch(
      `http://127.0.0.1:3010/api/assignments/term/${fixture.termId}/results`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.ok(result.ok);
    assert.equal((await result.json()).data.plan.id, current.plan.id);
  }
  console.log(
    "PASS backend restart preserves exact published plan, assignments, topic versions and SMTP states; fresh faculty/student/lecturer logins read DB.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
