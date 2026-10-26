const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("node:fs");
const path = require("node:path");
if (!process.env.DATABASE_URL) {
  const file = path.resolve(__dirname, "../.env");
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
}
const prisma = new PrismaClient();
const resources = {
  term: [
    "read",
    "create",
    "update",
    "transition",
    "lock",
    "roster",
    "plan",
    "parameters",
  ],
  catalog: ["read", "manage"],
  student: ["read", "create", "update", "import"],
  lecturer: ["read", "create", "update", "import"],
  audit: ["read"],
  account: ["read", "create", "update", "lock"],
  registration: ["read", "own"],
  assignment: ['read','manage'],
  topic: ['read','write','agree'],
  notification: ['own'],
};
async function main() {
  const roles = {};
  for (const name of ["ADMIN", "FACULTY", "LECTURER", "STUDENT", "COMMITTEE"])
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: name === "FACULTY" ? "Giáo vụ Khoa" : name },
    });
  for (const [resource, actions] of Object.entries(resources))
    for (const action of actions) {
      const permission = await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
      for (const [name, role] of Object.entries(roles)) {
        const can =
          (name === "ADMIN" && resource !== "registration") ||
          (name === "FACULTY" &&
            resource !== "account" &&
            resource !== "registration") ||
          (resource === "registration" &&
            ((action === "read" && ["ADMIN", "FACULTY"].includes(name)) ||
              (action === "own" && name === "STUDENT"))) ||
          (['STUDENT','LECTURER'].includes(name) &&
            ((resource==='assignment'&&action==='read') || (resource==='topic'&&['read','write'].includes(action)) || (resource==='topic'&&action==='agree'&&name==='LECTURER') || (resource==='notification'&&action==='own'))) ||
          (["LECTURER", "STUDENT", "COMMITTEE"].includes(name) &&
            ["term:read", "catalog:read", "lecturer:read"].includes(
              `${resource}:${action}`,
            ));
        if (can)
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: { roleId: role.id, permissionId: permission.id },
          });
      }
    }
  // These roles are created after migrations on a fresh installation. Apply the
  // same explicit workflow grants as the step 4-8 migrations; no ADMIN wildcard.
  const workflowPermissions = {
    FACULTY: ["review-group:read", "review-group:manage", "proposal:read", "proposal:assign", "proposal:finalize", "proposal:export", "dossier:receive", "guidance:read", "guidance:monitor", "submission:read", "submission:download"],
    LECTURER: ["review-group:read", "proposal:read", "proposal:comment", "proposal:review", "proposal:edit", "proposal:export", "guidance:read", "guidance:manage", "task:manage", "task:ensure-weekly", "task:review", "submission:read", "submission:download"],
    STUDENT: ["proposal:read", "proposal:edit", "proposal:submit", "proposal:export", "guidance:read", "task:progress", "task:ensure-weekly", "submission:read", "submission:create", "submission:download"],
  };
  for (const permission of await prisma.permission.findMany())
    for (const [roleName, grants] of Object.entries(workflowPermissions))
      if (grants.includes(`${permission.resource}:${permission.action}`))
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: roles[roleName].id, permissionId: permission.id } },
          create: { roleId: roles[roleName].id, permissionId: permission.id }, update: {},
        });
  const systems = [];
  for (const [code, name] of [
    ["CQ", "Chính quy"],
    ["LT", "Liên thông"],
    ["TX", "Từ xa"],
  ])
    systems.push(
      await prisma.trainingSystem.upsert({
        where: { code },
        update: {},
        create: { code, name },
      }),
    );
  const department = await prisma.department.upsert({
    where: { code: "CNPM" },
    update: {},
    create: { code: "CNPM", name: "Công nghệ phần mềm" },
  });
  const areas = [];
  for (const name of ["Phần mềm", "Game", "Kiểm thử", "Học máy", "Mạng"])
    areas.push(
      await prisma.researchArea.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    );
  const passwordHash = await bcrypt.hash("Demo@2026", 12);
  async function account(
    username,
    name,
    role,
    email = null,
    password = passwordHash,
    mustChangePassword = false,
  ) {
    const user = await prisma.userAccount.upsert({
      where: { username },
      update: { displayName: name, status: "ACTIVE" },
      create: {
        username,
        displayName: name,
        email,
        passwordHash: password,
        status: "ACTIVE",
        mustChangePassword,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[role].id } },
      update: {},
      create: { userId: user.id, roleId: roles[role].id },
    });
    return user;
  }
  await account("admin", "Quản trị viên", "ADMIN", "admin@utc.edu.vn");
  await prisma.academicSemester.upsert({
    where: {
      academicYear_semester: { academicYear: "2026-2027", semester: 1 },
    },
    update: {},
    create: {
      academicYear: "2026-2027",
      semester: 1,
      name: "2026 – 2027 / Học kỳ I",
      startDate: new Date("2026-09-01T00:00:00+07:00"),
      endDate: new Date("2027-07-31T23:59:59+07:00"),
    },
  });
  console.log(
    "Seed complete: Roles, permissions, base catalogs, and single Admin account initialized.",
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
