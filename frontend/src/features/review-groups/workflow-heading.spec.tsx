import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkflowHeading } from "./workflow-heading";
import type { Role } from "../../shared/data/types";

const state = vi.hoisted(() => ({ role: "STUDENT" as string }));
vi.mock("../../shared/hooks/use-workspace", () => ({
  useWorkspace: () => ({ user: { roles: [state.role as Role] } }),
}));

describe("workflow headings by audience", () => {
  it("shows student actions without instructions to assign or finalize", () => {
    state.role = "STUDENT";
    const dossier = renderToStaticMarkup(
      <WorkflowHeading path="/topic/dossier" />,
    );
    expect(dossier).toContain("Hồ sơ &amp; bản in");
    expect(dossier).toContain("in, ký, nộp");
    expect(dossier).not.toContain("xác nhận tiếp nhận");
    const tasks = renderToStaticMarkup(
      <WorkflowHeading path="/guidance/tasks" />,
    );
    expect(tasks).toContain("nộp báo cáo");
    expect(tasks).not.toContain("giao nhiệm vụ");
  });
  it("shows faculty finalization responsibilities", () => {
    state.role = "FACULTY";
    const html = renderToStaticMarkup(
      <WorkflowHeading path="/topic/dossier" />,
    );
    expect(html).toContain("chốt hồ sơ chính thức");
    expect(html).toContain("xác nhận tiếp nhận bản giấy");
  });
  it("shows lecturer guidance and assigned review responsibilities", () => {
    state.role = "LECTURER";
    const plan = renderToStaticMarkup(
      <WorkflowHeading path="/guidance/plan" />,
    );
    expect(plan).toContain("giao nhiệm vụ");
    const groups = renderToStaticMarkup(
      <WorkflowHeading path="/topic/review-groups" />,
    );
    expect(groups).toContain("Nhóm duyệt của tôi");
    expect(groups).not.toContain("Tổ chức nhóm duyệt");
  });
});
