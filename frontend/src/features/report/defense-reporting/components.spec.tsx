import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup as render } from "react-dom/server";
import { ReportPreviewTable, ReportStatisticsPanel } from "./components";
import { reportPreview, reportStatistics } from "./reporting.fixture";
describe("UC25 SSR projections; browser download/printing not verified", () => {
  it("preview shows data and template/version separately from approval and signature", () => {
    const s = render(<ReportPreviewTable preview={reportPreview()} />);
    for (const text of [
      "00001234",
      "Sinh viên kiểm thử",
      "8.4",
      "TEST_ONLY_V1",
      "DRAFT",
      "chưa ký",
      "Mẫu chưa được Khoa phê duyệt",
    ])
      expect(s).toContain(text);
  });
  it("missing sources and truncated preview remain explicit", () => {
    const p = reportPreview();
    p.truncated = true;
    p.count = 30;
    p.rows[0].missing = ["CONCLUSION"];
    p.blockers = ["MISSING_SOURCE:CONCLUSION"];
    p.mode = "OFFICIAL";
    const s = render(<ReportPreviewTable preview={p} />);
    expect(s).toContain("20 dòng đầu");
    expect(s).toContain("30 dòng");
    expect(s).toContain("CONCLUSION");
    expect(s).toContain("chưa đủ điều kiện xuất");
    expect(s).not.toContain("Dữ liệu được xác minh theo mẫu đã duyệt");
  });
  it("hostile names are escaped rather than executable markup", () => {
    const p = reportPreview();
    p.rows[0].cells.STUDENT_NAME = "<script>alert(1)</script>";
    const s = render(<ReportPreviewTable preview={p} />);
    expect(s).not.toContain("<script>");
    expect(s).toContain("&lt;script&gt;");
  });
  it("statistics distinguish students, lecturers, sessions and grade sheets", () => {
    const s = render(<ReportStatisticsPanel statistics={reportStatistics()} />);
    for (const label of [
      "Sinh viên trong scope",
      "Giảng viên có nhiệm vụ",
      "Phiên bảo vệ",
      "Phiếu GVPB",
      "Phiếu hội đồng",
      "Theo lớp",
      "Theo hội đồng",
      "Theo bộ môn",
    ])
      expect(s).toContain(label);
  });
  it("unknown grade/rate never become a fabricated zero or pass threshold", () => {
    const s = reportStatistics();
    s.average = null;
    s.passRate = null;
    s.committeeSheets = null;
    const html = render(<ReportStatisticsPanel statistics={s} />);
    expect(html).toContain("Chưa xác minh / chưa được phép xem");
    expect(html).toContain("không tự suy ngưỡng đạt");
    expect(html).not.toContain("5.0");
  });
  it("distribution only appears when provided by approved policy", () => {
    const s = reportStatistics();
    expect(render(<ReportStatisticsPanel statistics={s} />)).not.toContain(
      "Phân bố theo khoảng điểm",
    );
    s.distribution = [{ label: "TEST_ONLY band", count: 1 }];
    expect(render(<ReportStatisticsPanel statistics={s} />)).toContain(
      "TEST_ONLY band",
    );
  });
});
