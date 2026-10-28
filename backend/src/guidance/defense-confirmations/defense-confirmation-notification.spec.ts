import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { commandFixture } from "./defense-confirmation-command.test-fixtures";

describe("UC17 transactional in-app notifications", () => {
  it("notifies scoped faculty once per committed revision, never on unchanged replay", async () => {
    const f = commandFixture();
    await f.service.put("advisor-user", "proposal", f.input());
    expect(f.state.notifications).toHaveLength(1);
    expect(f.state.notifications[0]).toMatchObject({
      userId: "faculty-user",
      termId: "term",
      link: "/guidance/defense-confirm?proposalId=proposal&view=FACULTY",
    });
    await f.service.put("advisor-user", "proposal", f.input());
    expect(f.state.notifications).toHaveLength(1);
    await f.service.put("advisor-user", "proposal", {
      ...f.input("REJECTED"),
      changeReason: "Đánh giá lại",
    });
    expect(f.state.notifications).toHaveLength(2);
    expect(JSON.stringify(f.state.notifications)).not.toMatch(
      /storageKey|filePath|checksum|Sinh viên/,
    );
    const args = f.raw.userAccount.findMany.mock.calls[0];
    expect(JSON.stringify(args)).toContain("defense-confirmation");
    expect(JSON.stringify(args)).toContain("allDepartments");
    expect(JSON.stringify(args)).toContain('"termId":"term"');
  });
  it("rolls back decision, history, audit and notification if notification insert fails", async () => {
    const f = commandFixture();
    f.raw.notification.createMany.mockRejectedValueOnce(
      new Error("notification insert failed"),
    );
    await expect(
      f.service.put("advisor-user", "proposal", f.input()),
    ).rejects.toThrow("notification insert failed");
    expect(f.state.decision).toBeNull();
    expect(f.state.history).toEqual([]);
    expect(f.state.audits).toEqual([]);
    expect(f.state.notifications).toEqual([]);
  });
  it("does not notify when authorization/window/context checks fail", async () => {
    const f = commandFixture();
    f.state.window!.isLocked = true;
    await expect(
      f.service.put("advisor-user", "proposal", f.input()),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.raw.notification.createMany).not.toHaveBeenCalled();
    expect(f.raw.userAccount.findMany).not.toHaveBeenCalled();
  });
  it("does not invent recipients when no faculty has matching grant/permission", async () => {
    const f = commandFixture();
    f.raw.userAccount.findMany.mockResolvedValueOnce([]);
    const result = await f.service.put("advisor-user", "proposal", f.input());
    expect(result.changed).toBe(true);
    expect(f.raw.notification.createMany).not.toHaveBeenCalled();
  });
});
