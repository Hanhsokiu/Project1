// Definitions only. This module does not instantiate Prisma or grant term scope.
async function seedGradingWorkflowPermissions(
  prisma,
  faculty,
  lecturer,
  student,
) {
  const definitions = [
    ["grading", "read", [lecturer]],
    ["grading", "write", [lecturer]],
    ["grading", "seal", [lecturer]],
    ["grading", "configure", [faculty]],
    ["grading", "read-results", [faculty]],
    ["grading", "seal-results", [faculty]],
    ["grading", "publish", [faculty]],
    ["grading", "read-published", [faculty, student]],
    ["official-report", "export", [faculty]],
    ["official-report", "read", [faculty]],
  ];
  for (const [resource, action, roles] of definitions) {
    const p = await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      create: { resource, action },
      update: {},
    });
    for (const roleId of roles.filter(Boolean))
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: p.id } },
        create: { roleId, permissionId: p.id },
        update: {},
      });
  }
}
module.exports = { seedGradingWorkflowPermissions };
