import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  DefenseConfirmationWindowValidator,
  WindowPrincipal,
  WindowTerm,
} from "./defense-confirmation-window.validator";
import {
  defenseConfirmationWindowParamsSchema,
  defenseConfirmationWindowPutSchema,
} from "./defense-confirmation-window.dto";

const validator = new DefenseConfirmationWindowValidator();
const term: WindowTerm = {
  id: "term-1",
  status: "IN_PROGRESS",
  isLocked: false,
  startDate: new Date("2026-10-01T00:00:00+07:00"),
  endDate: new Date("2027-01-31T00:00:00+07:00"),
};
const input = {
  opensAt: "2026-12-01T00:00:00+07:00",
  closesAt: "2026-12-20T00:00:00+07:00",
  locked: false,
  expectedRevision: 0,
};
const user: WindowPrincipal = {
  id: "manager",
  status: "ACTIVE",
  userRoles: [
    {
      role: {
        rolePermissions: [
          { permission: { resource: "term", action: "plan" } },
          { permission: { resource: "term", action: "read" } },
        ],
      },
    },
  ],
};
const grant = { userId: user.id, termId: term.id, allDepartments: true };

describe("Defense confirmation window input and business validation", () => {
  it("accepts offset instants, safe revisions and opaque legacy term IDs", () => {
    expect(defenseConfirmationWindowPutSchema.parse(input)).toEqual(input);
    expect(
      defenseConfirmationWindowParamsSchema.parse({ termId: " term-legacy " }),
    ).toEqual({ termId: "term-legacy" });
  });
  it.each([
    { opensAt: "2026-12-01" },
    { opensAt: "2026-12-01T00:00:00" },
    { closesAt: "2026-02-30T00:00:00Z" },
    { locked: "false" },
    { expectedRevision: -1 },
    { expectedRevision: 0.5 },
    { expectedRevision: "0" },
    { expectedRevision: 2147483647 },
    { actorId: "someone-else" },
  ])("rejects malformed/extra fields: %j", (patch) => {
    expect(
      defenseConfirmationWindowPutSchema.safeParse({ ...input, ...patch })
        .success,
    ).toBe(false);
  });
  it("requires all input fields and a nonempty bounded ID", () => {
    expect(
      defenseConfirmationWindowPutSchema.safeParse({ opensAt: input.opensAt })
        .success,
    ).toBe(false);
    for (const termId of ["", "  ", "x".repeat(101)]) {
      expect(
        defenseConfirmationWindowParamsSchema.safeParse({ termId }).success,
      ).toBe(false);
    }
  });
  it("accepts a window contained in the term, including exact term boundaries", () => {
    expect(validator.dates(input, term).opensAt.toISOString()).toBe(
      "2026-11-30T17:00:00.000Z",
    );
    expect(() =>
      validator.dates(
        {
          ...input,
          opensAt: term.startDate.toISOString(),
          closesAt: term.endDate.toISOString(),
        },
        term,
      ),
    ).not.toThrow();
  });
  it.each([
    { opensAt: input.closesAt },
    { opensAt: "2026-12-21T00:00:00+07:00" },
    { opensAt: "2026-09-30T23:59:59+07:00" },
    { closesAt: "2027-02-01T00:00:00+07:00" },
    { opensAt: "invalid" },
  ])("rejects unordered/out-of-term times: %j", (patch) => {
    expect(() => validator.dates({ ...input, ...patch }, term)).toThrow();
  });
  it("compares instants rather than lexical timezone strings", () => {
    expect(() =>
      validator.dates(
        {
          ...input,
          opensAt: "2026-12-01T00:00:00+07:00",
          closesAt: "2026-11-30T18:00:00Z",
        },
        term,
      ),
    ).not.toThrow();
    expect(() =>
      validator.dates(
        {
          ...input,
          opensAt: "2026-12-01T00:00:00+07:00",
          closesAt: "2026-11-30T17:00:00Z",
        },
        term,
      ),
    ).toThrow();
  });
  it("allows editing an otherwise editable term without requiring any phase or UC17 decision", () => {
    for (const status of ["DRAFT", "IN_PROGRESS", "DEFENDING"]) {
      expect(() => validator.editable({ ...term, status })).not.toThrow();
    }
  });
  it.each(["COMPLETED", "CANCELLED"])(
    "rejects writes to %s terms",
    (status) => {
      expect(() => validator.editable({ ...term, status })).toThrow();
    },
  );
  it("rejects a locked parent term", () => {
    expect(() => validator.editable({ ...term, isLocked: true })).toThrow();
  });
  it("accepts matching revision and rejects stale revision", () => {
    expect(() => validator.revision(2, 2)).not.toThrow();
    expect(() => validator.revision(1, 2)).toThrow();
  });
});

describe("Explicit permission and full-term grant", () => {
  it.each(["read", "plan"] as const)(
    "allows %s with both permission and full-term grant",
    (action) => {
      expect(() =>
        validator.access(user.id, term.id, user, grant, action),
      ).not.toThrow();
    },
  );
  it("denies missing principal, inactive account or missing permission even with a grant", () => {
    for (const principal of [
      null,
      { ...user, status: "LOCKED" },
      { ...user, userRoles: [] },
    ]) {
      expect(() =>
        validator.access(user.id, term.id, principal, grant, "plan"),
      ).toThrow();
    }
  });
  it("read permission alone cannot authorize updates", () => {
    const principal = {
      ...user,
      userRoles: [
        {
          role: {
            rolePermissions: [
              { permission: { resource: "term", action: "read" } },
            ],
          },
        },
      ],
    };
    expect(() =>
      validator.access(user.id, term.id, principal, grant, "plan"),
    ).toThrow();
  });
  it.each([
    null,
    { ...grant, allDepartments: false },
    { ...grant, termId: "another-term" },
    { ...grant, userId: "other-user" },
  ])("denies absent/partial/mismatched grants: %j", (scope) => {
    expect(() =>
      validator.access(user.id, term.id, user, scope, "plan"),
    ).toThrow();
  });
  it.each(["ADMIN", "FACULTY"])(
    "does not give %s a role-based bypass",
    (name) => {
      const principal = {
        ...user,
        userRoles: user.userRoles.map((r) => ({ role: { ...r.role, name } })),
      };
      expect(() =>
        validator.access(user.id, term.id, principal, null, "plan"),
      ).toThrow();
      expect(() =>
        validator.access(
          user.id,
          term.id,
          principal,
          { ...grant, allDepartments: false },
          "plan",
        ),
      ).toThrow();
    },
  );
  it("rejects a principal not matching the authenticated actor", () => {
    expect(() =>
      validator.access("other-user", term.id, user, grant, "plan"),
    ).toThrow();
  });
});
