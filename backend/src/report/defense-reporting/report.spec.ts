import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import ExcelJS = require("exceljs");
import { createRequire } from "module";
import { createReportingFixture } from "../../../test/reporting.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { ReportExportSchema } from "@doan/shared";
import { excelText } from "./report-renderer";
import { reviewHash } from "../../topic/proposal-reviews/proposal-review.validator";
const parsePdf = createRequire(__filename)("pdf-parse") as (
  b: Buffer,
) => Promise<{ text: string; numpages: number }>;
let f: Awaited<ReturnType<typeof createReportingFixture>>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-11-07T01:05:00Z");
  f = await createReportingFixture();
});
afterEach(() => vi.useRealTimers());
describe("UC25 real generators and producer chain with isolated persistence", () => {
  it.each(["PDF_ADVISOR_GRADE", "PDF_REVIEWER_GRADE"] as const)(
    "uses existing verified feedback for %s and never creates review text",
    async (code) => {
      const p = await f.preview(f.request(code));
      expect(p.blockers).toEqual([]);
      expect(p.rows[0].cells.COMMENTS).toBe(
        code === "PDF_ADVISOR_GRADE"
          ? "Synthetic advisor review"
          : "TEST_ONLY feedback",
      );
      const m = await f.service.export(
          ids.faculty,
          await f.body(f.request(code)),
          code,
        ),
        file = await f.service.download(ids.faculty, m.id, "feedback");
      expect((await parsePdf(file.bytes)).text).toContain(
        p.rows[0].cells.COMMENTS!,
      );
    },
  );
  it("revoked department scope blocks downloads and hides old scoped history", async () => {
    const m = await f.service.export(ids.faculty, await f.body(), "grant");
    vi.spyOn(f.session, "grants").mockResolvedValue([]);
    await expect(
      f.service.download(ids.faculty, m.id, "revoked"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      f.service.history(ids.faculty, { termId: ids.term }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("unknown or denied grade content is not exposed by statistics", async () => {
    const u = f.users.get(ids.faculty)!;
    u.userRoles[0].role.rolePermissions =
      u.userRoles[0].role.rolePermissions.filter(
        (p) =>
          p.permission.resource !== "defense-report" ||
          !["grade-statistics", "score-statistics"].includes(
            p.permission.action,
          ),
      );
    const s = await f.service.statistics(ids.faculty, { termId: ids.term });
    expect(s.finalizedResults).toBeNull();
    expect(s.average).toBeNull();
    expect(s.passRate).toBeNull();
    expect(s.committeeSheets).toBeNull();
  });
  it("statistics distribution has explicit non-overlapping approved bins, never an implicit pass threshold", async () => {
    f.policy.distribution = [
      { label: "TEST_ONLY range", from: "0", to: "10", includeUpper: true },
    ];
    expect(
      (await f.service.statistics(ids.faculty, { termId: ids.term }))
        .distribution,
    ).toEqual([{ label: "TEST_ONLY range", count: 1 }]);
    f.policy.distribution.push({
      label: "Overlapping",
      from: "8",
      to: "10",
      includeUpper: true,
    });
    expect(f.templates.policy(JSON.stringify(f.policy))).toBeNull();
  });
  it("empty class/date scope produces NO_DATA, and committee exports do not ignore class filters", async () => {
    const b = f.request("XLSX_COMMITTEES");
    b.filters.className = "NO_SUCH_CLASS";
    expect((await f.preview(b)).blockers).toContain("NO_DATA");
    const date = f.request();
    date.filters.from = "2030-11-08T00:00:00Z";
    expect((await f.preview(date)).count).toBe(0);
  });
  it("exports the verified B1–B8 dossier through its existing renderer and exact source template version", async () => {
    const p = f.result.f.p,
      d = await f.session.dossier(p.id),
      final = d!.pr2bDossierFinalizationDossierId[0];
    const raw = final.printSnapshot as unknown as {
      content: unknown;
      topicRevision: number;
    };
    final.printSnapshot = {
      schemaVersion: 1,
      title: p.topic.title,
      termName: "Đợt TEST_ONLY",
      student: {
        id: p.studentId,
        name: "Sinh viên kiểm thử",
        code: "00001234",
        className: "CNTT",
        majorName: "CNTT",
        trainingSystem: "Chính quy",
      },
      advisor: {
        id: "official-advisor",
        name: "Giảng viên kiểm thử",
        department: "Bộ môn kiểm thử",
      },
      academicProfileRevision: 1,
      assignmentId: f.result.f.assignment.id,
      assignmentRevision: 0,
      topicRevision: raw.topicRevision,
      content: raw.content,
    } as never;
    final.contentHash = reviewHash(final.printSnapshot);
    final.templateVersion = "B1_TEST_ONLY";
    f.policy.templates.find(
      (t) => t.code === "PDF_DOSSIER",
    )!.dossierTemplateVersion = "B1_TEST_ONLY";
    const request = f.request("PDF_DOSSIER", "DRAFT"),
      preview = await f.preview(request);
    expect(preview.blockers).toEqual([]);
    const metadata = await f.service.export(
        ids.faculty,
        await f.body(request),
        "dossier",
      ),
      file = await f.service.download(ids.faculty, metadata.id, "dossier-get"),
      parsed = await parsePdf(file.bytes);
    expect(parsed.text).toContain("ĐỀ CƯƠNG");
    expect(parsed.text).toContain("00001234");
    expect(parsed.text).toContain("CHƯA CHỐT");
  });
  it("round-trips Unicode, leading-zero codes and hostile text as literal XLSX cells", async () => {
    const t = f.policy.templates.find((t) => t.code === "XLSX_STUDENTS")!,
      a = await f.reader.access(
        f.session,
        ids.faculty,
        { termId: ids.term },
        "export",
      ),
      snapshot = await f.reader.collect(
        f.session,
        a,
        { termId: ids.term },
        t,
        false,
      );
    snapshot.rows[0].cells.STUDENT_CODE = "00001234";
    snapshot.rows[0].cells.GIVEN_NAME = "Nguyễn Ánh";
    for (const text of [
      "=1+1",
      "+cmd",
      "-cmd",
      "@SUM(A1)",
      "\t=HYPERLINK(bad)",
      "\n+bad",
    ]) {
      snapshot.rows[0].cells.TITLE = text;
      const bytes = await f.realRenderer.render(
          snapshot,
          t,
          f.request("XLSX_STUDENTS"),
          "00000000-0000-4000-8000-000000000025",
          "2030-11-07T01:05:00Z",
          ids.faculty,
        ),
        workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes as never);
      const row = workbook.worksheets[0].getRow(6);
      expect(row.getCell(t.columns.indexOf("STUDENT_CODE") + 1).value).toBe(
        "00001234",
      );
      expect(row.getCell(t.columns.indexOf("GIVEN_NAME") + 1).value).toBe(
        "Nguyễn Ánh",
      );
      const cell = row.getCell(t.columns.indexOf("TITLE") + 1);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.formula).toBeUndefined();
      expect(cell.value).toBe(excelText(text));
    }
  });
  it.each(["missing", "legacy", "stale", "missing-reviewer", "missing-member"])(
    "rejects %s UC24 evidence instead of recomputing a result",
    async (kind) => {
      if (kind === "missing") f.result.state.row = null;
      if (kind === "legacy") f.result.state.row!.context = null;
      if (kind === "stale") f.result.cg.state.scores[0].revision++;
      if (kind === "missing-reviewer") f.result.cg.rg.state.scores.splice(0);
      if (kind === "missing-member") f.result.cg.state.scores.splice(0, 1);
      const preview = await f.preview();
      expect(preview.blockers).toContain("MISSING_SOURCE:FINAL_RESULT");
      expect(preview.rows[0].cells.FINAL_SCORE).toBe("");
      await expect(
        f.service.export(ids.faculty, await f.body(), "invalid"),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.state.events).toHaveLength(0);
    },
  );
  it("exporting never mutates advisor/reviewer/member scores, final results or minutes", async () => {
    const before = structuredClone({
      advisor: f.result.f.state.score,
      reviewer: f.result.cg.rg.state.scores,
      member: f.result.cg.state.scores,
      result: f.result.state.row,
    });
    const m = await f.service.export(ids.faculty, await f.body(), "unchanged");
    await f.service.download(ids.faculty, m.id, "unchanged-get");
    expect({
      advisor: f.result.f.state.score,
      reviewer: f.result.cg.rg.state.scores,
      member: f.result.cg.state.scores,
      result: f.result.state.row,
    }).toEqual(before);
  });
  it("role permissions cannot combine ADMIN content access with FACULTY ingress", async () => {
    const u = f.users.get(ids.faculty)!;
    u.userRoles[0].role.rolePermissions =
      u.userRoles[0].role.rolePermissions.filter(
        (p) =>
          p.permission.resource !== "defense-report" ||
          p.permission.action !== "components-export",
      );
    u.userRoles.push({
      role: {
        name: "ADMIN",
        rolePermissions: [
          {
            permission: {
              resource: "defense-report",
              action: "components-export",
            },
          },
        ],
      },
    } as never);
    await expect(f.preview()).rejects.toMatchObject({ status: 403 });
  });
  it("expired reports cannot be regenerated and a changed grant hides historical scope", async () => {
    const m = await f.service.export(ids.faculty, await f.body(), "ttl");
    vi.setSystemTime("2030-12-08T01:05:00Z");
    await expect(
      f.service.download(ids.faculty, m.id, "expired"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("readonly options/templates/statistics/preview never write and use current UC24 snapshot", async () => {
    expect((await f.service.options(ids.faculty, {})).terms).toHaveLength(1);
    expect((await f.preview()).blockers).toEqual([]);
    const stats = await f.service.statistics(ids.faculty, { termId: ids.term });
    expect(stats.students).toBe(1);
    expect(stats.committees).toBe(1);
    expect(stats.lecturers).toBe(5);
    expect(stats.reviewerSheets).toBe(1);
    expect(stats.committeeSheets).toBe(3);
    expect(stats.finalizedResults).toBe(1);
    expect(stats.publishedResults).toBe(1);
    expect(stats.passRate).toBeNull();
    expect(f.state.events).toEqual([]);
    expect(f.state.keys.size).toBe(0);
  });
  it("creates true XLSX, reopens data, preserves snapshot decimal and audits generation separately from delivery", async () => {
    const m = await f.service.export(ids.faculty, await f.body(), "xlsx"),
      file = await f.service.download(ids.faculty, m.id, "get-xlsx");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file.bytes as never);
    const values = book.worksheets[0].getRow(6).values as ExcelJS.CellValue[];
    expect(values).toContain(f.result.f.p.student.studentCode);
    expect(values).toContain(f.result.state.row!.finalScore);
    expect(book.worksheets).toHaveLength(1);
    expect(book.worksheets[0].state).toBe("visible");
    expect(file.contentType).toContain("spreadsheetml");
    expect(file.filename).toMatch(
      /^uc25-XLSX_OFFICIAL_RESULTS-[a-f0-9-]+\.xlsx$/,
    );
    expect(f.state.events.map((e) => e.action)).toEqual([
      "EXPORT_GENERATED",
      "DELIVERY_PREPARED",
    ]);
    expect(JSON.stringify(f.state.events)).not.toContain(
      f.result.f.p.topic.title,
    );
    expect(JSON.stringify(f.state.events)).not.toContain('"FINAL_SCORE"');
  });
  it("XLSX bytes are deterministic across clock changes, with actual export date retained", async () => {
    const m = await f.service.export(ids.faculty, await f.body(), "clock"),
      one = await f.service.download(ids.faculty, m.id, "one");
    vi.setSystemTime("2030-11-07T01:05:10Z");
    const two = await f.service.download(ids.faculty, m.id, "two");
    expect(two.bytes.equals(one.bytes)).toBe(true);
  });
  it("renders a real Unicode PDF without network/OS fonts, never inventing signatures", async () => {
    const b = await f.body(f.request("PDF_COMMITTEE_RESULTS")),
      m = await f.service.export(ids.faculty, b, "pdf"),
      file = await f.service.download(ids.faculty, m.id, "pdf-get");
    const parsed = await parsePdf(file.bytes);
    expect(parsed.numpages).toBeGreaterThan(0);
    expect(parsed.text).toContain("Sinh viên");
    expect(parsed.text).toContain("CHƯA KÝ");
    expect(parsed.text).toContain(f.result.state.row!.finalScore);
    expect(file.contentType).toBe("application/pdf");
  });
  it("minutes block missing conclusion/remarks, or mark approved blank fields and unsigned status explicitly", async () => {
    const b = f.request("PDF_MINUTES", "DRAFT");
    expect((await f.preview(b)).blockers).toContain(
      "MISSING_SOURCE:CONCLUSION",
    );
    const t = f.policy.templates.find((t) => t.code === "PDF_MINUTES")!;
    t.allowMissing = ["CONCLUSION", "DEFENSE_REMARKS", "REVISION_REQUESTS"];
    const p = await f.preview(b);
    expect(p.blockers).toEqual([]);
    const m = await f.service.export(ids.faculty, await f.body(b), "minutes"),
      file = await f.service.download(ids.faculty, m.id, "minutes-get");
    const parsed = await parsePdf(file.bytes);
    expect(parsed.text).toContain("MISSING_SOURCE");
    expect(parsed.text).toContain("CHƯA PHÊ DUYỆT");
    expect(parsed.text).toContain("CHƯA KÝ");
    expect(parsed.text).not.toContain("đã ký");
  });
  it("student/admin/outsider cannot export or download by guessing ID", async () => {
    for (const actor of [ids.student, ids.admin, ids.outsider])
      await expect(f.service.preview(actor, f.request())).rejects.toBeDefined();
    const m = await f.service.export(ids.faculty, await f.body(), "owner");
    await expect(
      f.service.download(ids.student, m.id, "guess"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("committee member cannot export the whole term; own committee requires explicit UC24 content permission/policy", async () => {
    const actor = f.result.cg.actor();
    await expect(f.preview(f.request(), actor)).rejects.toMatchObject({
      status: 404,
    });
    const b = f.request("XLSX_OFFICIAL_RESULTS", "OFFICIAL", true);
    expect((await f.preview(b, actor)).count).toBe(1);
    f.policy.memberResults = "DENY";
    await expect(f.preview(b, actor)).rejects.toMatchObject({ status: 403 });
  });
  it("unpublished result is excluded unless approved template explicitly permits internal finalized output", async () => {
    f = await createReportingFixture(false);
    expect((await f.preview()).blockers).toContain(
      "MISSING_SOURCE:RESULT_NOT_PUBLISHED",
    );
    f.policy.templates.find(
      (t) => t.code === "XLSX_OFFICIAL_RESULTS",
    )!.requirePublished = false;
    expect((await f.preview()).blockers).toEqual([]);
  });
  it.each(["policy", "template", "pdf", "grade"])(
    "source %s change after generation blocks download without changing score/history",
    async (kind) => {
      const m = await f.service.export(ids.faculty, await f.body(), "stale");
      if (kind === "policy") f.result.policy.version += "changed";
      if (kind === "template") f.policy.templates[0].name += "changed";
      if (kind === "pdf") f.result.cg.control.corrupt = true;
      if (kind === "grade") f.result.cg.state.scores[0].revision++;
      await expect(
        f.service.download(ids.faculty, m.id, "stale-get"),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        f.state.events.filter((e) => e.action === "DELIVERY_PREPARED"),
      ).toHaveLength(0);
    },
  );
  it("same key/body replays one metadata event; different body is conflict", async () => {
    const b = await f.body(),
      one = await f.service.export(ids.faculty, b, "same");
    expect(await f.service.export(ids.faculty, b, "same")).toEqual(one);
    const changed = await f.body(f.request("XLSX_TERM_RESULTS"));
    await expect(
      f.service.export(ids.faculty, changed, "same"),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.events).toHaveLength(1);
  });
  it("render failure records a redacted failure, never success", async () => {
    f.control.renderFailure = true;
    await expect(
      f.service.export(ids.faculty, await f.body(), "fail"),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.events.map((e) => e.action)).toEqual(["GENERATION_FAILED"]);
    expect(JSON.stringify(f.state.events)).not.toContain("private details");
  });
  it.each(["eventFailure", "rememberFailure"] as const)(
    "atomic rollback on %s",
    async (flag) => {
      f.control[flag] = true;
      await expect(
        f.service.export(ids.faculty, await f.body(), "rollback"),
      ).rejects.toThrow();
      expect(f.state.events).toEqual([]);
      expect(f.state.keys.size).toBe(0);
    },
  );
  it("source change during rendering is rejected before publication audit", async () => {
    const render = f.renderer.render.bind(f.renderer);
    f.renderer.render = async (...args) => {
      const bytes = await render(...args);
      f.result.cg.state.scores[0].revision++;
      return bytes;
    };
    await expect(
      f.service.export(ids.faculty, await f.body(), "race"),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.events).toEqual([]);
  });
  it("write flag false blocks metadata/download but allows readonly preview", async () => {
    f.control.writes = false;
    expect((await f.preview()).canExport).toBe(false);
    await expect(
      f.service.export(ids.faculty, await f.body(), "off"),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.state.events).toEqual([]);
  });
  it("draft/missing policy and template version cannot become official", async () => {
    f.control.policy = false;
    const b = { ...f.request(), templateVersion: "ENGINEERING_DRAFT_V1" };
    expect((await f.preview(b)).blockers).toContain("TEMPLATE_NOT_APPROVED");
    await expect(
      f.service.export(ids.faculty, await f.body(b), "unapproved"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(f.preview(f.request())).rejects.toMatchObject({ status: 409 });
  });
  it("strict contracts reject actor/path/source/formula injection", async () => {
    const b = await f.body();
    for (const extra of [
      { actorId: ids.admin },
      { filePath: "../../uploads" },
      { source: "raw" },
      { formula: "40/60" },
    ])
      expect(ReportExportSchema.safeParse({ ...b, ...extra }).success).toBe(
        false,
      );
  });
  it("limits rows/candidates/bytes instead of silently dropping students", async () => {
    f.control.maxRows = 0;
    await expect(f.preview()).rejects.toMatchObject({ status: 409 });
  });
  it("download requires live content permission and history stays owned", async () => {
    const m = await f.service.export(ids.faculty, await f.body(), "live");
    expect(
      await f.service.history(ids.faculty, { termId: ids.term }),
    ).toHaveLength(1);
    f.users.get(ids.faculty)!.userRoles[0].role.rolePermissions = f.users
      .get(ids.faculty)!
      .userRoles[0].role.rolePermissions.filter(
        (p) =>
          p.permission.resource !== "defense-report" ||
          p.permission.action !== "download",
      );
    await expect(
      f.service.download(ids.faculty, m.id, "revoked"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
