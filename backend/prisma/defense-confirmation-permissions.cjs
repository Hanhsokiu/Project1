// Safe to import in unit tests: no PrismaClient or database side effects.
async function seedDefenseConfirmationPermissions(prisma, lecturerRoleId) {
  const permission = await prisma.permission.upsert({
    where: {
      resource_action: { resource: "defense-confirmation", action: "decide" },
    },
    create: { resource: "defense-confirmation", action: "decide" },
    update: {},
  });
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: lecturerRoleId,
        permissionId: permission.id,
      },
    },
    create: { roleId: lecturerRoleId, permissionId: permission.id },
    update: {},
  });
  // This explicit role permission is not authority for any proposal: current
  // official advisor ownership is always checked by the command in transaction.
}
async function seedDefenseConfirmationReadPermissions(prisma, roleIds) {
  const permission = await prisma.permission.upsert({
    where: {
      resource_action: { resource: "defense-confirmation", action: "read" },
    },
    create: { resource: "defense-confirmation", action: "read" },
    update: {},
  });
  // Explicit grants only. No ADMIN wildcard, term grant or workflow defaults.
  // A shared permission never bypasses endpoint-specific ownership/DTO policy.
  for (const roleId of roleIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
      create: { roleId, permissionId: permission.id },
      update: {},
    });
  }
}
module.exports = {
  seedDefenseConfirmationPermissions,
  seedDefenseConfirmationReadPermissions,
};
