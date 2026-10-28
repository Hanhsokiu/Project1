/** Same grant semantics as the existing proposal/UC17 read policies. Roles and
 * action permissions must be checked by the caller; a role is never a grant.
 */
export type AcademicGrant = {
  userId: string;
  termId: string;
  allDepartments: boolean;
  pr2bGrantDepartmentGrantId: ReadonlyArray<{ departmentId: string }>;
};

export function academicTermScope(
  grants: ReadonlyArray<AcademicGrant>,
  userId: string,
  termId: string,
) {
  const own = grants.filter((g) => g.userId === userId && g.termId === termId);
  const allDepartments = own.some((g) => g.allDepartments);
  const departments = new Set(
    own
      .flatMap((g) => g.pr2bGrantDepartmentGrantId.map((d) => d.departmentId))
      .filter((id) => id.trim().length > 0),
  );
  return {
    allDepartments,
    configured: allDepartments || departments.size > 0,
    contains: (departmentId: string | null | undefined) =>
      allDepartments || (!!departmentId && departments.has(departmentId)),
  };
}
