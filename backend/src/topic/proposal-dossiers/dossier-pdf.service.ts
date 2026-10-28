import { Injectable } from "@nestjs/common";
import PDFDocument = require("pdfkit");
import { resolve } from "path";
import type { DossierPrintSnapshot } from "@doan/shared";
@Injectable()
export class DossierPdfService {
  async render(
    snapshot: DossierPrintSnapshot,
    reference: string,
    finalizedAt: Date,
  ) {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
      info: {
        Title: "Đề cương đồ án tốt nghiệp",
        Author: "Khoa Công nghệ thông tin",
        CreationDate: finalizedAt,
      },
    });
    const chunks: Buffer[] = [];
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    doc.registerFont(
      "regular",
      resolve(__dirname, "../../../assets/fonts/NotoSerif-Regular.ttf"),
    );
    doc.registerFont(
      "bold",
      resolve(__dirname, "../../../assets/fonts/NotoSerif-Bold.ttf"),
    );
    const width = doc.page.width - 100,
      bottom = doc.page.height - 60;
    const ensure = (height: number) => {
      if (doc.y + height > bottom) doc.addPage();
    };
    doc
      .font("bold")
      .fontSize(9)
      .text("TRƯỜNG ĐẠI HỌC GTVT\nKHOA CÔNG NGHỆ THÔNG TIN", 50, 50, {
        width: 220,
        align: "center",
      });
    doc.text(
      "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc",
      280,
      50,
      { width: width - 230, align: "center" },
    );
    doc
      .font("regular")
      .fontSize(10)
      .text("Hà Nội, ngày …… tháng …… năm ……", 50, 91, {
        width,
        align: "right",
      });
    doc
      .font("bold")
      .fontSize(14)
      .text("ĐỀ CƯƠNG ĐỒ ÁN TỐT NGHIỆP CỬ NHÂN", 50, 124, {
        width,
        align: "center",
      });
    doc.moveDown();
    const field = (label: string, value: string) => {
      doc
        .font("regular")
        .fontSize(11)
        .text(`${label}: ${value}`, 50, doc.y, { width });
      doc.moveDown(0.35);
    };
    field("Họ và tên sinh viên", snapshot.student.name);
    field("Mã SV", snapshot.student.code);
    field("Lớp", snapshot.student.className);
    field("Ngành", snapshot.student.majorName);
    field("Hệ đào tạo", snapshot.student.trainingSystem);
    field("Giảng viên hướng dẫn", snapshot.advisor.name);
    field("Đơn vị công tác", snapshot.advisor.department);
    field("Tên đề tài", snapshot.title);
    const section = (heading: string, text: string) => {
      ensure(55);
      doc.font("bold").fontSize(11).text(heading, 50, doc.y, { width });
      doc.moveDown(0.4);
      doc.font("regular").text(text, 50, doc.y, { width, lineGap: 3 });
      doc.moveDown(0.7);
    };
    section(
      "1. Nội dung, phạm vi của đề tài",
      `Mục tiêu: ${snapshot.content.objectives}\nNội dung: ${snapshot.content.mainContents}\nPhạm vi: ${snapshot.content.scope}`,
    );
    section(
      "2. Công nghệ, công cụ và ngôn ngữ lập trình",
      snapshot.content.tools,
    );
    section(
      "3. Các kết quả chính dự kiến đạt được",
      snapshot.content.expectedResults,
    );
    ensure(75);
    doc
      .font("bold")
      .fontSize(11)
      .text("4. Kế hoạch thực hiện đề tài", 50, doc.y, { width });
    doc.moveDown(0.5);
    const columns = [32, 200, 118, width - 350],
      lineHeight = 14;
    const wrap = (text: string, maxWidth: number) => {
      const lines: string[] = [];
      for (const paragraph of text.split(/\r?\n/)) {
        let line = "";
        for (const char of paragraph) {
          if (line && doc.widthOfString(line + char) > maxWidth) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
        lines.push(line);
      }
      return lines;
    };
    const cells = (values: string[][], count: number, bold = false) => {
      const y = doc.y,
        height = count * lineHeight + 12;
      let x = 50;
      doc.font(bold ? "bold" : "regular").fontSize(9);
      for (let i = 0; i < columns.length; i++) {
        doc.rect(x, y, columns[i], height).stroke();
        for (let j = 0; j < values[i].length; j++)
          doc.text(values[i][j], x + 5, y + 6 + j * lineHeight, {
            width: columns[i] - 10,
            lineBreak: false,
          });
        x += columns[i];
      }
      doc.y = y + height;
      doc.x = 50;
    };
    const header = () =>
      cells(
        [["STT"], ["Nội dung công việc"], ["Thời gian dự kiến"], ["Ghi chú"]],
        1,
        true,
      );
    const date = (v: string) =>
      new Date(v).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    header();
    for (const [index, period] of snapshot.content.schedule.entries()) {
      doc.font("regular").fontSize(9);
      const values = [
        String(index + 1),
        period.label,
        `${date(period.startsAt)} – ${date(period.endsAt)}`,
        period.deliverables,
      ].map((value, i) => wrap(value, columns[i] - 10));
      const total = Math.max(...values.map((v) => v.length));
      let offset = 0;
      while (offset < total) {
        if (doc.y + 12 + lineHeight > bottom) {
          doc.addPage();
          header();
        }
        const count = Math.min(
          total - offset,
          Math.floor((bottom - doc.y - 12) / lineHeight),
        );
        cells(
          values.map((lines) => lines.slice(offset, offset + count)),
          count,
        );
        offset += count;
      }
    }
    doc.moveDown();
    ensure(115);
    const y = doc.y,
      signatureWidth = width / 4;
    [
      "Trưởng Khoa",
      "Trưởng Bộ môn",
      "Giảng viên hướng dẫn",
      "Sinh viên thực hiện",
    ].forEach((label, i) => {
      doc
        .font("bold")
        .fontSize(9)
        .text(label, 50 + i * signatureWidth, y, {
          width: signatureWidth,
          align: "center",
        });
      doc
        .font("regular")
        .fontSize(8)
        .text("(Ký và ghi rõ họ tên)", 50 + i * signatureWidth, y + 28, {
          width: signatureWidth,
          align: "center",
        });
    });
    const pages = doc.bufferedPageRange().count;
    for (let i = 0; i < pages; i++) {
      doc.switchToPage(i);
      // Footer is inside the bottom margin; keep it from creating a new page.
      const margin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("regular")
        .fontSize(7)
        .text(
          `Hồ sơ ${reference} · ${i + 1}/${pages}`,
          50,
          doc.page.height - 35,
          { width, align: "center", lineBreak: false },
        );
      doc.page.margins.bottom = margin;
    }
    doc.end();
    return { bytes: await finished, pages };
  }
}
