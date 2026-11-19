"use strict";
const { id, date, areas, students, lecturers } = require("./definition.cjs");
const stamp = { createdAt: date("2026-02-01"), updatedAt: date("2026-02-01") };
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
  assignment: ["read", "manage"],
  topic: ["read", "write", "agree"],
  notification: ["own"],
};
const workflow = {
  FACULTY: [
    "review-group:read",
    "review-group:manage",
    "proposal:read",
    "proposal:assign",
    "proposal:reopen",
    "proposal:finalize",
    "proposal:export",
    "dossier:receive",
    "guidance:read",
    "guidance:monitor",
    "submission:read",
    "submission:download",
  ],
  LECTURER: [
    "review-group:read",
    "proposal:read",
    "proposal:comment",
    "proposal:review",
    "proposal:edit",
    "proposal:export",
    "guidance:read",
    "guidance:manage",
    "task:manage",
    "task:ensure-weekly",
    "task:review",
    "submission:read",
    "submission:download",
  ],
  STUDENT: [
    "proposal:read",
    "proposal:edit",
    "proposal:submit",
    "proposal:export",
    "guidance:read",
    "task:progress",
    "task:ensure-weekly",
    "submission:read",
    "submission:create",
    "submission:download",
  ],
};
async function seedCatalog(ctx) {
  const hash = await ctx.local
    .req("bcryptjs")
    .hash(ctx.cfg.accountPassword, 12);
  await ctx.phase("catalog-participants", async (tx) => {
    // Exact step1–8 mapping from prisma/seed.cjs, applied only to this owned TEST DB.
    const roles = await tx.role.findMany();
    for (const [resource, actions] of Object.entries(resources))
      for (const action of actions) {
        const permission = await tx.permission.upsert({
          where: { resource_action: { resource, action } },
          create: {
            id: id(`permission/${resource}/${action}`),
            resource,
            action,
          },
          update: {},
        });
        for (const role of roles) {
          const name = role.name;
          const can =
            (name === "ADMIN" && resource !== "registration") ||
            (name === "FACULTY" &&
              resource !== "account" &&
              resource !== "registration") ||
            (resource === "registration" &&
              ((action === "read" && ["ADMIN", "FACULTY"].includes(name)) ||
                (action === "own" && name === "STUDENT"))) ||
            (["STUDENT", "LECTURER"].includes(name) &&
              ((resource === "assignment" && action === "read") ||
                (resource === "topic" && ["read", "write"].includes(action)) ||
                (resource === "topic" &&
                  action === "agree" &&
                  name === "LECTURER") ||
                (resource === "notification" && action === "own"))) ||
            (["LECTURER", "STUDENT", "COMMITTEE"].includes(name) &&
              ["term:read", "catalog:read", "lecturer:read"].includes(
                `${resource}:${action}`,
              ));
          if (can)
            await tx.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: permission.id,
                },
              },
              create: { roleId: role.id, permissionId: permission.id },
              update: {},
            });
        }
      }
    for (const p of await tx.permission.findMany())
      for (const role of roles)
        if (workflow[role.name]?.includes(p.resource + ":" + p.action))
          await tx.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: role.id, permissionId: p.id },
            },
            create: { roleId: role.id, permissionId: p.id },
            update: {},
          });
    await ctx.put(tx, "department", {
      id: id("department"),
      code: "DEMO-CNTT",
      name: "Bộ môn CNTT — dữ liệu mô phỏng",
      ...stamp,
    });
    await ctx.put(tx, "trainingSystem", {
      id: id("training"),
      code: "DEMO-CQ",
      name: "Chính quy (DEMO)",
      createdAt: stamp.createdAt,
    });
    await ctx.put(tx, "titleConfig", {
      id: id("title"),
      name: "Tiến sĩ (DEMO)",
      abbreviation: "TS.",
      createdAt: stamp.createdAt,
    });
    for (const name of areas) {
      await ctx.put(tx, "researchArea", {
        id: id("area/" + name),
        name,
        description: "Danh mục chuẩn — bộ dữ liệu tổng hợp UTC DEMO V3",
        createdAt: stamp.createdAt,
      });
      await ctx.put(tx, "researchAreaWorkflow", {
        id: id("area-workflow/" + name),
        researchAreaId: id("area/" + name),
        departmentId: id("department"),
        ...stamp,
      });
    }
    async function account(userId, username, name, role) {
      await ctx.put(tx, "userAccount", {
        id: userId,
        username,
        displayName: name,
        email: username + "@example.invalid",
        phone: "0000000000",
        passwordHash: hash,
        status: "ACTIVE",
        mustChangePassword: false,
        ...stamp,
      });
      const roleId = roles.find((r) => r.name === role).id;
      await tx.userRole.create({
        data: { userId, roleId, assignedAt: stamp.createdAt },
      });
    }
    await account(
      id("user/admin"),
      "demo3_admin",
      "Quản trị mô phỏng",
      "ADMIN",
    );
    for (let i = 1; i <= 2; i++)
      await account(
        id("user/faculty/" + i),
        "demo3_giaovu" + i,
        "Giáo vụ mô phỏng " + i,
        "FACULTY",
      );
    for (const l of lecturers) {
      await account(l.userId, l.username, l.name, "LECTURER");
      await ctx.put(tx, "lecturer", {
        id: l.id,
        userId: l.userId,
        lecturerCode: "DEMO-GV" + String(l.n).padStart(2, "0"),
        fullName: l.name,
        departmentId: id("department"),
        titleId: id("title"),
        maxStudents: 5,
        academicDegree: "DOCTOR",
        academicRank: "NONE",
        ...stamp,
      });
      await tx.lecturerArea.create({
        data: {
          lecturerId: l.id,
          researchAreaId: id("area/" + areas[(l.n - 1) % 5]),
        },
      });
    }
    for (const s of students) {
      await account(s.userId, s.username, s.name, "STUDENT");
      await ctx.put(tx, "student", {
        id: s.id,
        userId: s.userId,
        studentCode: "DEMO-SV" + String(s.n).padStart(3, "0"),
        fullName: s.name,
        trainingSystemId: id("training"),
        className: "DEMO-CNTT-K64-" + (1 + (s.n % 3)),
        majorName: "Công nghệ thông tin",
        cohort: "DEMO-K64",
        gpa: s.gpa,
        phone: "0000000000",
        academicEligible: true,
        ...stamp,
      });
    }
    await ctx.put(tx, "auditLog", {
      id: id("audit/bootstrap"),
      userId: id("user/admin"),
      action: "SYNTHETIC_DEMO_BASELINE_CREATED",
      resource: "demo-fixture",
      resourceId: id("manifest"),
      newValue: {
        synthetic: true,
        profile: "UTC_PROJECT1_DEMO_V3",
        realUserAction: false,
        source: "deterministic generator",
      },
      createdAt: stamp.createdAt,
    });
  });
}
module.exports = { seedCatalog };
