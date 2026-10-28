import { describe, expect, it } from "vitest";
import {
  defenseListAt,
  defenseListFixture,
} from "./defense-list.test-fixtures";
import {
  defenseListCreateSchema,
  defenseListOpenSchema,
  defenseListParamsSchema,
} from "./defense-list.dto";

describe("UC18 permission, lifecycle and DTO validation", () => {
  it.each(["read", "manage"] as const)(
    "allows explicit %s permission with a full-term grant",
    (action) => {
      const f = defenseListFixture();
      expect(() =>
        f.validator.access(
          "manager",
          "term",
          f.state.actor,
          f.state.grant,
          action,
        ),
      ).not.toThrow();
    },
  );
  it.each([
    "no-user",
    "inactive",
    "password-change",
    "wrong-user",
    "no-permission",
    "old-permission",
    "no-grant",
    "wrong-grant-user",
    "wrong-term",
    "empty-department-scope",
  ])("denies %s for both read and manage without role bypass", (scenario) => {
    const f = defenseListFixture();
    switch (scenario) {
      case "no-user":
        f.state.actor = null;
        break;
      case "inactive":
        f.state.actor!.status = "LOCKED";
        break;
      case "password-change":
        f.state.actor!.mustChangePassword = true;
        break;
      case "wrong-user":
        f.state.actor!.id = "another-user";
        break;
      case "no-permission":
        f.state.actor!.userRoles = [];
        break;
      case "old-permission":
        f.state.actor!.userRoles[0].role.rolePermissions = [
          { permission: { resource: "defense", action: "manage" } },
        ];
        break;
      case "no-grant":
        f.state.grant = null;
        break;
      case "wrong-grant-user":
        f.state.grant!.userId = "another-user";
        break;
      case "wrong-term":
        f.state.grant!.termId = "another-term";
        break;
      case "empty-department-scope":
        f.state.grant!.allDepartments = false;
        break;
    }
    for (const action of ["read", "manage"] as const)
      expect(() =>
        f.validator.access(
          "manager",
          "term",
          f.state.actor,
          f.state.grant,
          action,
        ),
      ).toThrowError(expect.objectContaining({ status: 403 }));
  });
  it.each(["ADMIN", "FACULTY"])(
    "%s with explicit permission still needs a full-term grant to manage",
    (name) => {
      const f = defenseListFixture();
      Object.assign(f.state.actor!.userRoles[0].role, { name });
      f.state.grant!.allDepartments = false;
      f.state.grant!.pr2bGrantDepartmentGrantId = [
        { departmentId: "department" },
      ];
      expect(() =>
        f.validator.access(
          "manager",
          "term",
          f.state.actor,
          f.state.grant,
          "read",
        ),
      ).not.toThrow();
      expect(() =>
        f.validator.access(
          "manager",
          "term",
          f.state.actor,
          f.state.grant,
          "manage",
        ),
      ).toThrowError(expect.objectContaining({ status: 403 }));
    },
  );
  it.each([
    "DRAFT",
    "OPEN_REGISTRATION",
    "CLOSED_REGISTRATION",
    "IN_PROGRESS",
    "DEFENDING",
  ])(
    "permits explicit preparation/opening during unlocked %s without implying UC18 OPEN",
    (status) => {
      const f = defenseListFixture();
      expect(() =>
        f.validator.editable({ ...f.state.term!, status }),
      ).not.toThrow();
    },
  );
  it.each(["COMPLETED", "CANCELLED", "UNKNOWN"])(
    "blocks changes during %s",
    (status) => {
      const f = defenseListFixture();
      expect(() =>
        f.validator.editable({ ...f.state.term!, status }),
      ).toThrowError(expect.objectContaining({ status: 409 }));
    },
  );
  it("blocks a locked IN_PROGRESS term", () => {
    const f = defenseListFixture();
    expect(() =>
      f.validator.editable({ ...f.state.term!, isLocked: true }),
    ).toThrow();
  });
  it.each(["openedAt", "openedByUserId", "currentFinalizationId"] as const)(
    "rejects a DRAFT with unexpected %s",
    (key) => {
      const f = defenseListFixture(),
        row = f.draft();
      Object.assign(row, {
        [key]: key === "openedAt" ? defenseListAt : "unexpected",
      });
      expect(() => f.validator.openable(row, 0)).toThrowError(
        expect.objectContaining({ status: 409 }),
      );
    },
  );
  it("accepts DRAFT revision zero and rejects overflow before incrementing", () => {
    const f = defenseListFixture(),
      row = f.draft();
    expect(() => f.validator.openable(row, 0)).not.toThrow();
    row.revision = 2147483647;
    expect(() => f.validator.openable(row, row.revision)).toThrow();
  });
  it("requires a nonempty term identifier fitting its database key", () => {
    expect(defenseListParamsSchema.safeParse({ termId: "term" }).success).toBe(
      true,
    );
    for (const termId of ["", " ", "x".repeat(37)])
      expect(defenseListParamsSchema.safeParse({ termId }).success).toBe(false);
  });
  it("create accepts no payload or an empty object, rejects client-controlled state or actor", () => {
    expect(defenseListCreateSchema.parse(undefined)).toEqual({});
    expect(defenseListCreateSchema.parse({})).toEqual({});
    for (const input of [
      { state: "OPEN" },
      { actorId: "manager" },
      { openedAt: "2026-01-01Z" },
      { termId: "other" },
      { revision: 2 },
    ])
      expect(defenseListCreateSchema.safeParse(input).success).toBe(false);
  });
  it.each([
    {},
    { expectedRevision: "0" },
    { expectedRevision: -1 },
    { expectedRevision: 1.5 },
    { expectedRevision: 2147483647 },
    { expectedRevision: 0, actorId: "spoofed" },
    { expectedRevision: 0, state: "OPEN" },
  ])(
    "rejects invalid OPEN input %s at the DTO and service boundary",
    (input) => {
      const f = defenseListFixture();
      expect(defenseListOpenSchema.safeParse(input).success).toBe(false);
      expect(() => f.validator.openInput(input as never)).toThrowError(
        expect.objectContaining({ status: 422 }),
      );
    },
  );
  it("accepts an exact expectedRevision without coercion", () => {
    const f = defenseListFixture();
    expect(f.validator.openInput({ expectedRevision: 0 })).toEqual({
      expectedRevision: 0,
    });
  });
});
