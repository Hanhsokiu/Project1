import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ScheduleDetail,
  ScheduleEditor,
  ScheduleProposalPreview,
  ScheduleReasons,
  ScheduleRows,
  ScheduleSlots,
  vietnamTime,
} from "./components";
import {
  syntheticSchedule,
  syntheticSlot,
  syntheticWorkspace,
} from "./schedule.fixture";
import type { ScheduleProposal } from "@doan/shared";
const noop = () => {};
const render = (child: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  client.clear();
  return html;
};
describe("UC21 schedule components", () => {
  it("shows names in supplied server order and Vietnam local time", () => {
    const slots = [
      {
        ...syntheticSlot(),
        termStudentId: "a",
        studentName: "Lê Thị An",
        order: 1,
      },
      {
        ...syntheticSlot(),
        termStudentId: "b",
        studentName: "Nguyễn Văn Bình",
        order: 2,
      },
    ];
    const html = render(<ScheduleSlots slots={slots} />);
    expect(html.indexOf("Lê Thị An")).toBeLessThan(
      html.indexOf("Nguyễn Văn Bình"),
    );
    expect(html).toContain("08:00");
    expect(vietnamTime(slots[0].endAt)).toBe("08:30");
  });
  it("renders date/period/room/status and empty schedules", () => {
    const html = render(
      <ScheduleRows items={[syntheticSchedule()]} select={noop} />,
    );
    for (const t of [
      "2030-11-07",
      "Sáng",
      "Phòng bảo vệ A",
      "Lịch dự thảo",
      "Chưa công bố",
    ])
      expect(html).toContain(t);
    expect(render(<ScheduleRows items={[]} select={noop} />)).toContain(
      "Không có lịch",
    );
  });
  it("renders source committee, approved room/day/period and time preview controls", () => {
    const html = render(
      <ScheduleEditor
        workspace={syntheticWorkspace()}
        pending={false}
        save={noop}
      />,
    );
    for (const t of [
      "Hội đồng đã chốt",
      "Phòng bảo vệ",
      "Ngày bảo vệ",
      "Buổi",
      "Nguyễn Văn An",
      "Tên → Họ đệm",
      "Xem trước giờ",
      "Lưu lịch dự thảo",
    ])
      expect(html).toContain(t);
  });
  it("does not invent times or offer manual reorder if policy missing or forbids it", () => {
    const w = syntheticWorkspace();
    w.policy = null;
    w.sources = [];
    w.rooms = [];
    w.blockers = ["UC21_POLICY_REQUIRED"];
    const html = render(
      <ScheduleEditor workspace={w} pending={false} save={noop} />,
    );
    expect(html).toContain("Chưa có chính sách lịch");
    expect(html).not.toContain('value="08:00"');
    expect(html).not.toContain("Ngoại lệ điều chỉnh");
  });
  it("shows approved manual-order exception controls and pending disables editing", () => {
    const w = syntheticWorkspace();
    w.policy!.manualOrderAllowed = true;
    const html = render(
      <ScheduleEditor
        workspace={w}
        current={w.schedules[0]}
        pending={true}
        save={noop}
      />,
    );
    expect(html).toContain("Ngoại lệ điều chỉnh");
    expect(html).toContain("<fieldset disabled");
  });
  it("shows conflicts and disabled reasons for room/member/eligibility/UC20 blockers", () => {
    const html = render(
      <ScheduleReasons
        values={[
          "ROOM_CONFLICT",
          "LECTURER_CONFLICT",
          "SCHEDULE_SOURCE_CHANGED",
          "UC20_CURRENT_REVIEWERS_REQUIRED:student",
        ]}
      />,
    );
    for (const t of [
      "Trùng phòng",
      "Trùng lịch thành viên",
      "Nguồn UC18/UC19/UC20",
      "phân công UC20",
    ])
      expect(html).toContain(t);
  });
  it("separates finalize/publication and displays actor/revision/history", () => {
    const w = syntheticWorkspace(),
      c = w.schedules[0];
    c.history = [
      {
        id: "event",
        actor: "faculty",
        at: "2026-11-07",
        action: "SCHEDULE_SAVED",
        reason: "Điều chỉnh phòng",
        revision: 1,
      },
    ];
    const html = render(
      <ScheduleDetail
        workspace={w}
        schedule={c}
        pending={false}
        transition={noop}
      />,
    );
    for (const t of [
      "Chốt lịch",
      "Công bố lịch",
      "Hủy lịch dự thảo",
      "Phiên bản 1",
      "Điều chỉnh phòng",
      "faculty",
    ])
      expect(html).toContain(t);
  });
  it("personal projection has no write/publication/history controls", () => {
    const w = syntheticWorkspace();
    w.mode = "PERSONAL";
    const html = render(
      <ScheduleDetail
        workspace={w}
        schedule={w.schedules[0]}
        pending={false}
        transition={noop}
      />,
    );
    expect(html).toContain("Nguyễn Văn An");
    expect(html).not.toContain("Lý do chốt");
    expect(html).not.toContain("Hủy lịch dự thảo");
  });
  it.each(["FEASIBLE", "UNSAT", "SEARCH_LIMIT", "BLOCKED"] as const)(
    "renders %s proposal with no automatic apply or fake success",
    (status) => {
      const p: ScheduleProposal = {
        status,
        rosterHash: "f".repeat(64),
        sessions: [],
        previews: [],
        reasons: ["Giải thích phương án"],
        exploredNodes: 0,
      };
      const html = render(
        <ScheduleProposalPreview
          workspace={syntheticWorkspace()}
          proposal={p}
          pending={false}
          apply={noop}
        />,
      );
      expect(html).toContain("Chưa lưu");
      expect(html).toContain("Giải thích phương án");
      expect(html).toContain("disabled");
      expect(html).not.toContain("Đã lưu thao tác");
    },
  );
});
