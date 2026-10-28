import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GuidanceTaskForm,
  TaskStatus,
  fromVietnamInput,
  toVietnamInput,
} from "./components";
import { GuidanceTaskProgressSchema } from "@doan/shared";
describe("Step 8A frontend contracts", () => {
  it("converts explicit Vietnam input to an instant independently of OS timezone", () => {
    expect(fromVietnamInput("2026-10-22T08:30")).toBe(
      "2026-10-22T08:30:00+07:00",
    );
    expect(toVietnamInput("2026-10-22T01:30:00Z")).toBe("2026-10-22T08:30");
    expect(fromVietnamInput("")).toBe("");
  });
  it("renders overdue as a separate badge, never as workflow completion", () => {
    const html = renderToStaticMarkup(
      <TaskStatus task={{ status: "IN_PROGRESS", isOverdue: true }} />,
    );
    expect(html).toContain("Đang thực hiện");
    expect(html).toContain("Quá hạn");
    expect(html).not.toContain("Đã hoàn thành");
  });
  it("new task form has required deliverable/date/period fields with no file or completion control", () => {
    const html = renderToStaticMarkup(
      <GuidanceTaskForm
        planRevision={2}
        periods={[]}
        busy={false}
        onSubmit={() => {}}
      />,
    );
    expect(html).toContain("Sản phẩm dự kiến");
    expect(html).toContain("Ngày bắt đầu");
    expect(html).toContain("Chọn mốc đã cấu hình");
    expect(html).not.toContain('type="file"');
  });
  it("progress DTO permits a note only and rejects status/score upload injection", () => {
    expect(
      GuidanceTaskProgressSchema.safeParse({
        expectedRevision: 0,
        note: "Đang nghiên cứu",
      }).success,
    ).toBe(true);
    expect(
      GuidanceTaskProgressSchema.safeParse({
        expectedRevision: 0,
        note: "Xong",
        status: "COMPLETED",
      }).success,
    ).toBe(false);
  });
});
