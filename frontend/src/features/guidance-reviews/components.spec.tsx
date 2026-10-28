import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProgressReviewContext, ProgressReviewView } from "@doan/shared";
import {
  ProgressReviewForm,
  ProgressReviewHistory,
  GuidanceMeetingForm,
  progressDecisionLabel,
} from "./components";
describe("8C review frontend", () => {
  it("renders separate three-way decisions and bound version without grade controls", () => {
    const c = {
      taskRevision: 1,
      submission: { versionNumber: 2, revision: 0 },
      effectiveReview: null,
    } as ProgressReviewContext;
    const html = renderToStaticMarkup(
      <ProgressReviewForm context={c} busy={false} onSave={() => {}} />,
    );
    for (const s of [
      "PASS",
      "FAIL",
      "REVISION_REQUIRED",
      "Nhận xét",
      "lần nộp 2",
    ])
      expect(html).toContain(s);
    expect(html).not.toContain('name="score"');
    expect(progressDecisionLabel("FAIL")).toBe("Không đạt");
    expect(progressDecisionLabel("REVISION_REQUIRED")).toBe("Cần sửa");
  });
  it("shows superseded immutable review comments and amendment reason", () => {
    const r = {
      id: "r",
      decision: "FAIL",
      state: "SUPERSEDED",
      reviewerName: "GV An",
      recordedAt: "2026-10-23T01:00:00Z",
      comment: "Cần kiểm tra lại",
      amendmentReason: "Đối soát",
    } as ProgressReviewView;
    const html = renderToStaticMarkup(<ProgressReviewHistory reviews={[r]} />);
    expect(html).toContain("Không đạt");
    expect(html).toContain("Đã được sửa");
    expect(html).toContain("Cần kiểm tra lại");
    expect(html).toContain("Đối soát");
  });
  it("meeting form collects actual VN time/discussion/conclusion without inventing attendance", () => {
    const html = renderToStaticMarkup(
      <GuidanceMeetingForm planRevision={0} busy={false} onSave={() => {}} />,
    );
    expect(html).toContain("datetime-local");
    expect(html).toContain("Nội dung trao đổi");
    expect(html).toContain("Kết luận");
    expect(html).not.toContain("attendance");
  });
});
