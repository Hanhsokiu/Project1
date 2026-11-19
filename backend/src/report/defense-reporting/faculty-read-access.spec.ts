import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReportingFixture } from "../../../test/reporting.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
let f: Awaited<ReturnType<typeof createReportingFixture>>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-11-07T01:05:00Z");
  f = await createReportingFixture(false); // Finalized but unpublished synthetic source, memory only.
  for (const r of f.users.get(ids.faculty)!.userRoles)
    r.role.rolePermissions = r.role.rolePermissions.filter(
      (p) => !["defense-result", "defense-report"].includes(p.permission.resource),
    );
  f.result.permit(ids.faculty, "FACULTY", ["read"]);
  f.permit(ids.faculty, "FACULTY", ["read", "templates-read", "statistics"]);
});
afterEach(() => vi.useRealTimers());
describe("Exactly four FACULTY read capabilities: production grant safety", () => {
  it("hides unpublished scores, source sheets, saved calculations, feedback and history", async () => {
    const v = await f.result.detail();
    expect(v.calculation).toBeNull();
    expect(v.savedCalculation).toBeNull();
    expect(v.savedPolicy).toBeNull();
    expect(v.sources).toEqual([]);
    expect(v.savedSources).toEqual([]);
    expect(v.history).toEqual([]);
    expect(v.confirmations.every(c => c.reason === null)).toBe(true);
    expect(v.actions.finalize).toContain("FACULTY_PERMISSION_REQUIRED");
    expect(v.actions.publish).toContain("FACULTY_PERMISSION_REQUIRED");
  });
  it("returns metadata/templates and non-score statistics without export or audit writes", async () => {
    const before = JSON.stringify(f.state);
    expect((await f.service.options(ids.faculty)).terms.length).toBeGreaterThan(0);
    expect((await f.service.templateList(ids.faculty, { termId: ids.term })).templates.length).toBeGreaterThan(0);
    const s = await f.service.statistics(ids.faculty, { termId: ids.term });
    for (const k of ["average", "passRate", "distribution", "finalizedResults", "publishedResults", "reviewerSheets", "committeeSheets"] as const)
      expect(s[k]).toBeNull();
    expect(s.byDepartment.every(g => g.finalized === null)).toBe(true);
    expect(JSON.stringify(s)).not.toContain("Synthetic advisor review");
    expect(JSON.stringify(s)).not.toContain("TEST_ONLY feedback");
    expect(JSON.stringify(f.state)).toBe(before);
    expect(f.state.keys.size).toBe(0);
  });
  it("denies UC24 detail/list and report contents when term/department grants are revoked", async () => {
    vi.spyOn(f.result.session, "grants").mockResolvedValue([]);
    vi.spyOn(f.session, "grants").mockResolvedValue([]);
    await expect(f.result.detail()).rejects.toMatchObject({ status: 404 });
    expect((await f.result.service.list(ids.faculty, { termId: ids.term, page: 1, limit: 20, search: "" })).items).toEqual([]);
    await expect(f.service.statistics(ids.faculty, { termId: ids.term })).rejects.toMatchObject({ status: 404 });
    await expect(f.service.templateList(ids.faculty, { termId: ids.term })).rejects.toMatchObject({ status: 404 });
    const terms = vi.spyOn(f.session, "terms");
    await f.service.options(ids.faculty);
    // Fixture terms() intentionally ignores Prisma filters; assert the actual repository filter.
    expect(terms).toHaveBeenLastCalledWith({ id: { in: [] } });
  });
  it("cannot read another term or gain preview/export/history/download using read actions", async () => {
    await expect(f.result.service.detail(ids.faculty, memberId, "another-term")).rejects.toMatchObject({ status: 404 });
    await expect(f.service.preview(ids.faculty, f.request())).rejects.toMatchObject({ status: 404 });
    await expect(f.service.history(ids.faculty, { termId: ids.term })).rejects.toMatchObject({ status: 404 });
    await expect(f.service.export(ids.faculty, { ...f.request(), expectedSnapshotHash: "0".repeat(64) }, "denied-export")).rejects.toMatchObject({ status: 404 });
    expect(f.state.events).toEqual([]);
    expect(f.state.keys.size).toBe(0);
  });
  it("does not combine sensitive ADMIN permissions with FACULTY read permission", async () => {
    const u = f.users.get(ids.faculty)!;
    u.userRoles.push({ role: { name: "ADMIN", rolePermissions: ["components-read", "history-read"].map(action => ({ permission: { resource: "defense-result", action } })) } } as never);
    expect((await f.result.detail()).calculation).toBeNull();
    expect((await f.result.detail()).history).toEqual([]);
  });
  it("does not list or select a committee outside the FACULTY department grant", async () => {
    const rows = await f.session.ccList(ids.term);
    expect(rows.length).toBeGreaterThan(0);
    const grants = await f.session.grants(ids.faculty, ids.term);
    vi.spyOn(f.session, "grants").mockResolvedValue([
      { ...grants[0], allDepartments: false,
        pr2bGrantDepartmentGrantId: [{ departmentId: rows[0].departmentId }] } as never,
    ]);
    vi.spyOn(f.session, "ccList").mockResolvedValue([
      ...rows,
      { ...rows[0], id: "outside-committee", departmentId: "outside-department", name: "OUTSIDE_SCOPE_NAME" },
    ]);
    expect(JSON.stringify(await f.service.options(ids.faculty))).not.toContain("OUTSIDE_SCOPE_NAME");
    await expect(f.service.templateList(ids.faculty, { termId: ids.term, committeeId: "outside-committee" }))
      .rejects.toMatchObject({ status: 404 });
    await expect(f.service.statistics(ids.faculty, { termId: ids.term, committeeId: "outside-committee" }))
      .rejects.toMatchObject({ status: 404 });
  });
});
