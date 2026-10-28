import { httpClient } from "../api/http-client";
import { STEP3_API } from "../../features/registration/services/assignment-api";
import type { Topic } from "../data/types";
import { renderPdfTable, tableCellValue, tableColumns } from "./table-export";
export async function exportProposalPdf(
  topic: Topic,
  degree: string,
  fallback: () => Promise<void>,
  version?: number,
) {
  if (!STEP3_API) return fallback();
  const saved = version ?? topic.versions.slice(-1)[0]?.version;
  if (!saved) throw new Error("Cần lưu đề cương trước khi xuất PDF.");
  const response = await httpClient.get(
    `/topics/${topic.id}/versions/${saved}/pdf`,
    {
      params: { degree: degree === "Kỹ sư" ? "engineer" : "bachelor" },
      responseType: "blob",
      timeout: 60000,
    },
  );
  saveBlob(response.data, `de-cuong-v${saved}.pdf`);
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let fontPromise: Promise<string> | undefined;
function loadFont() {
  return (fontPromise ??= fetch("/fonts/BeVietnamPro-Regular.ttf")
    .then(async (res) => {
      if (!res.ok) throw new Error("Không tải được font xuất PDF");
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    })
    .catch((e) => {
      fontPromise = undefined;
      throw e;
    }));
}
export async function exportPdf(
  title: string,
  lines: string[],
  filename = "bieu-mau.pdf",
): Promise<void> {
  const [{ jsPDF }, font] = await Promise.all([import("jspdf"), loadFont()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("BeVietnam.ttf", font);
  doc.addFont("BeVietnam.ttf", "BeVietnam", "normal");
  doc.setFont("BeVietnam");
  doc.setFontSize(10);
  doc.setTextColor(30, 32, 36);
  let y = 18;
  const text = (value: string, size = 10) => {
    doc.setFontSize(size);
    const parts = doc.splitTextToSize(value || " ", 174) as string[];
    for (const part of parts) {
      if (y > 275) {
        doc.addPage();
        y = 19;
      }
      doc.text(part, 18, y);
      y += size * 0.5 + 1.2;
    }
  };
  text("TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI");
  text("KHOA CÔNG NGHỆ THÔNG TIN");
  y += 5;
  text(title.toLocaleUpperCase("vi"), 15);
  y += 5;
  for (const line of lines) text(line);
  y += 8;
  text("Tài liệu demo • Dữ liệu từ hệ thống quản lý đồ án tốt nghiệp UTC", 8);
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`${i} / ${doc.getNumberOfPages()}`, 190, 288, { align: "right" });
  }
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
export async function exportTablePdf(
  title: string,
  rows: Record<string, unknown>[],
  filename = "bao-cao.pdf",
  context: string[] = [],
): Promise<void> {
  const [{ jsPDF }, font] = await Promise.all([import("jspdf"), loadFont()]);
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: tableColumns(rows).length > 6 ? "landscape" : "portrait",
  });
  doc.addFileToVFS("BeVietnam.ttf", font);
  doc.addFont("BeVietnam.ttf", "BeVietnam", "normal");
  doc.setFont("BeVietnam");
  renderPdfTable(doc, title, rows, context);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export async function exportExcel(
  title: string,
  rows: Record<string, unknown>[],
  filename = "bao-cao.xlsx",
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const Workbook = ExcelJS.Workbook || ExcelJS.default.Workbook;
  const workbook = new Workbook();
  workbook.creator = "UTC GPMS";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(
    title.slice(0, 31).replace(/[\\/*?:[\]]/g, " "),
  );
  const keys = tableColumns(rows);
  if (keys.length) {
    sheet.columns = keys.map((key) => ({
      key,
      width: Math.min(
        55,
        Math.max(
          16,
          key.length + 3,
          ...rows.slice(0, 100).map(
            (row) =>
              Math.max(
                ...String(tableCellValue(row[key]))
                  .split(/\r?\n/)
                  .map((line) => line.length),
              ) + 2,
          ),
        ),
      ),
    }));
    sheet.addTable({
      name: "ExportData",
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: keys.map((name) => ({ name, filterButton: true })),
      rows: rows.map((row) => keys.map((key) => tableCellValue(row[key]))),
    });
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E4078" },
    };
    sheet.getRow(1).height = 26;
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.pageSetup = {
      orientation: keys.length > 6 ? "landscape" : "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:1",
    };
    sheet.eachRow((row, rowIndex) => {
      row.alignment = { vertical: "top", wrapText: true };
      if (rowIndex > 1) {
        const lineCount = Math.max(
          1,
          ...keys.map((key, index) =>
            String(tableCellValue(rows[rowIndex - 2][key]))
              .split(/\r?\n/)
              .reduce(
                (count, line) =>
                  count +
                  Math.max(
                    1,
                    Math.ceil(
                      line.length /
                        Math.max(
                          1,
                          (sheet.getColumn(index + 1).width ?? 16) - 2,
                        ),
                    ),
                  ),
                0,
              ),
          ),
        );
        row.height = Math.min(409, Math.max(24, lineCount * 15 + 8));
      }
      row.eachCell({ includeEmpty: true }, (cell) => {
        const edge = { style: "thin" as const, color: { argb: "FFB8C6D8" } };
        cell.border = { top: edge, bottom: edge, left: edge, right: edge };
        // Codes and phone numbers remain text, including leading zeroes.
        if (typeof cell.value === "string") cell.numFmt = "@";
      });
    });
  } else sheet.addRow(["Không có dữ liệu phù hợp bộ lọc"]);
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}
