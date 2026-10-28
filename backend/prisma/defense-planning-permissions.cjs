// Definition only. Import has no side effects and never connects to a database.
async function seedDefensePlanningPermissions(prisma, facultyRoleId) {
  for (const action of ["read", "preview"]) {
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource: "defense-planning", action } },
      create: { resource: "defense-planning", action }, update: {},
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: facultyRoleId, permissionId: permission.id } },
      create: { roleId: facultyRoleId, permissionId: permission.id }, update: {},
    });
  }
  // No manage/publish permission, grant, default plan or data is provisioned.
}
module.exports = { seedDefensePlanningPermissions };
