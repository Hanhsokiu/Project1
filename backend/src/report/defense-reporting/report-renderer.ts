import { Injectable } from "@nestjs/common";
import ExcelJS = require("exceljs");
import PDFDocument = require("pdfkit");
import { resolve } from "path";
import type { ReportColumn, ReportRequest, ReportTemplate } from "@doan/shared";
import type { ReportSnapshot } from "./report.reader";
import { columnNames } from "./report-templates";
import { DossierPdfService } from "../../topic/proposal-dossiers/dossier-pdf.service";
import { groupError } from "../../topic/review-groups/review-group.errors";
const scoreColumns = new Set<ReportColumn>([
  "ADVISOR_SCORE",
  "REVIEWER_SCORE",
  "COMMITTEE_SCORE",
  "FINAL_SCORE",
]);
export function excelText(value: string) {
  let i = 0;
  while (
    i < value.length &&
    (value.charCodeAt(i) <= 32 || /\s/u.test(value[i]))
  )
    i++;
  return i < value.length && "=+@-".includes(value[i]) ? "'" + value : value;
}
export function reportDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
// JSZip stamps entries with wall clock. Normalize only ZIP header timestamps so
// regenerated files have identical bytes; workbook metadata retains actual export time.
function stableZip(bytes: Buffer) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > bytes.length) throw Error("INVALID_XLSX_ARCHIVE");
  let offset = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw Error("INVALID_XLSX_ARCHIVE");
    const local = bytes.readUInt32LE(offset + 42);
    if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50)
      throw Error("INVALID_XLSX_ARCHIVE");
    for (const pos of [offset + 12, local + 10]) {
      bytes.writeUInt16LE(0, pos);
      bytes.writeUInt16LE(0x2821, pos + 2);
    }
    offset +=
      46 +
      bytes.readUInt16LE(offset + 28) +
      bytes.readUInt16LE(offset + 30) +
      bytes.readUInt16LE(offset + 32);
  }
  return bytes;
}
@Injectable()
export class ReportRenderer {
  constructor(private readonly dossierPdf: DossierPdfService) {}
  async render(
    snapshot: ReportSnapshot,
    template: ReportTemplate,
    request: ReportRequest,
    id: string,
    at: string,
    actor: string,
  ) {
    if (template.format === "XLSX")
      return this.xlsx(snapshot, template, request, id, at, actor);
    if (template.code === "PDF_DOSSIER") {
      if (!snapshot.dossier)
        groupError(409, "MISSING_SOURCE", "Chưa có đề cương hợp lệ.");
      return (
        await this.dossierPdf.render(
          snapshot.dossier.snapshot,
          id,
          new Date(at),
          request.mode === "DRAFT",
        )
      ).bytes;
    }
    return this.pdf(snapshot, template, request, id, at, actor);
  }
  private async xlsx(
    s: ReportSnapshot,
    t: ReportTemplate,
    r: ReportRequest,
    id: string,
    at: string,
    actor: string,
  ) {
    const book = new ExcelJS.Workbook();
    book.creator = "DATN Reporting";
    book.lastModifiedBy = "DATN Reporting";
    book.created = new Date(at);
    book.modified = new Date(at);
    const sheet = book.addWorksheet("Báo cáo", {
        views: [{ state: "frozen", ySplit: 5 }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      }),
      count = t.columns.length;
    sheet.columns = t.columns.map((c) => ({
      width:
        c === "TITLE" || c === "COMMENTS" ? 45 : c === "STUDENT_CODE" ? 20 : 24,
    }));
    [
      t.institution
        ? `${t.institution.school} — ${t.institution.faculty}`
        : "MẪU KỸ THUẬT CHƯA ĐƯỢC PHÊ DUYỆT",
      t.name,
      `${s.termCode} — ${s.termName} | ${r.mode === "DRAFT" ? "DRAFT / CHƯA CHÍNH THỨC / CHƯA PHÊ DUYỆT" : "DỮ LIỆU ĐÃ XÁC MINH — CHƯA KÝ"}`,
      `Mẫu ${t.code} v${t.version} | ${reportDate(at)} | người xuất ${actor} | mã ${id}`,
    ].forEach((text, i) => {
      sheet.getCell(i + 1, 1).value = excelText(text);
      if (count > 1) sheet.mergeCells(i + 1, 1, i + 1, count);
      sheet.getRow(i + 1).font = {
        name: "Calibri",
        size: i === 1 ? 14 : 10,
        bold: i < 3,
      };
      sheet.getRow(i + 1).height = 28;
    });
    sheet.getRow(5).values = t.columns.map((c) => columnNames[c]);
    sheet.getRow(5).font = { bold: true };
    sheet.getRow(5).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCE6F1" },
    };
    for (const row of s.rows) {
      const values = t.columns.map((c) => {
        const value = row.cells[c] ?? "";
        return scoreColumns.has(c)
          ? value
          : excelText(c === "DATE" ? reportDate(value) : value);
      });
      const out = sheet.addRow(values);
      out.alignment = { vertical: "top", wrapText: true };
      t.columns.forEach((c, i) => {
        const cell = out.getCell(i + 1);
        cell.numFmt = "@";
        if (scoreColumns.has(c) && row.cells[c]) {
          const value = row.cells[c]!; // Only 0..10 finalized decimal strings, no Excel formulas or floating calculation.
          if (!/^(?:[0-9]|10)(?:\.\d{1,6})?$/.test(value))
            throw Error("INVALID_SNAPSHOT_SCORE");
          cell.value = value; // Text preserves every approved digit without IEEE-754 conversion.
        }
      });
    }
    sheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: sheet.rowCount, column: count },
    };
    sheet.pageSetup.printTitlesRow = "1:5";
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFAAAAAA" } },
        };
      }),
    );
    return stableZip(Buffer.from(await book.xlsx.writeBuffer()));
  }
  private pdf(
    s: ReportSnapshot,
    t: ReportTemplate,
    r: ReportRequest,
    id: string,
    at: string,
    actor: string,
  ): Promise<Buffer> {
    return new Promise((resolveBytes, reject) => {
      const form = [
          "PDF_ADVISOR_GRADE",
          "PDF_REVIEWER_GRADE",
          "PDF_MINUTES",
        ].includes(t.code),
        doc = new PDFDocument({
          size: "A4",
          layout: form ? "portrait" : "landscape",
          margin: 42,
          bufferPages: true,
          info: {
            Title: t.name,
            Author: "DATN Reporting",
            CreationDate: new Date(at),
            ModDate: new Date(at),
          },
        }),
        chunks: Buffer[] = [];
      doc.on("data", (b: Buffer) => chunks.push(b));
      doc.on("error", reject);
      doc.on("end", () => resolveBytes(Buffer.concat(chunks)));
      try {
        doc.registerFont(
          "regular",
          resolve(__dirname, "../../../assets/fonts/NotoSerif-Regular.ttf"),
        );
        doc.registerFont(
          "bold",
          resolve(__dirname, "../../../assets/fonts/NotoSerif-Bold.ttf"),
        );
        const width = doc.page.width - 84,
          bottom = () => doc.page.height - 70;
        const header = () => {
          doc
            .font("bold")
            .fontSize(11)
            .text(
              t.institution
                ? `${t.institution.school}\n${t.institution.faculty}`
                : "MẪU KỸ THUẬT CHƯA PHÊ DUYỆT",
              42,
              42,
              { width, align: "center" },
            )
            .moveDown(0.4)
            .fontSize(14)
            .text(t.name, { align: "center" })
            .moveDown(0.3)
            .font("regular")
            .fontSize(9)
            .text(`${s.termCode} — ${s.termName}`, { align: "center" })
            .moveDown();
        };
        const next = () => {
          doc.addPage();
          header();
        };
        header();
        if (form) {
          for (const [index, row] of s.rows.entries()) {
            if (index) next();
            if (t.code === "PDF_MINUTES") {
              const fact = s.facts[index];
              const roles: Record<string, string> = {
                CHAIR: "Chủ tịch",
                SECRETARY: "Thư ký",
                MEMBER: "Thành viên",
              };
              doc
                .font("regular")
                .fontSize(10)
                .text(
                  "Thành phần hội đồng: " +
                    s.committeeMembers
                      .filter(
                        (m) => m.committeeId === fact?.committee?.committeeId,
                      )
                      .map((m) => `${roles[m.role] ?? m.role}: ${m.name}`)
                      .join("; "),
                  { width },
                )
                .moveDown();
            }
            for (const c of t.columns) {
              const text = `${columnNames[c]}: ${c === "DATE" ? reportDate(row.cells[c] ?? "") : row.cells[c] || "MISSING_SOURCE — chưa có dữ liệu"}`;
              doc.font("regular").fontSize(10);
              if (
                doc.y + Math.min(45, doc.heightOfString(text, { width })) >
                bottom()
              )
                next();
              doc.text(text, 42, doc.y, { width, lineGap: 2 }).moveDown(0.45);
            }
            if (row.missing.length)
              doc
                .fontSize(9)
                .text("Nguồn còn thiếu: " + row.missing.join(", "), { width });
            if (t.signatureRoles.length) {
              if (doc.y + 90 > bottom()) next();
              doc
                .moveDown()
                .font("bold")
                .fontSize(10)
                .text(
                  t.signatureRoles
                    .map(
                      (role) =>
                        ({
                          CHAIR: "Chủ tịch",
                          SECRETARY: "Thư ký",
                          STUDENT: "Sinh viên",
                          FACULTY: "Khoa",
                        })[role],
                    )
                    .join("                 "),
                  {
                    align: "center",
                  },
                )
                .moveDown(2)
                .font("regular")
                .fontSize(9)
                .text(
                  "Vị trí ký trên giấy — CHƯA KÝ; không có chứng cứ chữ ký điện tử.",
                  { align: "center" },
                );
            }
          }
        } else {
          const panels: ReportColumn[][] = [];
          for (let i = 0; i < t.columns.length; i += 6) {
            const group = t.columns.slice(i, i + 6);
            panels.push(
              i &&
                t.columns.includes("STUDENT_CODE") &&
                !group.includes("STUDENT_CODE")
                ? ["STUDENT_CODE", ...group]
                : group,
            );
          }
          for (const [part, columns] of panels.entries()) {
            if (part) next();
            const cellWidth = width / columns.length;
            const headings = () => {
              doc.font("bold").fontSize(8);
              const y = doc.y,
                height =
                  Math.max(
                    ...columns.map((c) =>
                      doc.heightOfString(columnNames[c], {
                        width: cellWidth - 8,
                      }),
                    ),
                  ) + 12;
              columns.forEach((c, i) => {
                doc.rect(42 + i * cellWidth, y, cellWidth, height).stroke();
                doc.text(columnNames[c], 46 + i * cellWidth, y + 5, {
                  width: cellWidth - 8,
                });
              });
              doc.y = y + height;
              doc.x = 42;
            };
            headings();
            for (const row of s.rows) {
              doc.font("regular").fontSize(8);
              const lines = columns.map((c) => {
                const text =
                    c === "DATE"
                      ? reportDate(row.cells[c] ?? "")
                      : (row.cells[c] ?? ""),
                  result: string[] = [];
                let current = "";
                for (const char of text) {
                  if (
                    char === "\n" ||
                    (current &&
                      doc.widthOfString(current + char) > cellWidth - 8)
                  ) {
                    result.push(current);
                    current = "";
                  }
                  if (char !== "\n") current += char;
                }
                result.push(current);
                return result;
              });
              let start = 0,
                remaining = Math.max(...lines.map((l) => l.length));
              while (remaining > 0) {
                if (doc.y + 26 > bottom()) {
                  next();
                  headings();
                  doc.font("regular").fontSize(8);
                }
                const count = Math.min(
                    remaining,
                    Math.floor((bottom() - doc.y - 10) / 12),
                  ),
                  height = count * 12 + 10,
                  y = doc.y;
                lines.forEach((l, i) => {
                  doc.rect(42 + i * cellWidth, y, cellWidth, height).stroke();
                  doc.text(
                    l.slice(start, start + count).join("\n"),
                    46 + i * cellWidth,
                    y + 5,
                    { width: cellWidth - 8, lineGap: 0 },
                  );
                });
                doc.y = y + height;
                doc.x = 42;
                start += count;
                remaining -= count;
              }
            }
          }
        }
        const pages = doc.bufferedPageRange().count;
        for (let i = 0; i < pages; i++) {
          doc.switchToPage(i);
          const bottomMargin = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc
            .font("bold")
            .fontSize(9)
            .fillColor(r.mode === "DRAFT" ? "#b91c1c" : "#334155")
            .text(
              r.mode === "DRAFT"
                ? "DRAFT / CHƯA CHÍNH THỨC / CHƯA PHÊ DUYỆT"
                : "DỮ LIỆU ĐÃ XÁC MINH — CHƯA KÝ",
              42,
              20,
              { width, align: "center", lineBreak: false },
            );
          doc
            .font("regular")
            .fontSize(6)
            .fillColor("black")
            .text(
              `${t.code} v${t.version} | ${reportDate(at)} | ${actor} | ${id} | ${i + 1}/${pages}`,
              42,
              doc.page.height - 36,
              { width, align: "center", lineBreak: false },
            );
          doc.page.margins.bottom = bottomMargin;
        }
        doc.end();
      } catch (e) {
        doc.end();
        reject(e);
      }
    });
  }
}
