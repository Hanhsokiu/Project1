"use strict";
// Synthetic preview accounts only, on the dedicated UI database.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
const directory = path.join(root, ".cache/integration-ui");
const config = JSON.parse(
  fs.readFileSync(path.join(directory, "config.json"), "utf8"),
);
const url = `postgresql://btl_ui:${config.password}@127.0.0.1:55451/btl_integration_ui`;
const marker = path.join(directory, "sample.json");
async function configureScope(fixture) {
  if (fixture.scopeConfigured) return;
  const { PrismaClient } = require("../backend/node_modules/@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$transaction(async (tx) => {
      const faculty = await tx.userAccount.findUniqueOrThrow({
        where: { username: "giaovu" },
      });
      const lecturer = await tx.lecturer.findUniqueOrThrow({
        where: { id: fixture.lecturerIds[0] },
      });
      const grant = await tx.academicTermGrant.upsert({
        where: {
          userId_termId: { userId: faculty.id, termId: fixture.termId },
        },
        create: {
          userId: faculty.id,
          termId: fixture.termId,
          allDepartments: false,
        },
        update: {},
      });
      await tx.grantDepartment.createMany({
        data: [{ grantId: grant.id, departmentId: lecturer.departmentId }],
        skipDuplicates: true,
      });
      await tx.researchAreaWorkflow.upsert({
        where: { researchAreaId: fixture.directionId },
        create: {
          researchAreaId: fixture.directionId,
          departmentId: lecturer.departmentId,
        },
        update: {},
      });
      for (const [code, key] of [
        ["PROPOSAL", "PROPOSAL_EDIT"],
        ["WEEKLY", "GUIDANCE"],
      ]) {
        const phase = await tx.termPhase.findUniqueOrThrow({
          where: { termId_code: { termId: fixture.termId, code } },
        });
        await tx.termPhaseWorkflow.upsert({
          where: { phaseId: phase.id },
          create: { phaseId: phase.id, termId: fixture.termId, key },
          update: {},
        });
      }
    });
    fs.writeFileSync(
      marker,
      JSON.stringify({ ...fixture, scopeConfigured: true }, null, 2),
    );
  } finally {
    await db.$disconnect();
  }
}
async function main() {
  if (fs.existsSync(marker)) {
    await configureScope(JSON.parse(fs.readFileSync(marker, "utf8")));
    console.log("Keep existing UI sample accounts and data.");
    return;
  }
  const generated = path.join(root, ".cache/step3-browser-fixture.json");
  const previous = fs.existsSync(generated) ? fs.readFileSync(generated) : null;
  let fixture;
  try {
    const result = cp.spawnSync(
      process.execPath,
      [path.join(root, "backend/test/step3-http.cjs"), "--browser-fixture"],
      {
        cwd: path.join(root, "backend"),
        windowsHide: true,
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL: url,
          DIRECT_URL: url,
          TEST_API_URL: "http://127.0.0.1:3000/api",
        },
      },
    );
    if (result.error || result.status !== 0)
      throw new Error("UI sample creation failed; inspect the local API log.");
    fixture = JSON.parse(fs.readFileSync(generated, "utf8"));
  } finally {
    if (previous) fs.writeFileSync(generated, previous);
    else if (fs.existsSync(generated)) fs.unlinkSync(generated);
  }
  const { PrismaClient } = require("../backend/node_modules/@prisma/client");
  const bcrypt = require("../backend/node_modules/bcryptjs");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const passwordHash = await bcrypt.hash("Demo@2026", 10);
    const aliases = [
      { from: fixture.facultyUsername, to: "giaovu" },
      ...fixture.studentCodes.map((from, i) => ({ from, to: `sv00${i + 1}` })),
      ...fixture.lecturerCodes.map((from, i) => ({ from, to: `gv00${i + 1}` })),
    ];
    await db.$transaction(async (tx) => {
      for (const { from, to } of aliases)
        await tx.userAccount.update({
          where: { username: from },
          data: { username: to, passwordHash, phone: "0912345678" },
        });
      const start = Date.now() - 86400000,
        step = 30 * 86400000;
      await tx.thesisTerm.update({
        where: { id: fixture.termId },
        data: {
          name: "Đợt mẫu kiểm tra giao diện sau merge",
          startDate: new Date(start),
          endDate: new Date(start + step * 6),
        },
      });
      for (const [i, code] of [
        "REGISTRATION",
        "ASSIGNMENT",
        "PROPOSAL",
        "WEEKLY",
        "FINAL",
        "DEFENSE",
      ].entries())
        await tx.termPhase.upsert({
          where: { termId_code: { termId: fixture.termId, code } },
          create: {
            termId: fixture.termId,
            code,
            phaseName: code,
            startDate: new Date(start + step * i),
            endDate: new Date(start + step * (i + 1)),
          },
          update: {
            startDate: new Date(start + step * i),
            endDate: new Date(start + step * (i + 1)),
          },
        });
    });
    fs.writeFileSync(
      marker,
      JSON.stringify(
        { ...fixture, aliases: aliases.map((x) => x.to) },
        null,
        2,
      ),
    );
    await configureScope(JSON.parse(fs.readFileSync(marker, "utf8")));
    console.log(
      "Created synthetic UI accounts: admin, giaovu, sv001-sv004, gv001-gv004. Local preview password: Demo@2026",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
