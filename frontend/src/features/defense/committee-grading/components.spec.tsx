import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup as render } from "react-dom/server";
import {
  CommitteeGradeEditor,
  CommitteeGradeRows,
  CommitteeProgressRows,
} from "./components";
import { syntheticCommitteeGrade } from "./committee-grade.fixture";
const noop = () => {};
describe("UC23 own rubric/progress/privacy (SSR component tests)", () => {
  it("a stale/finalized sheet shows its saved score and rubric snapshot, never a recalculation with the new rubric", () => {
    const v = syntheticCommitteeGrade();
    v.state = "STALE";
    v.gradedRubric = structuredClone(v.policy!.rubric);
    v.gradedPolicyVersion = v.policy!.version;
    v.policy!.rubric.version = "changed";
    v.policy!.rubric.criteria.forEach((c) => {
      c.weight = "0.5";
      c.name = "New criterion";
    });
    v.blockers = ["GRADE_SOURCE_CHANGED"];
    const html = render(
      <CommitteeGradeEditor
        view={v}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    expect(html).toContain("Điểm phiếu: 8.4");
    expect(html).toContain("Tiêu chí hội đồng A");
    expect(html).not.toContain("New criterion");
    expect(html).not.toContain("8.5");
    expect(html).not.toContain("Lưu nháp của tôi");
  });
  it.each([
    ["CHAIR", "Chủ tịch"],
    ["SECRETARY", "Thư ký"],
    ["MEMBER", "Ủy viên"],
  ] as const)("shows official %s role and assigned student", (role, label) => {
    const v = syntheticCommitteeGrade();
    v.memberRole = role;
    const html = render(<CommitteeGradeRows items={[v]} select={noop} />);
    expect(html).toContain(label);
    expect(html).toContain("Sinh viên thuộc hội đồng");
    expect(html).toContain("H1");
    expect(html).not.toContain("8.4");
    expect(html).not.toContain("TEST_ONLY nhận xét riêng");
  });
  it("renders independent criteria/description and exact computed total, never a user supplied total field", () => {
    const html = render(
      <CommitteeGradeEditor
        view={syntheticCommitteeGrade()}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    for (const t of [
      "Tiêu chí hội đồng A",
      "Mô tả tiêu chí A",
      "8.4",
      "PDF phiên bản 2",
      "Lưu nháp của tôi",
      "Chốt phiếu của tôi",
      "TEST_ONLY_RUBRIC_UC23",
    ])
      expect(html).toContain(t);
    expect(html).not.toContain('name="totalScore"');
    expect(html).not.toContain("Đã lưu phiếu hội đồng trên hệ thống");
  });
  it.each([
    "COMMITTEE_NOT_CURRENT",
    "UC23_POLICY_REQUIRED",
    "RUBRIC_SOURCE_MISMATCH",
    "GRADE_SOURCE_CHANGED",
    "UC21_CURRENT_SCHEDULE_REQUIRED",
    "UC23_NOT_ENABLED",
  ])("explains disabled %s", (code) => {
    const v = syntheticCommitteeGrade();
    v.blockers = [code];
    const html = render(
      <CommitteeGradeEditor
        view={v}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    expect(html).toMatch(/disabled=""[^>]*>Chốt phiếu của tôi/);
  });
  it("missing official performance producer blocks finalize, without inventing attendance", () => {
    const v = syntheticCommitteeGrade();
    v.finalizeBlockers = ["DEFENSE_PERFORMANCE_PRODUCER_REQUIRED"];
    const html = render(
      <CommitteeGradeEditor
        view={v}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    expect(html).toContain("Chưa có nguồn chính thức xác nhận đã bảo vệ");
    expect(html).toMatch(/disabled=""[^>]*>Chốt phiếu của tôi/);
  });
  it("faculty progress and redacted detail show no hidden grade/comment", () => {
    const v = syntheticCommitteeGrade();
    v.permissions = { save: false, finalize: false, download: false };
    v.score = null;
    v.comment = null;
    v.history = [];
    const html = render(
      <CommitteeGradeEditor
        view={v}
        pending={false}
        download={async () => {}}
        submit={noop}
      />,
    );
    expect(html).not.toContain("8.4");
    expect(html).not.toContain("TEST_ONLY nhận xét riêng");
    expect(html).not.toContain("textarea");
    const progress = render(
      <CommitteeProgressRows
        items={[
          {
            termId: "T",
            committeeId: "C",
            committeeCode: "H1",
            termStudentId: "S",
            studentCode: "SV01",
            studentName: "Sinh viên",
            requiredCount: 3,
            none: 1,
            draft: 1,
            finalized: 1,
            stale: 0,
            blocked: 0,
            missingRequired: 2,
            blockers: [],
          },
        ]}
      />,
    );
    expect(progress).toContain("Phiếu bắt buộc");
    expect(progress).toContain("chưa phải điểm tổng hợp");
  });
  it("empty state and saving do not fabricate official grades", () => {
    expect(render(<CommitteeGradeRows items={[]} select={noop} />)).toContain(
      "Không có hồ sơ hội đồng",
    );
    const v = syntheticCommitteeGrade();
    v.policy = null;
    v.score = null;
    v.comment = null;
    v.blockers = ["UC23_POLICY_REQUIRED"];
    const html = render(
      <CommitteeGradeEditor
        view={v}
        pending={true}
        download={async () => {}}
        submit={noop}
      />,
    );
    expect(html).toContain("Đang lưu phiếu");
    expect(html).toContain("Chưa có tổng hợp lệ");
    expect(html).not.toContain("Đã lưu phiếu");
  });
});
