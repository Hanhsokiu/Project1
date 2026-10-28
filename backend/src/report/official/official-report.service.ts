import { Inject, Injectable } from "@nestjs/common";
import ExcelJS = require("exceljs");
import PDFDocument = require("pdfkit");
import { resolve } from "node:path";
import { z } from "zod";
import { GradingRepository } from "../../grading/workflow/grading.repository";
import { GradingService } from "../../grading/workflow/grading.service";
import { GradingSourceReader } from "../../grading/workflow/grading-source.reader";
import { gradingError, hashJson } from "../../grading/workflow/grading.policy";
import { academicTermScope } from "../../common/security/academic-term-scope.policy";
import { AuditService } from "../../common/audit/audit.service";
export const officialReportQuerySchema = z
  .object({
    kind: z.enum(["RESULTS", "REVIEWERS", "SCHEDULE"]),
    format: z.enum(["XLSX", "PDF"]),
    committeeKey: z.string().trim().min(1).max(36).optional(),
    className: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export type ReportRequest = z.infer<typeof officialReportQuerySchema>;
export const officialReportSummaryQuerySchema = officialReportQuerySchema.pick({
  committeeKey: true,
  className: true,
});
export type ReportTable = {
  title: string;
  columns: string[];
  rows: (string | number | boolean)[][];
};
export function excelText(value: string) {
  return /^[=+@\-\t\r]/.test(value) ? "'" + value : value;
}
export async function renderOfficialXlsx(table: ReportTable) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Project1";
  const ws = wb.addWorksheet("Du lieu chinh thuc");
  ws.addRow(table.columns);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of table.rows)
    ws.addRow(row.map((v) => (typeof v === "string" ? excelText(v) : v)));
  ws.columns.forEach((c) => {
    c.width = 24;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
export async function renderPublishedResultsPdf(table: ReportTable) {
  const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: { Title: table.title },
    }),
    chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolveResult, reject) => {
    doc.on("data", (b: Buffer) => chunks.push(b));
    doc.on("end", () => resolveResult(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont(
    "regular",
    resolve(__dirname, "../../../assets/fonts/NotoSerif-Regular.ttf"),
  );
  doc.font("regular").fontSize(14).text(table.title);
  doc
    .fontSize(9)
    .text(
      "Bản tra cứu kết quả đã công bố. Không thay thế biên bản ký theo mẫu của Khoa.",
    );
  table.rows.forEach((row, i) => {
    if (doc.y > doc.page.height - 145) doc.addPage();
    doc
      .moveDown()
      .fontSize(10)
      .text(
        `${i + 1}. ${table.columns.map((c, j) => `${c}: ${row[j]}`).join(" · ")}`,
      );
  });
  doc.end();
  return finished;
}
@Injectable()
export class OfficialReportService {
  constructor(
    @Inject(GradingRepository) private readonly repo: GradingRepository,
    @Inject(GradingService) private readonly grading: GradingService,
    @Inject(GradingSourceReader) private readonly sources: GradingSourceReader,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}
  async summary(
    userId: string,
    termId: string,
    filters: z.infer<typeof officialReportSummaryQuerySchema>,
  ) {
    return this.repo.transaction(false, async (s, tx) => {
      await this.grading.actor(s, userId, "read", "official-report");
      const scope = academicTermScope(
        await s.grants(userId, termId),
        userId,
        termId,
      );
      if (!scope.configured)
        gradingError(
          403,
          "REPORT_SCOPE_FORBIDDEN",
          "Cần grant đúng đợt/bộ môn.",
        );
      const chain = await this.sources.chain(s, tx, termId, true),
        all = await s.dossiers(termId),
        proposals = all.filter(
          (p) =>
            scope.contains(
              p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
                ?.departmentId,
            ) &&
            (!filters.className || p.student.className === filters.className) &&
            (!filters.committeeKey ||
              chain.committee.snapshot.committees.some(
                (c) =>
                  c.key === filters.committeeKey &&
                  c.proposalIds.includes(p.id),
              )),
        ),
        ids = new Set(proposals.map((p) => p.id)),
        results = (
          await Promise.all(
            (await s.results(termId))
              .filter((r) => ids.has(r.proposalId))
              .map((r) => this.grading.verifiedResult(s, r)),
          )
        ).filter((r) => r?.state === "PUBLISHED"),
        admitted = chain.root.students.filter(
          (x) => x.admitted && !!x.proposalId && ids.has(x.proposalId),
        );
      return {
        termId,
        scopedProposals: proposals.length,
        admitted: admitted.length,
        committees: chain.committee.snapshot.committees.filter((c) =>
          c.proposalIds.some((id) => ids.has(id)),
        ).length,
        reviewerAssignments: chain.reviewer.snapshot.reviewers.filter((r) =>
          ids.has(r.proposalId),
        ).length,
        publishedSlots:
          chain.schedule?.snapshot.state === "PUBLISHED"
            ? chain.schedule.snapshot.slots.filter((r) => ids.has(r.proposalId))
                .length
            : 0,
        publishedResults: results.length,
        passed: results.filter((r) => r?.passed).length,
        scope: scope.allDepartments ? "TERM" : "DEPARTMENTS",
      };
    });
  }
  async export(userId: string, termId: string, raw: ReportRequest) {
    const query = officialReportQuerySchema.parse(raw);
    return this.repo.transaction(true, async (s, tx) => {
      await this.grading.actor(s, userId, "export", "official-report");
      await s.lockGrading(termId);
      const grants = await s.grants(userId, termId),
        scope = academicTermScope(grants, userId, termId);
      if (!scope.configured)
        gradingError(
          403,
          "REPORT_SCOPE_FORBIDDEN",
          "Cần grant đúng đợt/bộ môn.",
        );
      if (query.format === "PDF" && query.kind !== "RESULTS")
        gradingError(
          409,
          "REPORT_TEMPLATE_NOT_CONFIGURED",
          "Mẫu PDF biên bản/lịch/phản biện chưa được cấu hình.",
        );
      if (!(await s.term(termId)))
        gradingError(404, "REPORT_TERM_NOT_FOUND", "Không tìm thấy đợt.");
      const proposals = (await s.dossiers(termId)).filter(
          (p) =>
            scope.contains(
              p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
                ?.departmentId,
            ) &&
            (!query.className || p.student.className === query.className),
        ),
        table: ReportTable = {
          title: "KẾT QUẢ ĐỒ ÁN ĐÃ CÔNG BỐ",
          columns: [],
          rows: [],
        };
      if (query.kind === "RESULTS") {
        await this.grading.actor(s, userId, "read-results");
        // Per-proposal publications only, never the term publication flag.
        const results = await s.results(termId);
        table.columns = [
          "Mã SV",
          "Sinh viên",
          "Lớp",
          "Đề tài",
          "Hội đồng tại công bố",
          "GVHD",
          "GVPB",
          "QT",
          "KTHP",
          "HP",
          "Đạt",
          "Revision",
          "Công bố",
          "Policy revision",
          "SHA-256 bản công bố",
        ];
        for (const p of proposals) {
          const row = results.find((r) => r.proposalId === p.id),
            a = await this.grading.verifiedResult(s, row ?? null);
          if (!a || a.termId !== termId || a.state !== "PUBLISHED") continue;
          // Filter by the immutable schedule referenced by the publication,
          // never relabel historical results using a newer council assignment.
          const artifact = await s.artifact(a.council.scheduleArtifactId);
          const snapshot = this.sources.artifact(artifact ?? undefined);
          const committee = snapshot?.committees.find((c) =>
            c.proposalIds.includes(p.id),
          );
          const student = snapshot?.students.find((x) => x.proposalId === p.id);
          if (
            !committee ||
            !student ||
            (query.committeeKey && query.committeeKey !== committee.key)
          )
            continue;
          table.rows.push([
            p.student.studentCode,
            student.studentName,
            p.student.className,
            student.title,
            committee.name,
            a.advisor.score,
            a.gradeValues.reviewer,
            a.process,
            a.committeeScore,
            a.final,
            a.passed,
            a.revision,
            a.recordedAt,
            a.policyRevision,
            row!.current!.contentHash,
          ]);
        }
      } else {
        const chain = await this.sources.chain(
          s,
          tx,
          termId,
          query.kind === "SCHEDULE",
        );
        if (
          query.kind === "SCHEDULE" &&
          chain.schedule?.snapshot.state !== "PUBLISHED"
        )
          gradingError(
            409,
            "REPORT_SCHEDULE_NOT_PUBLISHED",
            "Chỉ xuất lịch đã công bố.",
          );
        table.title =
          query.kind === "SCHEDULE"
            ? "LỊCH BẢO VỆ ĐÃ CÔNG BỐ"
            : "PHÂN CÔNG PHẢN BIỆN ĐÃ CHỐT";
        table.columns =
          query.kind === "SCHEDULE"
            ? [
                "Mã SV",
                "Sinh viên",
                "Đề tài",
                "Hội đồng",
                "Bắt đầu",
                "Kết thúc",
                "Phòng",
              ]
            : ["Mã SV", "Sinh viên", "Đề tài", "Hội đồng", "GVPB"];
        for (const p of proposals) {
          const committee = chain.committee.snapshot.committees.find((c) =>
            c.proposalIds.includes(p.id),
          );
          if (
            !committee ||
            (query.committeeKey && query.committeeKey !== committee.key)
          )
            continue;
          const base = [
            p.student.studentCode,
            p.student.fullName,
            p.topic.title,
            committee.name,
          ];
          if (query.kind === "SCHEDULE") {
            const slot = chain.schedule!.snapshot.slots.find(
              (s) => s.proposalId === p.id,
            );
            if (slot)
              table.rows.push([
                ...base,
                slot.startsAt,
                slot.endsAt,
                chain.schedule!.snapshot.rooms.find((r) => r.id === slot.roomId)
                  ?.code ?? "",
              ]);
          } else {
            const ids =
              chain.reviewer.snapshot.reviewers.find(
                (r) => r.proposalId === p.id,
              )?.reviewerIds ?? [];
            const people = await s.reportLecturers(ids);
            if (ids.length === 1)
              table.rows.push([
                ...base,
                people[0]
                  ? `${people[0].lecturerCode} · ${people[0].fullName}`
                  : ids[0],
              ]);
          }
        }
      }
      if (!table.rows.length)
        gradingError(
          404,
          "REPORT_NO_DATA",
          "Không có dữ liệu chính thức trong phạm vi/bộ lọc để xuất.",
        );
      const bytes =
        query.format === "PDF"
          ? await renderPublishedResultsPdf(table)
          : await renderOfficialXlsx(table);
      await this.grading.actor(s, userId, "export", "official-report");
      if (hashJson(await s.grants(userId, termId)) !== hashJson(grants))
        gradingError(
          409,
          "REPORT_SCOPE_CHANGED",
          "Phạm vi đã thay đổi; hãy tải lại.",
        );
      await this.audit.log(
        {
          userId,
          resource: "official-report",
          resourceId: termId,
          action: "EXPORT",
          newValue: {
            kind: query.kind,
            format: query.format,
            rows: table.rows.length,
            contentHash: hashJson(table),
          },
        },
        tx,
      );
      return {
        bytes,
        name: `${query.kind.toLowerCase()}-${termId}.${query.format.toLowerCase()}`,
        contentType:
          query.format === "PDF"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    });
  }
}
