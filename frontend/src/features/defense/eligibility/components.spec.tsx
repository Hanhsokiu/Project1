import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EligibilityView } from "@doan/shared";
import {
  EligibilityCommandForm,
  EligibilityEvidence,
  EligibilityRows,
  eligibilityError,
} from "./components";

export const syntheticView = {
  termId: "synthetic-term",
  termStudentId: "synthetic-member",
  proposalId: "synthetic-proposal",
  studentCode: "SYNTHETIC01",
  studentName: "Sinh viên tổng hợp",
  title: "Đề tài tổng hợp",
  advisor: "GVHD tổng hợp",
  revision: 1,
  evidenceHash: "f".repeat(64),
  preview: "QUALIFIED",
  uc17: "CONFIRMED",
  pdf: "VERIFIED",
  checks: [{ key: "pdf", state: "QUALIFIED", message: "PDF đã xác minh" }],
  policy: null,
  official: { state: "NONE", status: "PENDING" },
  academic: null,
  advisorSummary: null,
  history: [],
  actionBlockers: { review: [], decide: [], finalize: [] },
  downstream: null,
} satisfies EligibilityView;
describe("UC18 evidence and faculty command components", () => {
  it("shows preview and faculty decision separately for both list and detail", () => {
    const row = renderToStaticMarkup(
      <EligibilityRows
        items={[syntheticView]}
        chosen={[]}
        select={() => {}}
        toggle={() => {}}
      />,
    );
    expect(row).toContain("Chứng cứ đầy đủ");
    expect(row).toContain("Khoa chưa xét");
    expect(row).not.toContain("Khoa đã chốt");
    const html = renderToStaticMarkup(
      <EligibilityEvidence view={syntheticView} />,
    );
    expect(html).toContain("GVHD tổng hợp");
    expect(html).toContain("PDF đã xác minh");
    expect(html).not.toContain("Hồ sơ đã chốt");
  });
  it("renders an explicit empty state rather than showing demo records", () => {
    expect(
      renderToStaticMarkup(
        <EligibilityRows
          items={[]}
          chosen={[]}
          select={() => {}}
          toggle={() => {}}
        />,
      ),
    ).toContain("Không có hồ sơ trong phạm vi/bộ lọc");
  });
  it("explains blocked policy and prevents review/finalization controls", () => {
    const blocked: EligibilityView = {
      ...syntheticView,
      preview: "UNVERIFIED",
      actionBlockers: {
        review: ["UC18_POLICY_REQUIRED", "UC18_NOT_ENABLED"],
        decide: ["CURRENT_REVIEW_REQUIRED"],
        finalize: ["VERIFIED_QUALIFIED_EVIDENCE_REQUIRED"],
      },
    };
    const html = renderToStaticMarkup(
      <EligibilityCommandForm
        view={blocked}
        pending={false}
        submit={() => {}}
      />,
    );
    expect(html).toContain("Chưa có policy UC18 được duyệt");
    expect(html).toContain("Nhóm chưa bật ghi UC18");
    expect(html).toContain("<fieldset disabled");
    expect(
      renderToStaticMarkup(
        <EligibilityRows
          items={[blocked]}
          chosen={[]}
          select={() => {}}
          toggle={() => {}}
        />,
      ),
    ).toContain('disabled=""');
  });
  it("disables the form while saving and requires an auditable reason", () => {
    const html = renderToStaticMarkup(
      <EligibilityCommandForm view={syntheticView} pending submit={() => {}} />,
    );
    expect(html).toContain("<fieldset disabled");
    expect(html).toContain("Đang lưu");
    expect(html).toContain('name="reason" required');
  });
  it("offers only approved academic source options supplied by the server", () => {
    const policy = {
      academicSources: [{ key: "source-one", label: "Nguồn được duyệt" }],
    } as NonNullable<EligibilityView["policy"]>;
    const html = renderToStaticMarkup(
      <EligibilityCommandForm
        view={{ ...syntheticView, policy }}
        pending={false}
        submit={() => {}}
      />,
    );
    expect(html).toContain('value="source-one"');
    expect(html).toContain("Nguồn được duyệt");
    expect(html).not.toContain("GPA");
  });
  it("renders sensitive fields only when present in the authorized projection", () => {
    const privateView = {
      ...syntheticView,
      advisorSummary: { score: 8, comment: "Nhận xét riêng" },
      official: { ...syntheticView.official, reason: "Lý do nội bộ" },
    };
    const visible = renderToStaticMarkup(
      <EligibilityEvidence view={privateView} />,
    );
    expect(visible).toContain("Điểm GVHD: 8");
    expect(visible).toContain("Nhận xét riêng");
    expect(visible).toContain("Lý do nội bộ");
    const hidden = renderToStaticMarkup(
      <EligibilityEvidence view={syntheticView} />,
    );
    expect(hidden).not.toContain("Điểm GVHD");
    expect(hidden).not.toContain("Nhận xét riêng");
    expect(hidden).not.toContain("Lý do nội bộ");
  });
  it.each([401, 403, 404, 409])(
    "explains HTTP %i without turning it into a success message",
    (status) => {
      expect(
        eligibilityError({ status, message: "Synthetic API error" }),
      ).toContain("Synthetic API error");
      expect(eligibilityError({ status })).not.toContain("Đã lưu");
    },
  );
});
