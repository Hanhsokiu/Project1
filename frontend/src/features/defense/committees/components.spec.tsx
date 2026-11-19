import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CommitteeView, CommitteeWorkspace } from "@doan/shared";
import {
  AllocationPreview,
  CommitteeDetail,
  CommitteeEditor,
  CommitteeReasons,
  CommitteeRows,
} from "./components";
export const syntheticCommittee: CommitteeView = {
  id: "c",
  termId: "term",
  code: "H1",
  name: "Hội đồng tổng hợp",
  departmentId: "dept",
  revision: 2,
  state: "DRAFT",
  members: [
    {
      lecturerId: "l1",
      name: "Giảng viên tổng hợp",
      role: "CHAIR",
      valid: true,
    },
    {
      lecturerId: "l2",
      name: "Thư ký tổng hợp",
      role: "SECRETARY",
      valid: true,
    },
    { lecturerId: "l3", name: "Ủy viên tổng hợp", role: "MEMBER", valid: true },
  ],
  students: [],
  issues: [],
  blockers: { update: [], assign: [], finalize: [] },
  history: [],
  downstream: null,
};
export const syntheticWorkspace: CommitteeWorkspace = {
  termId: "term",
  rosterHash: "f".repeat(64),
  policy: null,
  schemaReady: true,
  blockers: [],
  departments: [{ id: "dept", name: "Bộ môn tổng hợp" }],
  lecturers: [],
  committees: [syntheticCommittee],
  candidates: [],
  permissions: { create: true, update: true, assign: true, finalize: true },
};
describe("UC19 committee/member/allocation components", () => {
  it("renders draft counts without implying official finalization", () => {
    const html = renderToStaticMarkup(
      <CommitteeRows items={[syntheticCommittee]} select={() => {}} />,
    );
    expect(html).toContain("Hội đồng tổng hợp");
    expect(html).toContain("Bản dự thảo");
    expect(html).not.toContain("Đã chốt, còn hiệu lực");
  });
  it("handles an empty scoped list", () => {
    expect(
      renderToStaticMarkup(<CommitteeRows items={[]} select={() => {}} />),
    ).toContain("Không có hội đồng trong phạm vi/bộ lọc");
  });
  it("renders every member role and blocked advisor conflicts", () => {
    const c = {
      ...syntheticCommittee,
      issues: ["ADVISOR_CONFLICT:student"],
      blockers: {
        ...syntheticCommittee.blockers,
        finalize: ["ADVISOR_CONFLICT:student"],
      },
    };
    const html = renderToStaticMarkup(
      <CommitteeDetail
        committee={c}
        pending={false}
        finalize={() => {}}
        unassign={() => {}}
      />,
    );
    for (const label of [
      "Chủ tịch",
      "Thư ký",
      "Ủy viên",
      "GVHD trùng một trong tất cả thành viên",
    ])
      expect(html).toContain(label);
    expect(html).toMatch(/disabled=""[^>]*>Chốt hội đồng/);
    expect(html).not.toContain("Hội đồng đã chốt, nguồn còn hiệu lực");
  });
  it("explains policy/schema/permission blockers and disables saving", () => {
    const w = {
      ...syntheticWorkspace,
      blockers: [
        "UC19_SCHEMA_REQUIRED",
        "UC19_POLICY_REQUIRED",
        "UC19_NOT_ENABLED",
      ],
      permissions: { ...syntheticWorkspace.permissions, create: false },
    };
    const html = renderToStaticMarkup(
      <CommitteeEditor workspace={w} pending={false} submit={() => {}} />,
    );
    expect(html).toContain("Cần migration UC19");
    expect(html).toContain("Chưa có chính sách hội đồng được duyệt");
    expect(html).toContain("<fieldset disabled");
    expect(html).toContain("Cần quyền tương ứng của Khoa");
  });
  it("disables member changes while saving and shows configured roles without reviewer assignment", () => {
    const html = renderToStaticMarkup(
      <CommitteeEditor
        workspace={syntheticWorkspace}
        committee={syntheticCommittee}
        pending
        submit={() => {}}
      />,
    );
    expect(html).toContain("<fieldset disabled");
    expect(html).toContain("Đang lưu");
    expect(html).toContain('value="SECRETARY"');
    expect(html).not.toContain('value="REVIEWER"');
  });
  it.each(["UNSAT", "SEARCH_LIMIT", "BLOCKED"] as const)(
    "renders %s with no enabled apply action",
    (status) => {
      const html = renderToStaticMarkup(
        <AllocationPreview
          proposal={{
            status,
            rosterHash: syntheticWorkspace.rosterHash,
            committees: [],
            placements: [],
            reasons: ["Synthetic constraint reason"],
            exploredNodes: 1,
            loads: [],
          }}
          w={syntheticWorkspace}
          pending={false}
          apply={() => {}}
        />,
      );
      expect(html).toContain("Synthetic constraint reason");
      expect(html).toMatch(/disabled=""[^>]*>Áp dụng/);
      expect(html).toContain("Đề xuất chưa được lưu");
    },
  );
  it("shows proposed workload and keeps stale previews disabled", () => {
    const html = renderToStaticMarkup(
      <AllocationPreview
        proposal={{
          status: "FEASIBLE",
          rosterHash: "0".repeat(64),
          committees: [],
          placements: [],
          reasons: [],
          exploredNodes: 1,
          loads: [{ committeeId: "c", students: 3 }],
        }}
        w={syntheticWorkspace}
        pending={false}
        apply={() => {}}
      />,
    );
    expect(html).toContain("3 sinh viên");
    expect(html).toMatch(/disabled=""[^>]*>Áp dụng/);
  });
  it("renders source-staleness reasons rather than claiming reassignment or approval", () => {
    expect(
      renderToStaticMarkup(
        <CommitteeReasons
          values={["SOURCE_CHANGED:student", "COMMITTEE_FINALIZED"]}
        />,
      ),
    ).toContain("Chứng cứ UC18/GVHD đã thay đổi");
  });
});
