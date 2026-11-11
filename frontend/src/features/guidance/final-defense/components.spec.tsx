import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FinalDefenseView } from "@doan/shared";
import {
  AdvisorDecisionForm,
  AdvisorSummaryForm,
  finalStatusLabel,
  ActionBlockedNotice,
} from "./components";

const view = {
  proposalId: "synthetic",
  revision: 2,
  versions: [{ id: "synthetic-version" }],
  summary: null,
  policy: { scoreStep: 0.5, rubric: null },
  permissions: { review: true, decide: true },
} as unknown as FinalDefenseView;
describe("UC17 advisor forms", () => {
  it("explains a disabled action with its actual blocker instead of a missing-summary guess", () => {
    const blocked = {
      ...view,
      blockers: ["UC17_NOT_ENABLED"],
      permissions: { ...view.permissions, decide: false },
      actionBlockers: { decide: ["UC17_NOT_ENABLED"] },
    } as FinalDefenseView;
    const html = renderToStaticMarkup(
      <ActionBlockedNotice view={blocked} action="decide" />,
    );
    expect(html).toContain("Nhóm chưa bật thao tác ghi UC17");
    expect(html).not.toContain("Cần lưu nhận xét");
  });
  it("reloads saved rubric values, rejection selection and reason", () => {
    const saved = {
      ...view,
      policy: {
        ...view.policy!,
        rubric: [{ key: "work", label: "Work", maxScore: 10, weight: 1 }],
      },
      summary: { current: true, criterionScores: { work: 8 } },
      decision: { current: true, status: "REJECTED", reason: "Lý do đã lưu" },
    };
    expect(
      renderToStaticMarkup(
        <AdvisorSummaryForm view={saved} pending={false} submit={() => {}} />,
      ),
    ).toContain('value="8"');
    const html = renderToStaticMarkup(
      <AdvisorDecisionForm view={saved} pending={false} submit={() => {}} />,
    );
    expect(html).toContain("Lý do đã lưu");
    expect(html).toMatch(/value="REJECTED" selected/);
  });
  it("collects a scale-10 score using the configured step and a separate decision", () => {
    const html = renderToStaticMarkup(
      <AdvisorSummaryForm view={view} pending={false} submit={() => {}} />,
    );
    expect(html).toContain('max="10"');
    expect(html).toContain('step="0.5"');
    expect(html).toContain("Nhận xét tổng kết");
    expect(html).not.toContain('value="CONFIRMED"');
    const decision = renderToStaticMarkup(
      <AdvisorDecisionForm view={view} pending={false} submit={() => {}} />,
    );
    expect(decision).toContain('value="CONFIRMED"');
    expect(decision).toContain('value="REJECTED"');
    expect(decision).toContain("Lý do quyết định");
  });
  it("blocks controls while a write is pending or backend permissions deny the action", () => {
    expect(
      renderToStaticMarkup(
        <AdvisorSummaryForm view={view} pending submit={() => {}} />,
      ),
    ).toContain("<fieldset disabled");
    const disabled = {
      ...view,
      permissions: { ...view.permissions, decide: false },
    };
    expect(
      renderToStaticMarkup(
        <AdvisorDecisionForm
          view={disabled}
          pending={false}
          submit={() => {}}
        />,
      ),
    ).toContain("<fieldset disabled");
  });
  it("renders configured rubric criteria instead of inserting a fixed rubric", () => {
    const configured = {
      ...view,
      policy: {
        ...view.policy!,
        rubric: [
          { key: "test", label: "Tiêu chí được duyệt", maxScore: 5, weight: 1 },
        ],
      },
    };
    const html = renderToStaticMarkup(
      <AdvisorSummaryForm
        view={configured}
        pending={false}
        submit={() => {}}
      />,
    );
    expect(html).toContain("Tiêu chí được duyệt");
    expect(html).toContain('max="5"');
  });
  it("distinguishes stale/legacy decisions from an effective confirmation", () => {
    expect(finalStatusLabel("STALE")).toBe("Cần GVHD xem xét lại");
    expect(finalStatusLabel("LEGACY_UNVERIFIED")).toContain("đối soát");
    expect(finalStatusLabel("CONFIRMED")).toBe("GVHD đồng ý");
  });
});
