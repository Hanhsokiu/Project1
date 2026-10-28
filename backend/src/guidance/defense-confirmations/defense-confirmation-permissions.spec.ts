import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

// This helper is side-effect-free; never import/execute seed.cjs in tests.
const {
  seedDefenseConfirmationPermissions,
  seedDefenseConfirmationReadPermissions,
} = createRequire(__filename)(
  "../../../prisma/defense-confirmation-permissions.cjs",
);
describe("UC17 permission provisioning with mock delegates only", () => {
  it("adds explicit read permission for the three approved reader roles without default grants", async () => {
    const permission = {
        upsert: vi.fn().mockResolvedValue({ id: "read-permission" }),
      },
      rolePermission = { upsert: vi.fn() };
    await seedDefenseConfirmationReadPermissions(
      { permission, rolePermission },
      ["lecturer-role", "student-role", "faculty-role"],
    );
    expect(permission.upsert).toHaveBeenCalledWith({
      where: {
        resource_action: { resource: "defense-confirmation", action: "read" },
      },
      create: { resource: "defense-confirmation", action: "read" },
      update: {},
    });
    expect(
      rolePermission.upsert.mock.calls.map(([entry]) => entry.create.roleId),
    ).toEqual(["lecturer-role", "student-role", "faculty-role"]);
  });
  it("does not guess ADMIN or another reader role when the approved role list is empty", async () => {
    const permission = {
        upsert: vi.fn().mockResolvedValue({ id: "read-permission" }),
      },
      rolePermission = { upsert: vi.fn() };
    await seedDefenseConfirmationReadPermissions(
      { permission, rolePermission },
      [],
    );
    expect(rolePermission.upsert).not.toHaveBeenCalled();
  });
  it("provisions only the explicit decide permission to LECTURER with no default workflow data or grants", async () => {
    const permission = {
      upsert: vi.fn().mockResolvedValue({ id: "decide-permission" }),
    };
    const rolePermission = { upsert: vi.fn() };
    await seedDefenseConfirmationPermissions(
      { permission, rolePermission },
      "lecturer-role",
    );
    expect(permission.upsert).toHaveBeenCalledWith({
      where: {
        resource_action: { resource: "defense-confirmation", action: "decide" },
      },
      create: { resource: "defense-confirmation", action: "decide" },
      update: {},
    });
    expect(rolePermission.upsert).toHaveBeenCalledWith({
      where: {
        roleId_permissionId: {
          roleId: "lecturer-role",
          permissionId: "decide-permission",
        },
      },
      create: { roleId: "lecturer-role", permissionId: "decide-permission" },
      update: {},
    });
  });
  it("repeated provisioning uses only upserts and never opens a database connection", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "permission" });
    const client = { permission: { upsert }, rolePermission: { upsert } };
    await seedDefenseConfirmationPermissions(client, "lecturer-role");
    await seedDefenseConfirmationPermissions(client, "lecturer-role");
    expect(upsert).toHaveBeenCalledTimes(4);
  });
});
