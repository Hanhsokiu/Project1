import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup as render } from "react-dom/server";
import { FinalResultDetail, FinalResultRows, resultStates } from "./components";
import { syntheticFinalResult } from "./final-result.fixture";
const detail = (v = syntheticFinalResult(), pending = false) =>
  render(
    <FinalResultDetail
      value={v}
      pending={pending}
      preview={() => {}}
      command={() => {}}
    />,
  );
describe("UC24 SSR component projections; browser interactions not verified", () => {
  it("lists own scoped students with status and explicit missing count", () => {
    const s = render(
      <FinalResultRows items={[syntheticFinalResult()]} select={() => {}} />,
    );
    expect(s).toContain("TEST01");
    expect(s).toContain("4 / 5");
    expect(s).toContain("dự kiến");
  });
  it("empty state is explicit", () =>
    expect(render(<FinalResultRows items={[]} select={() => {}} />)).toContain(
      "Không có kết quả",
    ));
  it.each(Object.keys(resultStates) as (keyof typeof resultStates)[])(
    "renders %s without inferring another transition",
    (state) => {
      expect(detail({ ...syntheticFinalResult(), state })).toContain(
        resultStates[state],
      );
    },
  );
  it("separates three actions and preview; finalization remains disabled", () => {
    const s = detail();
    for (const label of [
      "Tính thử",
      "Hội đồng xác nhận",
      "Khoa chốt và khóa",
      "Công bố kết quả",
      "Chưa đủ xác nhận",
    ])
      expect(s).toContain(label);
    expect(s).toMatch(/disabled=""[^>]*>Khoa chốt/);
  });
  it("waiting publication and missing policy reasons are meaningful", () => {
    const v = syntheticFinalResult();
    v.blockers = ["UC24_POLICY_REQUIRED", "REVIEWER_GRADE_MISSING:l1"];
    v.actions.publish = ["PUBLICATION_WINDOW_CLOSED"];
    const s = detail(v);
    expect(s).toContain("Chưa có chính sách");
    expect(s).toContain("thiếu phiếu phản biện");
    expect(s).toContain("mốc công bố");
  });
  it("student projection contains no command controls or internal sources", () => {
    const v = syntheticFinalResult();
    v.visibility = "STUDENT";
    v.state = "PUBLISHED";
    v.sources = [];
    const s = detail(v);
    expect(s).toContain("8.4");
    expect(s).not.toContain("<button");
    expect(s).not.toContain("<textarea");
    expect(s).not.toContain("CHAIR");
  });
  it("stale result retains saved score with clear warning", () => {
    const v = syntheticFinalResult();
    v.state = "STALE";
    v.savedCalculation = v.calculation;
    v.calculation = null;
    v.blockers = ["RESULT_SOURCE_CHANGED"];
    const s = detail(v);
    expect(s).toContain("Kết quả đã lưu");
    expect(s).toContain("8.4");
    expect(s).toContain("Nguồn đã thay đổi");
  });
  it("pending prevents duplicate actions", () =>
    expect(detail(syntheticFinalResult(), true)).toMatch(
      /disabled=""[^>]*>Hội đồng xác nhận/,
    ));
});
