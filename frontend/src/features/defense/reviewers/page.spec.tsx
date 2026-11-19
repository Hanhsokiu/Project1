import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ReviewerPage } from "./page";
import { syntheticWorkspace } from "./reviewer.fixture";
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));
const auth = vi.hoisted(() => ({ id: "faculty" }));
vi.mock("../../../shared/hooks/use-api-session", () => ({
  useApiSession: () => ({
    id: auth.id,
    roles: ["FACULTY"],
    permissions: ["defense-reviewer:read"],
  }),
}));
function render(path: string, error = 0, loading = false, empty = false) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        staleTime: Infinity,
      },
    },
  });
  client.setQueryData(
    ["reviewer-terms", "faculty"],
    [{ id: "term", code: "T", name: "Đợt bảo vệ", status: "IN_PROGRESS" }],
  );
  const w = syntheticWorkspace();
  if (empty) w.students = [];
  if (!loading)
    client.setQueryData(["reviewer-workspace", "faculty", "term"], w);
  if (error)
    client
      .getQueryCache()
      .build(client, { queryKey: ["reviewer-workspace", auth.id, "term"] })
      .setState({
        status: "error",
        error: Object.assign(new Error("Synthetic HTTP"), { status: error }),
        fetchStatus: "idle",
        data: undefined,
      });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ReviewerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("UC20 routed page and actor/term query isolation", () => {
  it("renders term/list/detail/loads/manual actions and policy", () => {
    auth.id = "faculty";
    const html = render("/defense/reviewers?termId=term&termStudentId=s");
    for (const t of [
      "Đợt bảo vệ",
      "Sinh viên riêng kỳ",
      "GVHD chính thức",
      "H1",
      "Phản biện hợp lệ",
      "Lưu dự thảo",
      "Chốt phân công",
      "synthetic-only",
    ])
      expect(html).toContain(t);
    expect(html).not.toContain("Đã lưu phân công phản biện trên hệ thống.");
  });
  it("supports search/state filters and empty results", () => {
    expect(render("/defense/reviewers?termId=term&search=missing")).toContain(
      "Không có hồ sơ",
    );
    expect(render("/defense/reviewers?termId=term&state=FINALIZED")).toContain(
      "Không có hồ sơ",
    );
    expect(render("/defense/reviewers?termId=term", 0, false, true)).toContain(
      "Không có hồ sơ",
    );
  });
  it("does not reuse previous term or actor data and shows loading/reload controls", () => {
    auth.id = "faculty";
    const other = render("/defense/reviewers?termId=other");
    expect(other).not.toContain("Sinh viên riêng kỳ");
    expect(other).toContain("Đang tải hồ sơ");
    auth.id = "other-actor";
    expect(render("/defense/reviewers?termId=term")).not.toContain(
      "Sinh viên riêng kỳ",
    );
    auth.id = "faculty";
    expect(render("/defense/reviewers?termId=term", 0, true)).toContain(
      "Tải lại dữ liệu",
    );
  });
  it.each([401, 403, 404, 409])(
    "renders HTTP %i error with no false success",
    (status) => {
      auth.id = "faculty";
      const html = render("/defense/reviewers?termId=term", status);
      expect(html).not.toContain("Sinh viên riêng kỳ");
      expect(html).not.toContain("Đã lưu phân công phản biện trên hệ thống.");
      expect(html).toContain("Tải lại dữ liệu");
    },
  );
  it("does not show reviewer grades/comments or UC22 controls", () => {
    const html = render("/defense/reviewers?termId=term&termStudentId=s");
    expect(html).not.toContain("Nhập điểm");
    expect(html).not.toContain("Nhận xét phản biện");
  });
});
