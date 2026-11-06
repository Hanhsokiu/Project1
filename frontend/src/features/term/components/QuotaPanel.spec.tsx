import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialQuotaPolicy } from "@doan/shared";
import type { Term } from "../../../shared/data/types";
vi.mock("../../../shared/hooks/use-workspace", () => ({
  useWorkspace: () => ({
    db: {
      lecturers: [
        {
          id: "l1",
          code: "GV1",
          name: "Giảng viên mẫu",
          academicDegree: "MASTER",
          academicRank: "NONE",
        },
      ],
    },
  }),
}));
vi.mock("../../../shared/hooks/use-demo", () => ({
  useAction: () => ({ pending: false, error: null, run: vi.fn() }),
}));
vi.mock("../../../shared/data/snapshot-api", () => ({
  step1Api: { term: true },
}));
import { QuotaPanel } from "./QuotaPanel";
const base = {
  id: "t1",
  code: "DOT1",
  locked: false,
  status: "DRAFT",
  lecturers: [{ lecturerId: "l1", quota: 6 }],
  studentIds: ["s1"],
  phases: [],
} as unknown as Term;
const render = (term = base, dirty = false) =>
  renderToStaticMarkup(
    <StaticRouter location="/">
      <QuotaPanel term={term} rosterDirty={dirty} />
    </StaticRouter>,
  );
describe("quota planning workspace", () => {
  it("shows four configurable coefficient groups and preserves the legacy manual state", () => {
    const html = render();
    expect(html).toContain("Chỉ tiêu thủ công hiện có");
    expect(html).toContain("Hệ số Thạc sĩ");
    expect(html).toContain('value="0.75"');
    expect(html).toContain("Giới hạn tối đa chung");
    expect(html).toContain("Thạc sĩ");
  });
  it("requires saved roster and disables mutation controls for locked terms", () => {
    expect(render(base, true)).toContain("Lưu danh sách tham gia");
    const html = render({ ...base, locked: true });
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>[\s\S]*?Tính chỉ tiêu đề xuất/,
    );
  });
  it("distinguishes a stale approval and shows the recommendation, cap and final quota separately", () => {
    const policy = initialQuotaPolicy();
    policy.status = "APPROVED";
    policy.revision = 2;
    policy.demandCount = 6;
    policy.members = [
      {
        lecturerId: "l1",
        code: "GV1",
        name: "Giảng viên mẫu",
        academicDegree: "MASTER",
        academicRank: "NONE",
        coefficient: 0.75,
        maxQuota: 10,
        currentCount: 0,
        idealQuota: 6,
        suggestedQuota: 6,
        quota: 6,
        reason: "",
      },
    ];
    const html = render({ ...base, quotaPolicy: policy, quotaReady: false });
    expect(html).toContain("Danh sách hoặc chỉ tiêu đã thay đổi");
    expect(html).toContain("Hệ số trung bình");
    expect(html).toContain("Quota chốt");
    expect(html).not.toContain("Chốt chỉ tiêu hướng dẫn</button>");
  });
});
