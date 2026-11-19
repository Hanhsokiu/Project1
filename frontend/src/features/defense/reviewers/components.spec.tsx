import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ReviewerEditor,
  ReviewerLoads,
  ReviewerPreview,
  ReviewerReasons,
  ReviewerRows,
} from "./components";
import { syntheticReviewer, syntheticWorkspace } from "./reviewer.fixture";
import type { ReviewerAllocation } from "@doan/shared";
const noop = () => {};
describe("UC20 components", () => {
  it("renders students, current committee/advisor and state", () => {
    const html = renderToStaticMarkup(
      <ReviewerRows
        items={[syntheticReviewer()]}
        selected={["s"]}
        pending={false}
        choose={noop}
        select={noop}
      />,
    );
    for (const t of ["SV01", "H1", "GVHD chính thức", "Dự thảo", "checked"])
      expect(html).toContain(t);
  });
  it("shows empty roster/list and whole-term workloads", () => {
    expect(
      renderToStaticMarkup(
        <ReviewerRows
          items={[]}
          selected={[]}
          pending={false}
          choose={noop}
          select={noop}
        />,
      ),
    ).toContain("Không có hồ sơ");
    const w = syntheticWorkspace();
    expect(renderToStaticMarkup(<ReviewerLoads workspace={w} />)).toContain(
      "Phản biện hợp lệ",
    );
    w.lecturers = [];
    expect(renderToStaticMarkup(<ReviewerLoads workspace={w} />)).toContain(
      "Không có giảng viên",
    );
  });
  it("renders candidate lecturer controls, count, reason and source conflicts", () => {
    const w = syntheticWorkspace(),
      html = renderToStaticMarkup(
        <ReviewerEditor
          workspace={w}
          student={w.students[0]}
          pending={false}
          save={noop}
          finalize={noop}
        />,
      );
    for (const t of [
      "Chọn GVPB",
      "1 người/đồ án",
      "Phản biện hợp lệ",
      "GVHD không được phản biện",
      "Lý do",
      "Lưu dự thảo",
      "Gỡ các GVPB",
    ])
      expect(html).toContain(t);
  });
  it("disables write/finalize with visible policy/scope blockers", () => {
    const w = syntheticWorkspace(),
      c = w.students[0];
    c.blockers.assign = ["UC20_NOT_ENABLED"];
    c.blockers.finalize = ["REVIEWER_COUNT_REQUIRED"];
    const html = renderToStaticMarkup(
      <ReviewerEditor
        workspace={w}
        student={c}
        pending={false}
        save={noop}
        finalize={noop}
      />,
    );
    expect(html).toContain("Nhóm chưa bật ghi UC20");
    expect(html).toContain("Chưa đủ số phản biện");
    expect(html).toContain("<fieldset disabled");
  });
  it("marks finalized and stale without making them editable, and displays safe history", () => {
    const w = syntheticWorkspace(),
      c = w.students[0];
    c.state = "STALE";
    c.blockers.assign = ["REVIEWER_FINALIZED_IMMUTABLE"];
    c.history = [
      {
        id: "h",
        actor: "faculty",
        at: "2026-11-07",
        action: "REVIEWERS_FINALIZED",
        reason: "Lý do công khai trong scope",
        revision: 2,
      },
    ];
    const html = renderToStaticMarkup(
      <ReviewerEditor
        workspace={w}
        student={c}
        pending={false}
        save={noop}
        finalize={noop}
      />,
    );
    expect(html).toContain("Nguồn đã thay đổi");
    expect(html).toContain("chưa có quy trình thay thế");
    expect(html).toContain("Lý do công khai trong scope");
  });
  it("disables controls while saving and lists unavailable reasons", () => {
    const w = syntheticWorkspace();
    w.students[0].candidates.forEach(
      (l) => (l.reasons = ["REVIEW_CAPACITY_EXCEEDED"]),
    );
    const html = renderToStaticMarkup(
      <ReviewerEditor
        workspace={w}
        student={w.students[0]}
        pending={true}
        save={noop}
        finalize={noop}
      />,
    );
    expect(html).toContain("<fieldset disabled");
    expect(html).toContain("Không có GVPB hợp lệ");
    expect(html).toContain("Vượt tải phản biện");
  });
  it.each(["UNSAT", "SEARCH_LIMIT", "BLOCKED", "FEASIBLE"] as const)(
    "previews %s and requires explicit apply reason",
    (status) => {
      const p: ReviewerAllocation = {
        status,
        rosterHash: "f".repeat(64),
        placements: [],
        reasons: ["Giải thích"],
        exploredNodes: 0,
        loads: [],
      };
      const html = renderToStaticMarkup(
        <ReviewerPreview
          proposal={p}
          pending={false}
          blocked={false}
          apply={noop}
        />,
      );
      expect(html).toContain("Giải thích");
      expect(html).toContain("áp dụng riêng");
      expect(html).toContain("disabled");
    },
  );
  it("translates history/qualification/overlap/policy reasons", () => {
    const html = renderToStaticMarkup(
      <ReviewerReasons
        values={[
          "ADVISOR_HISTORY_UNVERIFIED",
          "COMMITTEE_MEMBERSHIP_PENDING_APPROVAL",
          "REVIEWER_AREA_MATCH_REQUIRED",
          "UC20_POLICY_REQUIRED",
        ]}
      />,
    );
    for (const t of [
      "Lịch sử hướng dẫn",
      "kiêm nhiệm",
      "chuyên môn",
      "chính sách phản biện",
    ])
      expect(html).toContain(t);
  });
});
