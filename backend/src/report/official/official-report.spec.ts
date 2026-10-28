import { describe, expect, it, vi } from "vitest";
import ExcelJS = require("exceljs");
import {
  OfficialReportService,
  renderOfficialXlsx,
  renderPublishedResultsPdf,
  type ReportTable,
} from "./official-report.service";
import { gradingFixture } from "../../grading/workflow/grading.test-fixtures";
import type { GradingRepository } from "../../grading/workflow/grading.repository";
import type { AuditService } from "../../common/audit/audit.service";
const table: ReportTable = {
  title: "KẾT QUẢ ĐÃ CÔNG BỐ",
  columns: ["Sinh viên", "HP"],
  rows: [
    ["Nguyễn Văn An", 8.15],
    ['=HYPERLINK("evil")', 7],
  ],
};
async function fixture() {
  const f = await gradingFixture();
  await f.configure();
  const service = new OfficialReportService(
    f.repo as unknown as GradingRepository,
    f.service,
    f.sources,
    f.base.audit as unknown as AuditService,
  );
  return { f, service };
}
describe("UC25 official content, scope, empty and audit; no DB", () => {
  it("XLSX round trip contains real table values and treats formulas as text", async () => {
    const bytes = await renderOfficialXlsx(table),
      wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    expect(ws.getCell("A2").value).toBe("Nguyễn Văn An");
    expect(ws.getCell("B2").value).toBe(8.15);
    expect(ws.getCell("A3").type).toBe(ExcelJS.ValueType.String);
    expect(ws.getCell("A3").value).toBe('\'=HYPERLINK("evil")');
  });
  it("empty renderer produces headers only, not a fake official mark", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      (await renderOfficialXlsx({
        ...table,
        rows: [],
      })) as unknown as Parameters<typeof wb.xlsx.load>[0],
    );
    expect(wb.worksheets[0].rowCount).toBe(1);
  });
  it("PDF embeds existing Vietnamese font and produces actual content", async () => {
    const bytes = await renderPublishedResultsPdf(table);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
    // Verify actual byte offsets as well as parsing. No header-only assertion or
    // acceptance of the old pdf-parse 1.10 parser's intermittent XRef failures.
    const trailer = /startxref\s+(\d+)\s+%%EOF/.exec(bytes.toString("latin1"));
    expect(trailer).not.toBe(null);
    expect(
      bytes.subarray(Number(trailer![1]), Number(trailer![1]) + 4).toString(),
    ).toBe("xref");
    expect(bytes.includes(Buffer.from("/FontFile2"))).toBe(true);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      stopAtErrors: true,
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
    }).promise;
    try {
      let text = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i),
          content = await page.getTextContent();
        text += content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
      }
      expect(text).toContain("Nguyễn Văn An");
      expect(text).toContain("8.15");
    } finally {
      await doc.destroy();
    }
  });
  it("no publication means no result export, even for FACULTY", async () => {
    const { service } = await fixture();
    await expect(
      service.export("faculty-user", "term", {
        kind: "RESULTS",
        format: "XLSX",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("exports official UC20 assignment, never legacy or frontend-provided rows", async () => {
    const { f, service } = await fixture();
    const file = await service.export("faculty-user", "term", {
      kind: "REVIEWERS",
      format: "XLSX",
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      file.bytes as unknown as Parameters<typeof wb.xlsx.load>[0],
    );
    expect(wb.worksheets[0].rowCount).toBe(2);
    expect(wb.worksheets[0].getRow(2).values).toContain("reviewer · reviewer");
    expect(f.base.state.audit.at(-1)).toMatchObject({
      resource: "official-report",
      action: "EXPORT",
    });
  });
  it("does not export merely FINALIZED schedule as PUBLISHED", async () => {
    const { service } = await fixture();
    await expect(
      service.export("faculty-user", "term", {
        kind: "SCHEDULE",
        format: "XLSX",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it.each(["outside-grant", "admin", "permission"])(
    "denies %s",
    async (fault) => {
      const { f, service } = await fixture();
      if (fault === "outside-grant") f.grant.termId = "other";
      else if (fault === "admin") {
        f.grant.allDepartments = false;
        f.actors.get("faculty-user")!.userRoles[0].role.name = "ADMIN";
      } else
        f.actors.get("faculty-user")!.userRoles[0].role.rolePermissions = [];
      await expect(
        service.export("faculty-user", "term", {
          kind: "REVIEWERS",
          format: "XLSX",
        }),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
  it("department filter never widens grant", async () => {
    const { f, service } = await fixture();
    f.grant.allDepartments = false;
    f.grant.pr2bGrantDepartmentGrantId = [{ departmentId: "other" }];
    await expect(
      service.export("faculty-user", "term", {
        kind: "REVIEWERS",
        format: "XLSX",
        className: "x",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("undefined PDF minutes template is explicitly blocked", async () => {
    const { service } = await fixture();
    await expect(
      service.export("faculty-user", "term", {
        kind: "REVIEWERS",
        format: "PDF",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("audit failure prevents delivery and rolls back audit state", async () => {
    const { f, service } = await fixture(),
      before = f.base.state.audit.length;
    f.base.fault.at = "audit";
    await expect(
      service.export("faculty-user", "term", {
        kind: "REVIEWERS",
        format: "XLSX",
      }),
    ).rejects.toThrow("Injected");
    expect(f.base.state.audit).toHaveLength(before);
  });
  it("official summary counts scoped defense sources; unpublished scores stay absent", async () => {
    const { f, service } = await fixture();
    expect(await service.summary("faculty-user", "term", {})).toMatchObject({
      admitted: 1,
      committees: 1,
      reviewerAssignments: 1,
      publishedSlots: 0,
      publishedResults: 0,
    });
    f.grant.allDepartments = false;
    f.grant.pr2bGrantDepartmentGrantId = [{ departmentId: "outside" }];
    expect(await service.summary("faculty-user", "term", {})).toMatchObject({
      admitted: 0,
      committees: 0,
      publishedResults: 0,
    });
  });
  it("published workbook carries grade components, historical council and policy/hash trace without private data", async () => {
    const { f, service } = await fixture();
    f.approveForTest();
    await f.allScores();
    await f.resultCommand();
    await f.resultCommand(true);
    const historical = f.base.state.artifacts.find(
      (a) => a.stage === "SCHEDULE",
    )!;
    const committee = f.sources.artifact(historical)!.committees[0];
    const currentChain = vi
      .spyOn(f.sources, "chain")
      .mockRejectedValue(new Error("new current workflow is unavailable"));
    const file = await service.export("faculty-user", "term", {
      kind: "RESULTS",
      format: "XLSX",
      committeeKey: committee.key,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      file.bytes as unknown as Parameters<typeof wb.xlsx.load>[0],
    );
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).values).toEqual(
      expect.arrayContaining([
        "GVHD",
        "GVPB",
        "Policy revision",
        "SHA-256 bản công bố",
      ]),
    );
    expect(ws.getRow(2).values).toEqual(
      expect.arrayContaining([
        committee.name,
        9,
        10,
        f.state.results[0].current!.contentHash,
      ]),
    );
    expect(JSON.stringify(ws.getSheetValues())).not.toMatch(
      /storageKey|filePath|password|authorityReference|Câu hỏi/,
    );
    expect(currentChain).not.toHaveBeenCalled();
  });
  it("results with missing immutable input evidence never become exportable or a published count", async () => {
    const { f, service } = await fixture();
    f.approveForTest();
    await f.allScores();
    await f.resultCommand();
    await f.resultCommand(true);
    f.state.sheetHistory.splice(0);
    await expect(
      service.export("faculty-user", "term", {
        kind: "RESULTS",
        format: "XLSX",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await service.summary("faculty-user", "term", {})).publishedResults,
    ).toBe(0);
  });
  it("out-of-scope published records stay absent even when a committee filter matches", async () => {
    const { f, service } = await fixture();
    f.approveForTest();
    await f.allScores();
    await f.resultCommand();
    await f.resultCommand(true);
    const committee = f.sources.artifact(
      f.base.state.artifacts.find((a) => a.stage === "SCHEDULE")!,
    )!.committees[0];
    f.grant.allDepartments = false;
    f.grant.pr2bGrantDepartmentGrantId = [{ departmentId: "outside" }];
    await expect(
      service.export("faculty-user", "term", {
        kind: "RESULTS",
        format: "XLSX",
        committeeKey: committee.key,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("service checks export permission before exposing unsupported template status", async () => {
    const { f, service } = await fixture();
    f.actors.get("faculty-user")!.userRoles[0].role.rolePermissions = [];
    await expect(
      service.export("faculty-user", "term", {
        kind: "REVIEWERS",
        format: "PDF",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
