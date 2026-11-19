import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup as render } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { DefenseReportsPage } from "./page";
import { reportingKeys as keys } from "./api";
import { reportTemplate, reportStatistics } from "./reporting.fixture";
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));
const auth = vi.hoisted(() => ({
  id: "actor",
  roles: ["FACULTY"],
  permissions: [
    "defense-report:read",
    "defense-report:templates-read",
    "defense-report:statistics",
    "defense-report:history-read",
    "defense-report:preview",
    "defense-report:export",
    "defense-report:download",
  ],
}));
vi.mock("../../../shared/hooks/use-api-session", () => ({
  useApiSession: () => auth,
}));
function page(
  tab = "XLSX",
  options: {
    loading?: boolean;
    status?: number;
    identity?: string;
    path?: string;
  } = {},
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
    identity =
      options.identity ??
      JSON.stringify([
        auth.id,
        auth.roles.slice().sort(),
        auth.permissions.slice().sort(),
      ]),
    f = { termId: "term" };
  if (!options.loading) {
    client.setQueryData(keys.options(identity, f), {
      terms: [
        { id: "term", code: "T", name: "Đợt kiểm thử", status: "DEFENDING" },
      ],
      committees: [],
      departments: [],
      classes: [],
      members: [],
      permissions: [],
      blockers: [],
    });
    client.setQueryData(keys.templates(identity, f), {
      templates: [reportTemplate()],
      blockers: [],
    });
    client.setQueryData(keys.statistics(identity, f), reportStatistics());
    client.setQueryData(keys.history(identity, f), []);
  }
  if (options.status)
    client
      .getQueryCache()
      .build(client, { queryKey: keys.options(identity, f) })
      .setState({
        status: "error",
        error: {
          response: {
            status: options.status,
            data: { error: { message: "HTTP " + options.status } },
          },
        },
      } as never);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          options.path ?? "/defense/reports?termId=term&tab=" + tab,
        ]}
      >
        <DefenseReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("UC25 API page SSR/cache privacy", () => {
  it("has three report groups and real filter/template choices", () => {
    const s = page();
    for (const label of [
      "Xuất Excel",
      "PDF / biểu mẫu",
      "Thống kê",
      "Đợt kiểm thử",
      "Hội đồng",
      "Bộ môn",
      "Lớp",
      "Xem trước",
      "Tạo bản xuất",
    ])
      expect(s).toContain(label);
    expect(s).not.toContain("Server đã tạo bản xuất");
  });
  it("statistics tab renders only supplied scoped API data", () =>
    expect(page("STATISTICS")).toContain("Giảng viên có nhiệm vụ hiện hành"));
  it("loading never fabricates preview/result data", () => {
    const s = page("XLSX", { loading: true });
    expect(s).toContain("Đang tải");
    expect(s).not.toContain("Sinh viên kiểm thử");
    expect(s).not.toContain("8.4");
  });
  it("a previous actor/role cache is not reused", () => {
    const s = page("XLSX", { identity: "other-actor" });
    expect(s).not.toContain("Đợt kiểm thử");
    expect(s).not.toContain("8.4");
  });
  it.each([401, 403, 404, 409])(
    "shows HTTP %s failure with retry and no fake generation success",
    (status) => {
      const s = page("XLSX", { status });
      expect(s).toContain("Tải lại");
      expect(s).not.toContain("Server đã tạo bản xuất");
    },
  );
  it.each(["ADMIN", "STUDENT"])(
    "%s cannot enter the export workspace",
    (role) => {
      auth.roles = [role];
      try {
        expect(page()).toContain("chưa có quyền báo cáo học vụ");
      } finally {
        auth.roles = ["FACULTY"];
      }
    },
  );
  it("member must select their committee before report queries", () => {
    auth.roles = ["LECTURER"];
    try {
      expect(page()).toContain("cần chọn hội đồng của mình");
    } finally {
      auth.roles = ["FACULTY"];
    }
  });
  it("invalid date filter is an error state, not a render crash", () =>
    expect(
      page("XLSX", { path: "/defense/reports?termId=term&from=bad" }),
    ).toContain("Bộ lọc chưa hợp lệ"));
});
