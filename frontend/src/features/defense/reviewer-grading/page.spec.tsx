import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ReviewerGradePage } from "./page";
import { syntheticGradeView } from "./reviewer-grade.fixture";
import { reviewerGradeKeys as keys } from "./api";
import { ReviewerGradeQuerySchema } from "@doan/shared";
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));
const auth = vi.hoisted(() => ({
  id: "reviewer",
  roles: ["LECTURER"],
  permissions: ["defense-reviewer-grade:read"],
}));
vi.mock("../../../shared/hooks/use-api-session", () => ({
  useApiSession: () => auth,
}));
function render(
  path = "/defense/reviewer-grading?termId=term&termStudentId=student&reviewerId=reviewer",
  status = 0,
  blockers: string[] = [],
) {
  const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          retryOnMount: false,
          refetchOnMount: false,
          staleTime: Infinity,
        },
      },
    }),
    v = syntheticGradeView(),
    q = ReviewerGradeQuerySchema.parse({ termId: "term" });
  client.setQueryData(keys.terms("reviewer"), [
    { id: "term", code: "T", name: "Đợt phản biện", status: "IN_PROGRESS" },
  ]);
  client.setQueryData(keys.list("reviewer", q), {
    items: [v],
    total: 1,
    page: 1,
    limit: 20,
    blockers,
  });
  client.setQueryData(
    keys.detail("reviewer", "term", "student", "reviewer"),
    v,
  );
  if (status)
    client
      .getQueryCache()
      .build(client, { queryKey: keys.list(auth.id, q) })
      .setState({
        status: "error",
        error: Object.assign(new Error("TEST_ONLY HTTP"), { status }),
        fetchStatus: "idle",
        data: undefined,
      });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ReviewerGradePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("UC22 page route/cache/error boundaries (SSR)", () => {
  it("renders API term/list/detail/form and reload without premature success", () => {
    auth.id = "reviewer";
    const html = render();
    for (const t of [
      "Đợt phản biện",
      "Sinh viên được phân phản biện",
      "Tải lại dữ liệu",
      "Lưu nháp",
      "Trạng thái phiếu",
    ])
      expect(html).toContain(t);
    expect(html).not.toContain("Đã lưu phiếu phản biện trên hệ thống.");
    expect(render(undefined, 0, ["UC20_SCHEMA_REQUIRED"])).toContain(
      "Cần schema phân công phản biện UC20",
    );
  });
  it("does not show previous account or term data", () => {
    auth.id = "different";
    expect(render()).not.toContain("Sinh viên được phân phản biện");
    auth.id = "reviewer";
    const html = render("/defense/reviewer-grading?termId=other");
    expect(html).not.toContain("Sinh viên được phân phản biện");
    expect(html).toContain("Đang tải hồ sơ");
  });
  it.each([401, 403, 404, 409])("shows HTTP %i error and reload", (status) => {
    auth.id = "reviewer";
    const html = render(undefined, status);
    expect(html).toContain("TEST_ONLY HTTP");
    expect(html).toContain("Tải lại dữ liệu");
  });
  it("student has no cached score/comment access even if accidentally granted flat read permission", () => {
    auth.roles = ["STUDENT"];
    expect(render()).toContain("Không có quyền xem/chấm phản biện");
    expect(render()).not.toContain("Sinh viên được phân phản biện");
    auth.roles = ["LECTURER"];
  });
});
