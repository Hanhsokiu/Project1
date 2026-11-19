import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup as render } from "react-dom/server";
import { ReviewerGradeEditor, ReviewerGradeRows } from "./components";
import { syntheticGradeView } from "./reviewer-grade.fixture";
const noop = () => {};
describe("UC22 form and privacy projections (SSR component tests)", () => {
  it("shows assigned identity, advisor, committee, empty and distinct progress states", () => {
    const v = syntheticGradeView();
    expect(render(<ReviewerGradeRows items={[v]} select={noop} />)).toContain(
      "GVHD chính thức",
    );
    expect(render(<ReviewerGradeRows items={[]} select={noop} />)).toContain(
      "Không có hồ sơ",
    );
    for (const [state, label] of [
      ["NONE", "Chưa chấm"],
      ["DRAFT", "Bản nháp"],
      ["FINALIZED", "Đã chốt"],
      ["STALE", "Không còn hiệu lực"],
    ] as const) {
      v.state = state;
      expect(render(<ReviewerGradeRows items={[v]} select={noop} />)).toContain(
        label,
      );
    }
  });
  it("shows version/private PDF, score/feedback and draft/finalize controls disabled until download", () => {
    const html = render(
      <ReviewerGradeEditor
        view={syntheticGradeView()}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    for (const t of [
      "PDF phiên bản 1",
      "API private",
      "Nhận xét phản biện",
      "Ưu điểm",
      "Nhược điểm",
      "Câu hỏi phản biện",
      "Lưu nháp",
      "Chốt phiếu phản biện",
      "Tải và đọc PDF",
    ])
      expect(html).toContain(t);
    expect(html).toMatch(/disabled=""[^>]*>Lưu nháp/);
    expect(html).not.toContain("Đã lưu phiếu");
  });
  it("renders rubric criteria/version without using advisor rubric/default totals", () => {
    const v = syntheticGradeView();
    v.policy!.rubric = {
      version: "TEST_ONLY_REVIEW_RUBRIC",
      calculation: "WEIGHTED_NORMALIZED_10_EXACT",
      criteria: [
        {
          id: "c",
          name: "Tiêu chí phản biện riêng",
          maxScore: "10",
          step: "0.5",
          weight: "1",
        },
      ],
    };
    const html = render(
      <ReviewerGradeEditor
        view={v}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    expect(html).toContain("Tiêu chí phản biện riêng");
    expect(html).toContain("TEST_ONLY_REVIEW_RUBRIC");
  });
  it.each([
    "UC22_POLICY_REQUIRED",
    "REVIEWER_NOT_CURRENT",
    "FINAL_PDF_REQUIRED",
    "PDF_OR_ASSIGNMENT_CHANGED_REVIEW_REQUIRED",
    "UC22_NOT_ENABLED",
  ])("explains disabled state %s", (blocker) => {
    const v = syntheticGradeView();
    v.blockers = [blocker];
    const html = render(
      <ReviewerGradeEditor
        view={v}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    expect(html).toMatch(/disabled=""[^>]*>Chốt phiếu phản biện/);
  });
  it("faculty progress projection does not reconstruct hidden score/comment/history", () => {
    const v = syntheticGradeView();
    v.permissions = { save: false, finalize: false, download: false };
    v.state = "FINALIZED";
    const html = render(
      <ReviewerGradeEditor
        view={v}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    expect(html).toContain("Chế độ theo dõi");
    expect(html).not.toContain("Điểm phản biện:");
    expect(html).not.toContain("textarea");
  });
});
