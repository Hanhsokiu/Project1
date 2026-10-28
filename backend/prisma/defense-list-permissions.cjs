// Additive permission provisioning only. Importing this file never connects or
// seeds. These explicit grants are outside the legacy ADMIN/FACULTY wildcard.
async function seedDefenseListPermissions(prisma, facultyRoleId) {
  for (const action of ["read", "manage"]) {
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource: "defense-list", action } },
      create: { resource: "defense-list", action },
      update: {},
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: facultyRoleId,
          permissionId: permission.id,
        },
      },
      create: { roleId: facultyRoleId, permissionId: permission.id },
      update: {},
    });
  }
  // No AcademicTermGrant or default DefenseList is created. Permission alone
  // never authorizes mutations without allDepartments=true for the exact term.
}
module.exports = { seedDefenseListPermissions };
