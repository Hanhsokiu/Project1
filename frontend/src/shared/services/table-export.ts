import type { jsPDF } from "jspdf";

export type ExportRow = Record<string, unknown>;

export function tableColumns(rows: ExportRow[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

export function tableCellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Draw a real grid, repeating its headings and splitting long cells across pages. */
export function renderPdfTable(
  doc: jsPDF,
  title: string,
  rows: ExportRow[],
  context: string[] = [],
): void {
  const keys = tableColumns(rows);
  const margin = 12;
  const padding = 2;
  const lineHeight = 3.8;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const availableWidth = pageWidth - margin * 2;
  const bottom = pageHeight - 18;
  doc.setFontSize(8);
  const weights = keys.map((key) => {
    const values = [
      key,
      ...rows.slice(0, 50).map((row) => String(tableCellValue(row[key]))),
    ];
    const textWidth = Math.max(
      ...values.flatMap((value) =>
        value
          .split(/\r?\n/)
          .map((line) => doc.getTextWidth(line.slice(0, 100))),
      ),
    );
    return Math.max(16, Math.min(48, textWidth + padding * 2));
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map(
    (weight) => (availableWidth * weight) / totalWeight,
  );
  const wrap = (value: unknown, width: number): string[] =>
    doc.splitTextToSize(
      String(tableCellValue(value)) || " ",
      Math.max(1, width - padding * 2),
    ) as string[];
  const headings = keys.map((key, index) => wrap(key, widths[index]));
  const headingHeight =
    Math.max(1, ...headings.map((lines) => lines.length)) * lineHeight +
    padding * 2;
  let y = margin;
  let bodyTop = margin;

  const drawCells = (
    cells: string[][],
    height: number,
    header: boolean,
    rowIndex: number,
    offset = 0,
    count = Infinity,
  ) => {
    let x = margin;
    keys.forEach((key, index) => {
      if (header) doc.setFillColor(30, 64, 120);
      else if (rowIndex % 2 === 0) doc.setFillColor(240, 245, 251);
      else doc.setFillColor(255, 255, 255);
      doc.setDrawColor(165, 180, 198);
      doc.setLineWidth(0.2);
      doc.rect(x, y, widths[index], height, "FD");
      if (header) doc.setTextColor(255, 255, 255);
      else doc.setTextColor(30, 32, 36);
      const numeric = !header && typeof rows[rowIndex][key] === "number";
      cells[index].slice(offset, offset + count).forEach((line, lineIndex) => {
        doc.text(
          line,
          numeric ? x + widths[index] - padding : x + padding,
          y + padding + lineIndex * lineHeight,
          { baseline: "top", align: numeric ? "right" : "left" },
        );
      });
      x += widths[index];
    });
    y += height;
  };

  const startPage = (addPage = false) => {
    if (addPage) doc.addPage();
    y = margin;
    doc.setTextColor(30, 32, 36);
    const paragraph = (value: string, size: number) => {
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(value, availableWidth) as string[];
      const spacing = size * 0.3528 * 1.25;
      for (const line of lines) {
        doc.text(line, margin, y, { baseline: "top" });
        y += spacing;
      }
      y += 1.5;
    };
    paragraph("TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI · KHOA CNTT", 9);
    paragraph(title.toLocaleUpperCase("vi"), 13);
    for (const line of context.filter(Boolean)) paragraph(line, 9);
    y += 2;
    doc.setFontSize(8);
    if (y + headingHeight + padding * 2 + lineHeight > bottom)
      throw new Error("Tiêu đề bảng quá dài để trình bày trên một trang PDF.");
    if (keys.length) drawCells(headings, headingHeight, true, 0);
    bodyTop = y;
  };

  startPage();
  if (!keys.length) {
    doc.setTextColor(30, 32, 36);
    doc.text("Không có dữ liệu phù hợp bộ lọc", margin, y, { baseline: "top" });
  }
  rows.forEach((row, rowIndex) => {
    if (!keys.length) return;
    doc.setFontSize(8);
    const cells = keys.map((key, index) => wrap(row[key], widths[index]));
    const totalLines = Math.max(1, ...cells.map((lines) => lines.length));
    const fullHeight = totalLines * lineHeight + padding * 2;
    // Move ordinary rows intact. Rows taller than a page are drawn in segments.
    if (fullHeight > bottom - y && fullHeight <= bottom - bodyTop)
      startPage(true);
    let offset = 0;
    while (offset < totalLines) {
      let capacity = Math.floor((bottom - y - padding * 2) / lineHeight + 1e-8);
      if (capacity < 1) {
        startPage(true);
        capacity = Math.floor((bottom - y - padding * 2) / lineHeight + 1e-8);
      }
      const count = Math.min(totalLines - offset, capacity);
      drawCells(
        cells,
        count * lineHeight + padding * 2,
        false,
        rowIndex,
        offset,
        count,
      );
      offset += count;
      if (offset < totalLines) startPage(true);
    }
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Trang ${page} / ${pages}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }
}
