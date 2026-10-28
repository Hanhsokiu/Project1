import { afterEach, describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import { exportExcel } from "./export-service";
import { renderPdfTable } from "./table-export";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PDF table pagination", () => {
  it("repeats headings and keeps the full grid inside landscape pages", () => {
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "landscape",
    });
    const text = vi.spyOn(doc, "text");
    const rect = vi.spyOn(doc, "rect");
    const rows = Array.from({ length: 90 }, (_, index) => ({
      Code: `ROW${String(index).padStart(3, "0")}`,
      Name: `Student ${index}`,
      Class: "CNTT K64",
      Email: `student${index}@example.test`,
      Phone: "0912345678",
      GPA: 3.25,
      Advisor: "Lecturer Name",
      Status: "Eligible",
      Term: "2026-2027",
    }));
    renderPdfTable(doc, "Student report", rows, ["Term: 2026-2027"]);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(text.mock.calls.filter(([value]) => value === "Code")).toHaveLength(
      doc.getNumberOfPages(),
    );
    for (const row of rows)
      expect(text.mock.calls.some(([value]) => value === row.Code)).toBe(true);
    for (const [x, y, width, height] of rect.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(12);
      expect(y).toBeGreaterThanOrEqual(12);
      expect(x + width).toBeLessThanOrEqual(
        doc.internal.pageSize.getWidth() - 12 + 0.001,
      );
      expect(y + height).toBeLessThanOrEqual(
        doc.internal.pageSize.getHeight() - 18 + 0.001,
      );
    }
  });

  it("continues a cell taller than one page without dropping its last lines or the following row", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const text = vi.spyOn(doc, "text");
    renderPdfTable(doc, "Long report", [
      {
        Code: "000000001",
        Notes: `${"A long paragraph with repeated content.\n".repeat(180)}END_OF_LONG_NOTE`,
      },
      { Code: "000000002", Notes: "LAST_ROW" },
    ]);
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    const values = text.mock.calls.map(([value]) => String(value));
    expect(values).toContain("000000001");
    expect(values).toContain("000000002");
    expect(values).toContain("END_OF_LONG_NOTE");
    expect(values).toContain("LAST_ROW");
    expect(values.filter((value) => value === "Code")).toHaveLength(
      doc.getNumberOfPages(),
    );
  });
});

describe("Excel table output", () => {
  it("writes a structured table with borders, frozen headings, filters and intact text codes", async () => {
    let downloaded: Blob | undefined;
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor });
    vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
      downloaded = value as Blob;
      return "blob:export-test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    await exportExcel(
      "Student report",
      [
        {
          Code: "001234567",
          Phone: "0912345678",
          GPA: 0,
          Eligible: false,
          Notes: "line 1\nline 2\nline 3",
        },
        {
          Code: "001234568",
          Phone: "",
          GPA: 3.25,
          Eligible: true,
          Notes: null,
          Extra: "Additional column",
        },
      ],
      "students.xlsx",
    );
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe("students.xlsx");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await downloaded!.arrayBuffer());
    const sheet = workbook.worksheets[0];
    expect(sheet.getTables()).toHaveLength(1);
    const table = sheet.getTable("ExportData") as unknown as {
      model: {
        style: { showRowStripes: boolean };
        columns: Array<{ filterButton: boolean }>;
      };
    };
    expect(table.model.style.showRowStripes).toBe(true);
    expect(table.model.columns.every((column) => column.filterButton)).toBe(
      true,
    );
    expect(sheet.getCell("A2").value).toBe("001234567");
    expect(sheet.getCell("B2").value).toBe("0912345678");
    expect(sheet.getCell("C2").value).toBe(0);
    expect(sheet.getCell("D2").value).toBe(false);
    expect(sheet.getCell("E2").value).toBe("line 1\nline 2\nline 3");
    expect(sheet.getRow(2).height).toBeGreaterThanOrEqual(53);
    expect(sheet.getCell("F1").value).toBe("Extra");
    expect(sheet.getCell("F3").value).toBe("Additional column");
    expect(sheet.getCell("A2").border.bottom?.style).toBe("thin");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.pageSetup.printTitlesRow).toBe("1:1");
    expect(sheet.pageSetup.fitToWidth).toBe(1);
  });
});
