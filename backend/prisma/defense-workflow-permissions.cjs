// Definitions only, no connection or defaults. Grants are always checked at runtime.
async function seedDefenseWorkflowPermissions(
  prisma,
  facultyRoleId,
  lecturerRoleId,
  studentRoleId,
) {
  for (const action of [
    "read",
    "configure",
    "verify-academic",
    "manage",
    "finalize",
    "reopen",
    "publish",
  ]) {
    const p = await prisma.permission.upsert({
      where: { resource_action: { resource: "defense-workflow", action } },
      create: { resource: "defense-workflow", action },
      update: {},
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: facultyRoleId, permissionId: p.id },
      },
      create: { roleId: facultyRoleId, permissionId: p.id },
      update: {},
    });
  }
  const p = await prisma.permission.upsert({
    where: {
      resource_action: { resource: "defense-schedule", action: "read" },
    },
    create: { resource: "defense-schedule", action: "read" },
    update: {},
  });
  for (const roleId of [facultyRoleId, lecturerRoleId, studentRoleId])
    if (roleId)
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: p.id } },
        create: { roleId, permissionId: p.id },
        update: {},
      });
}
module.exports = { seedDefenseWorkflowPermissions };
