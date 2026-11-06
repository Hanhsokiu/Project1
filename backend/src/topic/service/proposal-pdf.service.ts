import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderTemplate, escapeHtml } from "../../common/util/template.util";
import { TopicService } from "./topic.service";
@Injectable()
export class ProposalPdfService {
  constructor(private readonly config: ConfigService) {}
  async render(
    data: Awaited<ReturnType<TopicService["version"]>>,
    degree: "bachelor" | "engineer",
  ) {
    const v = data.version,
      content = v.content as unknown as {
        title: string;
        objectives: string;
        scope: string;
        technology: string;
        expected: string;
        plan: { week: string; content: string }[];
        metadata: Record<string, string>;
      };
    if (!content.metadata || !Array.isArray(content.plan))
      throw new UnprocessableEntityException(
        "Phiên bản lịch sử thiếu dữ liệu biểu mẫu; cần xử lý nguồn có truy vết trước khi xuất PDF.",
      );
    const template = await readFile(
      resolve(
        process.cwd(),
        `templates/pdf/${degree === "engineer" ? "de-cuong-ky-su" : "de-cuong"}.html`,
      ),
      "utf8",
    );
    let html = renderTemplate(
      template,
      {
        ...content.metadata,
        topicTitle: content.title,
        description: `Mục tiêu: ${content.objectives}\nNội dung, phạm vi: ${content.scope}`,
        technologies: content.technology,
        expectedResults: content.expected,
      },
      {
        tasks: content.plan.map((p) => ({
          title: p.content,
          deadline: p.week,
          status: "",
        })),
      },
    );
    html = html.replace(
      /Hệ:<\/strong> Chính quy/g,
      `Hệ:</strong> ${escapeHtml(content.metadata.program)}`,
    );
    if (degree === "bachelor")
      html = html.replace(
        "<h3>3. Kế hoạch thực hiện đề tài</h3>",
        `<h3>3. Các kết quả chính dự kiến đạt được</h3><p>${escapeHtml(content.expected)}</p><h3>4. Kế hoạch thực hiện đề tài</h3>`,
      );
    const label = data.official
      ? "BẢN CHÍNH THỨC"
      : `BẢN NHÁP — ${v.status === "SUBMITTED" ? "CHỜ DUYỆT" : "CHƯA NỘP"}`;
    html = html.replace(
      "<body>",
      `<body><div style="text-align:center;color:#555;font-size:10pt">${label} · Phiên bản ${v.version} · ${v.createdAt.toISOString()}<br>Mã phiên bản: ${v.id}</div>`,
    );
    html = html.replace(
      "</style>",
      "p {white-space: normal; overflow-wrap:anywhere} tr {break-inside:avoid} @page {size:A4;margin:12mm} </style>",
    );
    const executablePath = this.config.get<string>("PDF_CHROME_PATH");
    const browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : { channel: "chrome" }),
    });
    try {
      const page = await browser.newPage();
      await page.route("**/*", (route) => route.abort());
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      return await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
    } finally {
      await browser.close();
    }
  }
}
