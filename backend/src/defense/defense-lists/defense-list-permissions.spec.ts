import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

// Import the side-effect-free helper, never seed.cjs (which connects on startup).
const { seedDefenseListPermissions } = createRequire(__filename)(
  "../../../prisma/defense-list-permissions.cjs",
);

describe("UC18 permission provisioning without executing seed", () => {
  it("explicitly upserts only read/manage for FACULTY without a role wildcard or term/default data", async () => {
    const permission = {
      upsert: vi.fn(
        async ({
          create,
        }: {
          create: { resource: string; action: string };
        }) => ({ id: create.action }),
      ),
    };
    const rolePermission = { upsert: vi.fn() };
    // No PrismaClient, connect or business-data delegates are supplied.
    await seedDefenseListPermissions(
      { permission, rolePermission },
      "faculty-role",
    );
    expect(permission.upsert.mock.calls.map(([arg]) => arg.create)).toEqual([
      { resource: "defense-list", action: "read" },
      { resource: "defense-list", action: "manage" },
    ]);
    expect(rolePermission.upsert).toHaveBeenCalledTimes(2);
    for (const [arg] of rolePermission.upsert.mock.calls)
      expect(arg).toMatchObject({
        create: { roleId: "faculty-role" },
        update: {},
      });
  });
  it("uses upsert on repeated provisioning without writing grants or list records", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "permission" });
    const client = { permission: { upsert }, rolePermission: { upsert } };
    await seedDefenseListPermissions(client, "faculty-role");
    await seedDefenseListPermissions(client, "faculty-role");
    expect(upsert).toHaveBeenCalledTimes(8);
    for (const [arg] of upsert.mock.calls) expect(arg.update).toEqual({});
  });
});
