import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { uc18Fixture } from "../../common/uc18-finalization/uc18-finalization.test-fixtures";
import {
  defenseListAt,
  defenseListFixture,
} from "./defense-list.test-fixtures";

let f: ReturnType<typeof defenseListFixture>;
beforeEach(() => {
  f = defenseListFixture();
});
const create = () => f.service.create("manager", "term");
const open = (expectedRevision = 0) =>
  f.service.open("manager", "term", { expectedRevision });
const get = () => f.service.get("manager", "term");

describe("UC18 DRAFT/OPEN service", () => {
  it.each(["missing", "locked", "closed"])(
    "OPEN fails closed with %s UC18 policy window",
    async (kind) => {
      f.state.row = f.draft();
      if (kind === "missing") {
        f.state.row.workflowPolicy = null;
        f.state.row.workflowPolicyRevision = 0;
        f.state.row.workflowPolicyUpdatedAt = null;
        f.state.row.workflowPolicyUpdatedByUserId = null;
      } else {
        const p = f.state.row.workflowPolicy as unknown as {
          windows: { UC18: { isLocked: boolean; closesAt: string } };
        };
        if (kind === "locked") p.windows.UC18.isLocked = true;
        else p.windows.UC18.closesAt = "2026-10-26T00:00:00Z";
      }
      await expect(open()).rejects.toMatchObject({ status: 409 });
      expect(f.raw.defenseList.updateMany).not.toHaveBeenCalled();
      expect(f.auditLog).not.toHaveBeenCalled();
    },
  );
  it("GET returns configured=false and UNKNOWN without creating or auditing anything", async () => {
    expect(await get()).toMatchObject({
      configured: false,
      state: null,
      revision: null,
      openedAt: null,
      openedByUserId: null,
      uc18: { state: "UNKNOWN", reason: "UC18_NOT_CONFIGURED" },
    });
    expect(f.raw.defenseList.create).not.toHaveBeenCalled();
    expect(f.raw.defenseList.updateMany).not.toHaveBeenCalled();
    expect(f.auditLog).not.toHaveBeenCalled();
    expect(f.raw.$queryRaw).not.toHaveBeenCalled();
  });
  it("creates only DRAFT revision zero with no opening or finalization metadata", async () => {
    const result = await create();
    expect(result).toMatchObject({
      configured: true,
      state: "DRAFT",
      revision: 0,
      openedAt: null,
      openedByUserId: null,
      uc18: { state: "UNKNOWN", reason: "UC18_DRAFT" },
    });
    expect(f.state.row?.currentFinalizationId).toBeNull();
    expect(f.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "manager",
        action: "CREATE_DEFENSE_LIST",
        resource: "defense-list",
        resourceId: "term",
        newValue: result,
      }),
      f.tx,
    );
    expect(f.raw.defenseListFinalization.findUnique).not.toHaveBeenCalled();
    expect(f.events[0]).toBe("lockTerm");
    expect(f.events.indexOf("create")).toBeLessThan(f.events.indexOf("audit"));
    expect(f.untouched).not.toHaveBeenCalled();
  });
  it("rejects a repeated create with 409 and preserves the original row and audit", async () => {
    await create();
    const before = structuredClone(f.state);
    await expect(create()).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "DEFENSE_LIST_ALREADY_EXISTS" } },
    });
    expect(f.state).toEqual(before);
    expect(f.auditLog).toHaveBeenCalledOnce();
  });
  it("concurrent creates have one winner and one audit", async () => {
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toMatchObject([
      { reason: { status: 409 } },
    ]);
    expect(f.state.row?.state).toBe("DRAFT");
    expect(f.state.audit).toHaveLength(1);
  });
  it("opens DRAFT, increments revision and is immediately recognized by the real UC18 reader", async () => {
    f.state.row = f.draft();
    const result = await open();
    expect(result).toMatchObject({
      state: "OPEN",
      revision: 1,
      openedAt: defenseListAt.toISOString(),
      openedByUserId: "manager",
      uc18: { state: "OPEN", scope: "TERM", termId: "term", revision: 1 },
    });
    expect(f.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "OPEN_DEFENSE_LIST",
        userId: "manager",
        resourceId: "term",
        oldValue: expect.objectContaining({ state: "DRAFT", revision: 0 }),
        newValue: result,
      }),
      f.tx,
    );
    expect(f.events[0]).toBe("lockTerm");
    expect(f.events.indexOf("open")).toBeLessThan(f.events.indexOf("audit"));
    expect(f.untouched).not.toHaveBeenCalled();
    expect(await f.reader.read("term", f.tx)).toMatchObject({
      state: "OPEN",
      revision: 1,
    });
  });
  it("opens without querying student roster, PDF, UC17 or eligibility readiness", async () => {
    f.state.row = f.draft();
    expect((await open()).state).toBe("OPEN");
    expect(f.untouched).not.toHaveBeenCalled();
  });
  it("rejects stale expectedRevision before any write or audit", async () => {
    f.state.row = f.draft();
    await expect(open(1)).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "REVISION_CONFLICT" } },
    });
    expect(f.raw.defenseList.updateMany).not.toHaveBeenCalled();
    expect(f.auditLog).not.toHaveBeenCalled();
  });
  it("concurrent OPEN requests cannot overwrite opening metadata or double-audit", async () => {
    f.state.row = f.draft();
    const results = await Promise.allSettled([open(), open()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toMatchObject([
      { reason: { status: 409 } },
    ]);
    expect(f.state.row?.revision).toBe(1);
    expect(f.state.audit).toHaveLength(1);
  });
  it.each(["OPEN", "FINALIZED"] as const)(
    "does not permit %s to OPEN, even at the right revision",
    async (state) => {
      f.state.row = {
        ...f.draft(),
        state,
        revision: 4,
        openedAt: defenseListAt,
        openedByUserId: "previous-manager",
      };
      if (state === "FINALIZED") f.state.row.currentFinalizationId = "sealed";
      const before = structuredClone(f.state.row);
      await expect(open(4)).rejects.toMatchObject({
        status: 409,
        response: { error: { code: "DEFENSE_LIST_TRANSITION_INVALID" } },
      });
      expect(f.state.row).toEqual(before);
      expect(f.raw.defenseList.updateMany).not.toHaveBeenCalled();
      expect(f.auditLog).not.toHaveBeenCalled();
    },
  );
  it("requires creating DRAFT before opening", async () => {
    await expect(open()).rejects.toMatchObject({
      status: 404,
      response: { error: { code: "DEFENSE_LIST_NOT_CONFIGURED" } },
    });
    expect(f.raw.defenseList.create).not.toHaveBeenCalled();
    expect(f.auditLog).not.toHaveBeenCalled();
  });
  it.each(["create", "open"] as const)(
    "rolls back %s and audit together when audit insertion fails",
    async (operation) => {
      if (operation === "open") f.state.row = f.draft();
      const before = structuredClone(f.state.row);
      const error = new Error("audit unavailable");
      f.raw.auditLog.create.mockImplementationOnce(async (entry) => {
        f.state.audit.push(entry);
        throw error;
      });
      await expect(operation === "create" ? create() : open()).rejects.toBe(
        error,
      );
      expect(f.state.row).toEqual(before);
      expect(f.state.audit).toEqual([]);
    },
  );
  it("rejects an atomic CAS miss without auditing", async () => {
    f.state.row = f.draft();
    f.raw.defenseList.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(open()).rejects.toMatchObject({ status: 409 });
    expect(f.state.row.state).toBe("DRAFT");
    expect(f.auditLog).not.toHaveBeenCalled();
  });
  it("rolls back OPEN if the neutral reader cannot verify the new state", async () => {
    f.state.row = f.draft();
    vi.spyOn(f.reader, "read").mockResolvedValue({
      state: "UNKNOWN",
      scope: "TERM",
      termId: "term",
      reason: "UNAVAILABLE",
    });
    await expect(open()).rejects.toMatchObject({
      status: 409,
      response: { error: { code: "DEFENSE_LIST_OPEN_NOT_VERIFIED" } },
    });
    expect(f.state.row.state).toBe("DRAFT");
    expect(f.auditLog).not.toHaveBeenCalled();
  });
  it("uses the caller transaction for reader and audit, including GET", async () => {
    const read = vi.spyOn(f.reader, "read");
    await create();
    f.state.row = f.draft(); // Arrange explicitly configured policy before OPEN.
    await open();
    await get();
    for (const args of read.mock.calls) expect(args[1]).toBe(f.tx);
    for (const args of f.auditLog.mock.calls) expect(args[1]).toBe(f.tx);
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(3);
  });
  it.each(["create", "open"] as const)(
    "requires an active, explicitly permitted full-term actor for %s",
    async (operation) => {
      f.state.row = operation === "open" ? f.draft() : null;
      f.state.grant!.allDepartments = false;
      f.state.grant!.pr2bGrantDepartmentGrantId = [
        { departmentId: "department" },
      ];
      await expect(
        operation === "create" ? create() : open(),
      ).rejects.toMatchObject({ status: 403 });
      expect(f.raw.defenseList.create).not.toHaveBeenCalled();
      expect(f.raw.defenseList.updateMany).not.toHaveBeenCalled();
      expect(f.auditLog).not.toHaveBeenCalled();
    },
  );
  it("permits department-granted readers to view only safe term metadata", async () => {
    f.state.grant!.allDepartments = false;
    f.state.grant!.pr2bGrantDepartmentGrantId = [
      { departmentId: "department" },
    ];
    const source = uc18Fixture();
    f.state.row = source.list;
    f.state.finalization = source.finalization;
    const result = await get();
    expect(result.uc18.state).toBe("FINALIZED");
    expect(JSON.stringify(result)).not.toMatch(
      /student-1|student-2|students|roster|snapshot"|storageKey|filePath/,
    );
    expect(f.auditLog).not.toHaveBeenCalled();
  });
  it.each(["get", "create", "open"] as const)(
    "denies missing permission in service for %s",
    async (operation) => {
      f.state.actor!.userRoles = [];
      await expect(
        operation === "get"
          ? get()
          : operation === "create"
            ? create()
            : open(),
      ).rejects.toMatchObject({ status: 403 });
      expect(f.raw.defenseList.findUnique).not.toHaveBeenCalled();
      expect(f.auditLog).not.toHaveBeenCalled();
    },
  );
  it.each(["get", "create", "open"] as const)(
    "denies absent term grant for %s",
    async (operation) => {
      f.state.grant = null;
      await expect(
        operation === "get"
          ? get()
          : operation === "create"
            ? create()
            : open(),
      ).rejects.toMatchObject({ status: 403 });
      expect(f.raw.defenseList.findUnique).not.toHaveBeenCalled();
    },
  );
  it.each(["create", "open"] as const)(
    "blocks %s on a locked term while permitting GET",
    async (operation) => {
      f.state.term!.isLocked = true;
      if (operation === "open") f.state.row = f.draft();
      expect((await get()).configured).toBe(operation === "open");
      await expect(
        operation === "create" ? create() : open(),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.auditLog).not.toHaveBeenCalled();
    },
  );
  it.each(["get", "create", "open"] as const)(
    "returns 404 for a missing term during %s",
    async (operation) => {
      f.state.term = null;
      await expect(
        operation === "get"
          ? get()
          : operation === "create"
            ? create()
            : open(),
      ).rejects.toMatchObject({ status: 404 });
    },
  );
  it("fails closed with 503 when the UC18 table is missing", async () => {
    f.raw.defenseList.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("table absent", {
        code: "P2021",
        clientVersion: "5.22.0",
      }),
    );
    await expect(get()).rejects.toMatchObject({
      status: 503,
      response: { error: { code: "DEFENSE_LIST_STORAGE_UNAVAILABLE" } },
    });
    expect(f.auditLog).not.toHaveBeenCalled();
  });
});
